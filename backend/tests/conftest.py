from collections.abc import Iterator
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main
from app.db import Base, get_db


@pytest.fixture
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    testing_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    main.app.state.test_sessions = testing_sessions

    def override_get_db():
        db = testing_sessions()
        try:
            yield db
        finally:
            db.info.clear()
            db.close()

    monkeypatch.setattr(main, "UPLOAD_ROOT", tmp_path / "private_uploads")
    main._rate_windows.clear()
    main.app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        main.app.dependency_overrides.clear()
        if hasattr(main.app.state, "test_sessions"):
            del main.app.state.test_sessions
        engine.dispose()
