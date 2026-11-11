"""Durable Expo push dispatcher. Run as one or more independent worker processes."""

import logging
import os
import time
from datetime import timedelta

import httpx
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from app.core.config import ENVIRONMENT
from app.db import SessionLocal, assert_postgres_security, set_tenant_scope
from app.models import NotificationAttempt, NotificationDelivery, PushDevice, Reminder, utc_now


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("pingo.notifications")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
POLL_SECONDS = max(2, int(os.getenv("NOTIFICATION_POLL_SECONDS", "10")))
MAX_ATTEMPTS = 8
LEASE_MINUTES = 5


def _headers() -> dict[str, str]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    token = os.getenv("EXPO_PUSH_ACCESS_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _aggregate_delivery(db: Session, delivery_id: str, owner_id: str) -> None:
    delivery = db.scalar(
        select(NotificationDelivery).where(
            NotificationDelivery.id == delivery_id,
            NotificationDelivery.owner_id == owner_id,
        )
    )
    if not delivery:
        return
    attempts = list(db.scalars(select(NotificationAttempt).where(
        NotificationAttempt.delivery_id == delivery_id,
        NotificationAttempt.owner_id == owner_id,
    )))
    if not attempts:
        return
    statuses = {attempt.status for attempt in attempts}
    if "sending" in statuses:
        delivery.status = "sending"
    elif "pending" in statuses or any(a.status == "failed" and a.retry_at and a.retry_at > utc_now() for a in attempts):
        delivery.status = "pending"
    elif statuses == {"provider_confirmed"}:
        delivery.status = "provider_confirmed"
    elif statuses & {"accepted", "provider_confirmed"}:
        delivery.status = "accepted"
    else:
        delivery.status = "failed"
        delivery.error_message = next((a.error_message for a in attempts if a.error_message), "Push could not be sent")[:500]


def _claim_due_attempts() -> list[dict]:
    now = utc_now()
    lease = now - timedelta(minutes=LEASE_MINUTES)
    jobs: list[dict] = []
    with SessionLocal() as db:
        if db.get_bind().dialect.name == "postgresql":
            claimed = list(db.execute(
                text("SELECT owner_id, delivery_id FROM public.pingo_claim_due_notifications(:batch_limit)"),
                {"batch_limit": 100},
            ).all())
            db.commit()
            for owner_id, delivery_id in claimed:
                _process_claimed_delivery(owner_id, delivery_id, now, jobs)
            return jobs

        rows = list(
            db.scalars(
                select(NotificationDelivery)
                .join(
                    Reminder,
                    (Reminder.id == NotificationDelivery.reminder_id)
                    & (Reminder.owner_id == NotificationDelivery.owner_id),
                )
                .where(
                    NotificationDelivery.owner_id == Reminder.owner_id,
                    Reminder.status == "active",
                    Reminder.due_at == NotificationDelivery.occurrence_due_at,
                    NotificationDelivery.scheduled_at <= now,
                    or_(
                        NotificationDelivery.status == "pending",
                        (NotificationDelivery.status == "sending") & (NotificationDelivery.attempted_at < lease),
                    ),
                )
                .order_by(NotificationDelivery.scheduled_at.asc())
                .limit(100)
                .with_for_update(skip_locked=True, of=NotificationDelivery)
            )
        )
        for delivery in rows:
            devices = list(
                db.scalars(
                    select(PushDevice).where(PushDevice.owner_id == delivery.owner_id, PushDevice.enabled.is_(True))
                )
            )
            if not devices:
                delivery.status = "no_device"
                delivery.error_message = "No push device is registered; local notifications may still be available."
                continue
            delivery.status = "sending"
            delivery.attempted_at = now
            for device in devices:
                attempt = db.scalar(
                    select(NotificationAttempt).where(
                        NotificationAttempt.delivery_id == delivery.id,
                        NotificationAttempt.owner_id == delivery.owner_id,
                        NotificationAttempt.push_device_id == device.id,
                    )
                )
                if attempt is None:
                    attempt = NotificationAttempt(
                        owner_id=delivery.owner_id,
                        delivery_id=delivery.id,
                        push_device_id=device.id,
                    )
                    db.add(attempt)
                    db.flush()
                retry_due = attempt.retry_at is None or attempt.retry_at <= now
                stale = attempt.status == "sending" and (attempt.attempted_at is None or attempt.attempted_at < lease)
                if attempt.status == "provider_confirmed" or attempt.status == "accepted":
                    continue
                if attempt.status == "failed" and (attempt.attempts >= MAX_ATTEMPTS or not retry_due):
                    continue
                if attempt.status == "sending" and not stale:
                    continue
                attempt.status = "sending"
                attempt.attempts += 1
                attempt.attempted_at = now
                attempt.retry_at = None
                attempt.error_message = None
                reminder = db.scalar(select(Reminder).where(
                    Reminder.id == delivery.reminder_id,
                    Reminder.owner_id == delivery.owner_id,
                ))
                body = reminder.title if device.show_details and reminder else "You have a reminder coming up."
                jobs.append(
                    {
                        "owner_id": delivery.owner_id,
                        "attempt_id": attempt.id,
                        "delivery_id": delivery.id,
                        "device_id": device.id,
                        "token": device.expo_push_token,
                        "title": "PINGO reminder",
                        "body": body[:180],
                        "reminder_id": delivery.reminder_id,
                        "occurrence_due_at": delivery.occurrence_due_at.isoformat(),
                    }
                )
            _aggregate_delivery(db, delivery.id, delivery.owner_id)
        db.commit()
    return jobs


def _process_claimed_delivery(owner_id: str, delivery_id: str, now, jobs: list[dict]) -> None:
    """Load a claimed reminder only after applying its owner's database RLS scope."""
    # The PostgreSQL claim RPC returns identifiers only; each tenant's data is
    # queried after the worker installs that owner's transaction-local scope.
    with SessionLocal() as scoped:
        set_tenant_scope(scoped, owner_id)
        delivery = scoped.scalar(select(NotificationDelivery).where(
            NotificationDelivery.id == delivery_id,
            NotificationDelivery.owner_id == owner_id,
        ))
        if delivery is None or delivery.status != "sending":
            return
        reminder = scoped.scalar(select(Reminder).where(
            Reminder.id == delivery.reminder_id,
            Reminder.owner_id == owner_id,
            Reminder.status == "active",
            Reminder.due_at == delivery.occurrence_due_at,
        ))
        if reminder is None:
            delivery.status = "cancelled"
            scoped.commit()
            return
        devices = list(scoped.scalars(select(PushDevice).where(
            PushDevice.owner_id == owner_id,
            PushDevice.enabled.is_(True),
        )))
        if not devices:
            delivery.status = "no_device"
            delivery.error_message = "No push device is registered; local notifications may still be available."
            scoped.commit()
            return
        for device in devices:
            attempt = scoped.scalar(select(NotificationAttempt).where(
                NotificationAttempt.delivery_id == delivery.id,
                NotificationAttempt.owner_id == owner_id,
                NotificationAttempt.push_device_id == device.id,
            ))
            if attempt is None:
                attempt = NotificationAttempt(
                    owner_id=owner_id,
                    delivery_id=delivery.id,
                    push_device_id=device.id,
                )
                scoped.add(attempt)
                scoped.flush()
            retry_due = attempt.retry_at is None or attempt.retry_at <= now
            stale = attempt.status == "sending" and (attempt.attempted_at is None or attempt.attempted_at < now - timedelta(minutes=LEASE_MINUTES))
            if attempt.status in {"provider_confirmed", "accepted"}:
                continue
            if attempt.status == "failed" and (attempt.attempts >= MAX_ATTEMPTS or not retry_due):
                continue
            if attempt.status == "sending" and not stale:
                continue
            attempt.status = "sending"
            attempt.attempts += 1
            attempt.attempted_at = now
            attempt.retry_at = None
            attempt.error_message = None
            jobs.append({
                "owner_id": owner_id,
                "attempt_id": attempt.id,
                "delivery_id": delivery.id,
                "device_id": device.id,
                "token": device.expo_push_token,
                "title": "PINGO reminder",
                "body": reminder.title[:180] if device.show_details else "You have a reminder coming up.",
                "reminder_id": delivery.reminder_id,
                "occurrence_due_at": delivery.occurrence_due_at.isoformat(),
            })
        _aggregate_delivery(scoped, delivery.id, owner_id)
        scoped.commit()


def _retry_or_fail(attempt: NotificationAttempt, message: str, retryable: bool) -> None:
    attempt.error_message = message[:500]
    attempt.provider_ticket_id = None
    if retryable and attempt.attempts < MAX_ATTEMPTS:
        delay = min(3600, 30 * (2 ** min(attempt.attempts - 1, 7)))
        attempt.retry_at = utc_now() + timedelta(seconds=delay)
        attempt.status = "failed"
    else:
        attempt.retry_at = None
        attempt.status = "failed"


def _send_jobs(client: httpx.Client, jobs: list[dict]) -> None:
    if not jobs:
        return
    for start in range(0, len(jobs), 100):
        batch = jobs[start : start + 100]
        messages = [
            {
                "to": item["token"],
                "title": item["title"],
                "body": item["body"],
                "sound": "default",
                "priority": "high",
                "channelId": "pingo-reminders-v2",
                "ttl": 3600,
                "data": {
                    "reminderId": item["reminder_id"],
                    "deliveryId": item["delivery_id"],
                    "dueAt": item["occurrence_due_at"],
                },
            }
            for item in batch
        ]
        try:
            response = client.post(EXPO_PUSH_URL, headers=_headers(), json=messages)
            response.raise_for_status()
            tickets = response.json().get("data", [])
            if len(tickets) != len(batch):
                raise ValueError("Push provider returned an unexpected ticket count")
            for item, ticket in zip(batch, tickets, strict=True):
                with SessionLocal() as db:
                    set_tenant_scope(db, item["owner_id"])
                    attempt = db.scalar(select(NotificationAttempt).where(
                        NotificationAttempt.id == item["attempt_id"],
                        NotificationAttempt.owner_id == item["owner_id"],
                    ))
                    if not attempt:
                        continue
                    details = ticket.get("details") or {}
                    if ticket.get("status") == "ok" and ticket.get("id"):
                        attempt.status = "accepted"
                        attempt.provider_ticket_id = ticket["id"]
                        attempt.retry_at = utc_now() + timedelta(minutes=15)
                        attempt.error_message = None
                    else:
                        reason = details.get("error", "PushRejected")
                        if reason == "DeviceNotRegistered":
                            device = db.scalar(select(PushDevice).where(
                                PushDevice.id == item["device_id"],
                                PushDevice.owner_id == item["owner_id"],
                            ))
                            if device:
                                device.enabled = False
                        _retry_or_fail(attempt, ticket.get("message", reason), reason not in {"DeviceNotRegistered", "InvalidCredentials"})
                    _aggregate_delivery(db, item["delivery_id"], item["owner_id"])
                    db.commit()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Push batch failed: %s", type(exc).__name__)
            for item in batch:
                with SessionLocal() as db:
                    set_tenant_scope(db, item["owner_id"])
                    attempt = db.scalar(select(NotificationAttempt).where(
                        NotificationAttempt.id == item["attempt_id"],
                        NotificationAttempt.owner_id == item["owner_id"],
                    ))
                    if attempt:
                        _retry_or_fail(attempt, "Push service is temporarily unavailable", True)
                        _aggregate_delivery(db, item["delivery_id"], item["owner_id"])
                        db.commit()


def _check_receipts(client: httpx.Client) -> None:
    cutoff = utc_now() - timedelta(minutes=15)
    with SessionLocal() as db:
        if db.get_bind().dialect.name == "postgresql":
            ticket_rows = list(db.execute(
                text("SELECT owner_id, attempt_id, delivery_id, push_device_id, provider_ticket_id FROM public.pingo_claim_due_receipts(:batch_limit)"),
                {"batch_limit": 1000},
            ).all())
            db.commit()
        else:
            attempts = list(
                db.scalars(
                    select(NotificationAttempt)
                    .where(
                        NotificationAttempt.status == "accepted",
                        NotificationAttempt.provider_ticket_id.is_not(None),
                        NotificationAttempt.attempted_at < cutoff,
                        or_(NotificationAttempt.retry_at.is_(None), NotificationAttempt.retry_at <= utc_now()),
                    )
                    .order_by(NotificationAttempt.attempted_at.asc())
                    .limit(1000)
                )
            )
            ticket_rows = [(row.owner_id, row.id, row.delivery_id, row.push_device_id, row.provider_ticket_id) for row in attempts]
    for start in range(0, len(ticket_rows), 1000):
        batch = ticket_rows[start : start + 1000]
        try:
            response = client.post(EXPO_RECEIPTS_URL, headers=_headers(), json={"ids": [item[4] for item in batch]})
            response.raise_for_status()
            receipts = response.json().get("data", {})
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Push receipt lookup failed: %s", type(exc).__name__)
            return
        for owner_id, attempt_id, delivery_id, device_id, ticket_id in batch:
            with SessionLocal() as db:
                set_tenant_scope(db, owner_id)
                receipt = receipts.get(ticket_id)
                if not receipt:
                    attempt = db.scalar(select(NotificationAttempt).where(
                        NotificationAttempt.id == attempt_id,
                        NotificationAttempt.owner_id == owner_id,
                    ))
                    if attempt and attempt.status == "accepted":
                        attempt.retry_at = utc_now() + timedelta(minutes=5)
                        db.commit()
                    continue
                attempt = db.scalar(select(NotificationAttempt).where(
                    NotificationAttempt.id == attempt_id,
                    NotificationAttempt.owner_id == owner_id,
                ))
                if not attempt or attempt.status != "accepted":
                    continue
                if receipt.get("status") == "ok":
                    attempt.status = "provider_confirmed"
                    attempt.retry_at = None
                    attempt.error_message = None
                else:
                    details = receipt.get("details") or {}
                    reason = details.get("error", "ProviderError")
                    if reason == "DeviceNotRegistered" and device_id:
                        device = db.scalar(select(PushDevice).where(
                            PushDevice.id == device_id,
                            PushDevice.owner_id == owner_id,
                        ))
                        if device:
                            device.enabled = False
                    _retry_or_fail(attempt, receipt.get("message", reason), reason not in {"DeviceNotRegistered", "InvalidCredentials"})
                _aggregate_delivery(db, delivery_id, owner_id)
                db.commit()


def run_worker() -> None:
    logger.info("PINGO push worker started (poll=%ss)", POLL_SECONDS)
    if ENVIRONMENT == "production":
        with SessionLocal() as db:
            assert_postgres_security(db, worker=True)
    with httpx.Client(timeout=httpx.Timeout(12.0, connect=5.0)) as client:
        while True:
            try:
                jobs = _claim_due_attempts()
                _send_jobs(client, jobs)
                _check_receipts(client)
            except Exception:
                logger.exception("Notification worker iteration failed")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run_worker()
