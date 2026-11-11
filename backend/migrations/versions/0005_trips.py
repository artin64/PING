"""Add private travel plans, bookings and preparation checklists."""
from alembic import op
import sqlalchemy as sa


revision = "0005_trips"
down_revision = "0004_ai_memory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("destination", sa.String(length=160), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trips_owner_id", "trips", ["owner_id"])
    op.create_index("ix_trips_owner_start", "trips", ["owner_id", "starts_at"])

    op.create_table(
        "trip_bookings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trip_id", sa.String(length=36), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("capture_id", sa.String(length=36), sa.ForeignKey("captures.id", ondelete="SET NULL")),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("confirmation_reference", sa.String(length=120)),
        sa.Column("departure_at", sa.DateTime(timezone=True)),
        sa.Column("arrival_at", sa.DateTime(timezone=True)),
        sa.Column("departure_timezone", sa.String(length=64)),
        sa.Column("arrival_timezone", sa.String(length=64)),
        sa.Column("from_location", sa.String(length=160)),
        sa.Column("to_location", sa.String(length=160)),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trip_bookings_owner_id", "trip_bookings", ["owner_id"])
    op.create_index("ix_trip_bookings_trip_id", "trip_bookings", ["trip_id"])
    op.create_index("ix_trip_bookings_capture_id", "trip_bookings", ["capture_id"])
    op.create_index("ix_trip_bookings_trip_departure", "trip_bookings", ["trip_id", "departure_at"])

    op.create_table(
        "trip_checklist_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trip_id", sa.String(length=36), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False, server_default="preparation"),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trip_checklist_items_owner_id", "trip_checklist_items", ["owner_id"])
    op.create_index("ix_trip_checklist_items_trip_id", "trip_checklist_items", ["trip_id"])
    op.create_index("ix_trip_checklist_trip_completed", "trip_checklist_items", ["trip_id", "completed"])

    with op.batch_alter_table("reminders") as batch_op:
        batch_op.add_column(sa.Column("trip_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_reminders_trip_id_trips",
            "trips",
            ["trip_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_reminders_trip_id", ["trip_id"])


def downgrade() -> None:
    with op.batch_alter_table("reminders") as batch_op:
        batch_op.drop_index("ix_reminders_trip_id")
        batch_op.drop_constraint("fk_reminders_trip_id_trips", type_="foreignkey")
        batch_op.drop_column("trip_id")
    op.drop_table("trip_checklist_items")
    op.drop_table("trip_bookings")
    op.drop_table("trips")
