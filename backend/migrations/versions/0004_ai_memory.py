"""Add consent-aware, source-grounded memory understanding."""
from alembic import op
import sqlalchemy as sa


revision = "0004_ai_memory"
down_revision = "0003_auth_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ai_external_consent", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("captures", sa.Column("category", sa.String(length=32), nullable=False, server_default="general"))
    op.add_column("captures", sa.Column("summary", sa.Text(), nullable=False, server_default=""))
    op.add_column("captures", sa.Column("entities", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    op.add_column("captures", sa.Column("date_suggestions", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    op.add_column("captures", sa.Column("ai_provider", sa.String(length=24)))
    op.add_column("captures", sa.Column("ai_analyzed_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("captures", "ai_analyzed_at")
    op.drop_column("captures", "ai_provider")
    op.drop_column("captures", "date_suggestions")
    op.drop_column("captures", "entities")
    op.drop_column("captures", "summary")
    op.drop_column("captures", "category")
    op.drop_column("users", "ai_external_consent")
