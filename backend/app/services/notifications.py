from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import NotificationDelivery, Reminder, User, utc_now


def queue_reminder_notifications(db: Session, reminder: Reminder, user: User) -> None:
    """Create one durable, deduplicated job for each still-relevant reminder time."""
    db.execute(
        update(NotificationDelivery)
        .where(
            NotificationDelivery.owner_id == user.id,
            NotificationDelivery.reminder_id == reminder.id,
            NotificationDelivery.status == "pending",
        )
        .values(status="cancelled", error_message="Reminder schedule changed")
    )

    now = utc_now()
    due_utc = _as_utc(reminder.due_at)
    try:
        zone = ZoneInfo(reminder.recurrence_timezone or user.timezone)
    except Exception:
        zone = ZoneInfo("UTC")
    due_local = due_utc.astimezone(zone)
    offsets = sorted(set(reminder.reminder_offsets_minutes or [1440, 60]), reverse=True)
    selected: list[tuple[int, datetime]] = []
    for offset in offsets:
        scheduled_local = due_local - timedelta(minutes=offset)
        scheduled = scheduled_local.astimezone(timezone.utc)
        if scheduled >= now:
            selected.append((offset, scheduled))
    if not selected:
        selected = [(0, max(due_utc, now))]

    existing = {
        (row.offset_minutes, _as_utc(row.occurrence_due_at)): row
        for row in db.scalars(select(NotificationDelivery).where(
            NotificationDelivery.owner_id == user.id,
            NotificationDelivery.reminder_id == reminder.id,
        ))
    }
    for offset, scheduled in selected:
        previous = existing.get((offset, due_utc))
        if previous:
            if previous.status in {"cancelled", "failed", "no_device"}:
                previous.status = "pending"
                previous.scheduled_at = scheduled
                previous.retry_at = None
                previous.error_message = None
            continue
        db.add(
            NotificationDelivery(
                owner_id=user.id,
                reminder_id=reminder.id,
                occurrence_due_at=due_utc,
                offset_minutes=offset,
                scheduled_at=scheduled,
                status="pending",
            )
        )


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
