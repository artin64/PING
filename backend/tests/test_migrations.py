from pathlib import Path

from alembic import command
from alembic.config import Config


def test_alembic_chain_upgrades_a_clean_sqlite_database(monkeypatch) -> None:
    project_root = Path(__file__).resolve().parents[2]
    backend_root = project_root / "backend"
    config = Config(str(project_root / "backend" / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    monkeypatch.setenv("MIGRATIONS_DATABASE_URL", "sqlite://")

    command.upgrade(config, "head")
