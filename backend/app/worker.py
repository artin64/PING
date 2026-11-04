"""Durable Expo push dispatcher. Run as one or more independent worker processes."""

import logging
import os
import time
from datetime import timedelta

import httpx
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
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


def _aggregate_delivery(db: Session, delivery_id: str) -> None:
    delivery = db.get(NotificationDelivery, delivery_id)
    if not delivery:
        return
    attempts = list(db.scalars(select(NotificationAttempt).where(NotificationAttempt.delivery_id == delivery_id)))
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
        rows = list(
            db.scalars(
                select(NotificationDelivery)
                .join(Reminder, Reminder.id == NotificationDelivery.reminder_id)
                .where(
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
                reminder = db.get(Reminder, delivery.reminder_id)
                body = reminder.title if device.show_details and reminder else "You have a reminder coming up."
                jobs.append(
                    {
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
            _aggregate_delivery(db, delivery.id)
        db.commit()
    return jobs


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
                "channelId": "reminders",
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
            with SessionLocal() as db:
                for item, ticket in zip(batch, tickets, strict=True):
                    attempt = db.get(NotificationAttempt, item["attempt_id"])
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
                            device = db.get(PushDevice, item["device_id"])
                            if device:
                                device.enabled = False
                        _retry_or_fail(attempt, ticket.get("message", reason), reason not in {"DeviceNotRegistered", "InvalidCredentials"})
                    _aggregate_delivery(db, item["delivery_id"])
                db.commit()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Push batch failed: %s", type(exc).__name__)
            with SessionLocal() as db:
                for item in batch:
                    attempt = db.get(NotificationAttempt, item["attempt_id"])
                    if attempt:
                        _retry_or_fail(attempt, "Push service is temporarily unavailable", True)
                        _aggregate_delivery(db, item["delivery_id"])
                db.commit()


def _check_receipts(client: httpx.Client) -> None:
    cutoff = utc_now() - timedelta(minutes=15)
    with SessionLocal() as db:
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
        ticket_rows = [(row.id, row.delivery_id, row.push_device_id, row.provider_ticket_id) for row in attempts]
    for start in range(0, len(ticket_rows), 1000):
        batch = ticket_rows[start : start + 1000]
        try:
            response = client.post(EXPO_RECEIPTS_URL, headers=_headers(), json={"ids": [item[3] for item in batch]})
            response.raise_for_status()
            receipts = response.json().get("data", {})
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Push receipt lookup failed: %s", type(exc).__name__)
            return
        with SessionLocal() as db:
            for attempt_id, delivery_id, device_id, ticket_id in batch:
                receipt = receipts.get(ticket_id)
                if not receipt:
                    attempt = db.get(NotificationAttempt, attempt_id)
                    if attempt and attempt.status == "accepted":
                        attempt.retry_at = utc_now() + timedelta(minutes=5)
                    continue
                attempt = db.get(NotificationAttempt, attempt_id)
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
                        device = db.get(PushDevice, device_id)
                        if device:
                            device.enabled = False
                    _retry_or_fail(attempt, receipt.get("message", reason), reason not in {"DeviceNotRegistered", "InvalidCredentials"})
                _aggregate_delivery(db, delivery_id)
            db.commit()


def run_worker() -> None:
    logger.info("PINGO push worker started (poll=%ss)", POLL_SECONDS)
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
