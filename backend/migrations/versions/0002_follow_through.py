"""Add recurring payments and durable push notification queue.

Revision ID: 0002_follow_through
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_follow_through"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("recurrence", sa.String(16), nullable=False, server_default="none"))
    op.add_column("reminders", sa.Column("recurrence_timezone", sa.String(64), nullable=False, server_default="UTC"))
    op.add_column(
        "reminders",
        sa.Column("reminder_offsets_minutes", sa.JSON(), nullable=False, server_default=sa.text("'[1440,60]'")),
    )

    op.create_table(
        "payment_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_id", sa.String(length=36), sa.ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2)),
        sa.Column("currency", sa.String(length=3)),
        sa.UniqueConstraint("reminder_id", "due_at", name="uq_payment_reminder_due"),
    )
    op.create_index("ix_payment_events_owner_id", "payment_events", ["owner_id"])
    op.create_index("ix_payment_events_reminder_id", "payment_events", ["reminder_id"])
    op.create_index("ix_payment_events_owner_paid", "payment_events", ["owner_id", "paid_at"])

    op.create_table(
        "push_devices",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.String(length=100), nullable=False),
        sa.Column("expo_push_token", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("show_details", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", "device_id", name="uq_push_device_owner_device"),
    )
    op.create_index("ix_push_devices_owner_id", "push_devices", ["owner_id"])
    op.create_index("ix_push_devices_expo_push_token", "push_devices", ["expo_push_token"], unique=True)

    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_id", sa.String(length=36), sa.ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("occurrence_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("offset_minutes", sa.Integer(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retry_at", sa.DateTime(timezone=True)),
        sa.Column("locked_at", sa.DateTime(timezone=True)),
        sa.Column("provider_ticket_id", sa.String(length=255)),
        sa.Column("error_message", sa.String(length=500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint(
            "reminder_id", "occurrence_due_at", "offset_minutes", name="uq_notification_reminder_occurrence_offset"
        ),
    )
    op.create_index("ix_notification_deliveries_owner_id", "notification_deliveries", ["owner_id"])
    op.create_index("ix_notification_deliveries_reminder_id", "notification_deliveries", ["reminder_id"])
    op.create_index("ix_notification_deliveries_status_scheduled", "notification_deliveries", ["status", "scheduled_at"])

    op.create_table(
        "notification_attempts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delivery_id", sa.String(length=36), sa.ForeignKey("notification_deliveries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("push_device_id", sa.String(length=36), sa.ForeignKey("push_devices.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retry_at", sa.DateTime(timezone=True)),
        sa.Column("provider_ticket_id", sa.String(length=255)),
        sa.Column("error_message", sa.String(length=500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("delivery_id", "push_device_id", name="uq_notification_attempt_delivery_device"),
    )
    op.create_index("ix_notification_attempts_owner_id", "notification_attempts", ["owner_id"])
    op.create_index("ix_notification_attempts_delivery_id", "notification_attempts", ["delivery_id"])
    op.create_index("ix_notification_attempts_status_retry", "notification_attempts", ["status", "retry_at"])


def downgrade() -> None:
    op.drop_table("notification_attempts")
    op.drop_table("notification_deliveries")
    op.drop_table("push_devices")
    op.drop_table("payment_events")
    op.drop_column("reminders", "reminder_offsets_minutes")
    op.drop_column("reminders", "recurrence_timezone")
    op.drop_column("reminders", "recurrence")
