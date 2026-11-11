import io
import json
from datetime import datetime, timedelta, timezone
from zipfile import ZipFile

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app import worker
from app.models import AuditEvent


def register(client: TestClient, email: str) -> tuple[dict, dict[str, str]]:
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "secure-test-password-42"})
    assert response.status_code == 201, response.text
    session = response.json()
    return session, {"Authorization": f"Bearer {session['access_token']}"}


def _png() -> bytes:
    image = Image.new("RGB", (8, 8), "#4a7c59")
    content = io.BytesIO()
    image.save(content, format="PNG")
    return content.getvalue()


def test_jwt_refresh_rotation_and_logout_revoke_access(client: TestClient) -> None:
    first, headers = register(client, "session@example.com")
    assert client.get("/api/v1/me", headers=headers).status_code == 200

    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert rotated.status_code == 200
    assert client.get("/api/v1/me", headers=headers).status_code == 401
    second = rotated.json()
    second_headers = {"Authorization": f"Bearer {second['access_token']}"}
    assert client.get("/api/v1/me", headers=second_headers).status_code == 200

    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reused.status_code == 401
    assert client.get("/api/v1/me", headers=second_headers).status_code == 401


def test_login_checks_password_and_returns_a_user_bound_session(client: TestClient) -> None:
    register(client, "login@example.com")
    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "LOGIN@example.com", "password": "secure-test-password-42"},
    )
    assert logged_in.status_code == 200
    session = logged_in.json()
    headers = {"Authorization": f"Bearer {session['access_token']}"}
    assert client.get("/api/v1/me", headers=headers).json()["email"] == "login@example.com"
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "wrong-test-password"},
    ).status_code == 401


def test_logout_revokes_active_access_and_refresh_tokens(client: TestClient) -> None:
    session, headers = register(client, "logout@example.com")
    logged_out = client.post("/api/v1/auth/logout", json={"refresh_token": session["refresh_token"]})
    assert logged_out.status_code == 204
    assert client.get("/api/v1/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": session["refresh_token"]}).status_code == 401


def test_two_account_isolation_for_captures_reminders_trips_and_checklists(client: TestClient) -> None:
    _account_a, headers_a = register(client, "owner-a@example.com")
    _account_b, headers_b = register(client, "owner-b@example.com")

    capture_a = client.post(
        "/api/v1/captures",
        headers=headers_a,
        json={"title": "A private hotel", "kind": "note", "body": "Hotel One, Berlin"},
    ).json()
    capture_b = client.post(
        "/api/v1/captures",
        headers=headers_b,
        json={"title": "B private note", "kind": "note", "body": "Private record B"},
    ).json()
    assert [row["id"] for row in client.get("/api/v1/captures", headers=headers_a).json()] == [capture_a["id"]]
    assert client.get(f"/api/v1/captures/{capture_a['id']}", headers=headers_b).status_code == 404
    assert client.patch(
        f"/api/v1/captures/{capture_a['id']}", headers=headers_b, json={"title": "stolen"}
    ).status_code == 404

    due_at = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    reminder_a = client.post(
        "/api/v1/reminders",
        headers=headers_a,
        json={"title": "A bill", "kind": "payment", "due_at": due_at, "amount": 24.5, "currency": "EUR"},
    ).json()
    assert [row["id"] for row in client.get("/api/v1/reminders", headers=headers_a).json()] == [reminder_a["id"]]
    assert client.patch(
        f"/api/v1/reminders/{reminder_a['id']}", headers=headers_b, json={"title": "stolen"}
    ).status_code == 404
    assert client.post(
        f"/api/v1/reminders/{reminder_a['id']}/complete",
        headers=headers_a,
        json={"due_at": due_at},
    ).status_code == 200
    assert len(client.get("/api/v1/payments/overview", headers=headers_a).json()["history"]) == 1
    assert client.get("/api/v1/payments/overview", headers=headers_b).json()["history"] == []

    starts = datetime.now(timezone.utc) + timedelta(days=30)
    trip_a = client.post(
        "/api/v1/trips",
        headers=headers_a,
        json={
            "title": "A Berlin trip", "destination": "Berlin", "starts_at": starts.isoformat(),
            "ends_at": (starts + timedelta(days=3)).isoformat(), "timezone": "Europe/Berlin",
        },
    ).json()
    trip_b = client.post(
        "/api/v1/trips",
        headers=headers_b,
        json={
            "title": "B trip", "destination": "Oslo", "starts_at": starts.isoformat(),
            "ends_at": (starts + timedelta(days=2)).isoformat(), "timezone": "Europe/Oslo",
        },
    ).json()
    assert client.get(f"/api/v1/trips/{trip_a['id']}", headers=headers_b).status_code == 404
    assert client.post(
        f"/api/v1/trips/{trip_a['id']}/bookings",
        headers=headers_a,
        json={"kind": "other", "title": "Foreign capture", "capture_id": capture_b["id"]},
    ).status_code == 404
    booking_b = client.post(
        f"/api/v1/trips/{trip_b['id']}/bookings",
        headers=headers_b,
        json={"kind": "other", "title": "B booking", "capture_id": capture_b["id"]},
    ).json()
    assert client.delete(
        f"/api/v1/trips/{trip_b['id']}/bookings/{booking_b['id']}", headers=headers_a
    ).status_code == 404
    checklist_a = client.post(
        f"/api/v1/trips/{trip_a['id']}/checklist",
        headers=headers_a,
        json={"title": "Passport", "category": "documents"},
    ).json()
    assert client.patch(
        f"/api/v1/trips/{trip_a['id']}/checklist/{checklist_a['id']}",
        headers=headers_b,
        json={"completed": True},
    ).status_code == 404


def test_upload_attachment_and_zip_export_are_owner_private(client: TestClient, tmp_path) -> None:
    _account_a, headers_a = register(client, "upload-a@example.com")
    _account_b, headers_b = register(client, "upload-b@example.com")
    png = _png()
    upload_a = client.post(
        "/api/v1/captures/upload",
        headers=headers_a,
        data={"title": "A attached screenshot"},
        files={"file": ("a-private.png", png, "image/png")},
    )
    upload_b = client.post(
        "/api/v1/captures/upload",
        headers=headers_b,
        data={"title": "B attached screenshot"},
        files={"file": ("b-private.png", png, "image/png")},
    )
    assert upload_a.status_code == upload_b.status_code == 201
    capture_a = upload_a.json()
    capture_b = upload_b.json()
    assert client.get(capture_a["attachment_url"], headers=headers_a).content == png
    assert client.get(capture_a["attachment_url"], headers=headers_b).status_code == 404

    exported = client.get("/api/v1/me/export", headers=headers_a)
    assert exported.status_code == 200
    with ZipFile(io.BytesIO(exported.content)) as archive:
        names = archive.namelist()
        payload = json.loads(archive.read("pingo-export.json"))
        assert any(name.startswith(f"attachments/{capture_a['id']}/") for name in names)
        assert not any(capture_b["id"] in name for name in names)
        assert [row["id"] for row in payload["captures"]] == [capture_a["id"]]
        assert "B attached screenshot" not in archive.read("pingo-export.json").decode("utf-8")
    with client.app.state.test_sessions() as db:
        actions = set(db.scalars(select(AuditEvent.action).where(AuditEvent.owner_id == _account_a["user"]["id"])))
    assert {"account.registered", "capture.screenshot_uploaded", "account.exported"} <= actions


def test_account_deletion_removes_private_attachment_and_revokes_access(client: TestClient, tmp_path) -> None:
    session, headers = register(client, "delete-me@example.com")
    uploaded = client.post(
        "/api/v1/captures/upload",
        headers=headers,
        data={"title": "Delete with account"},
        files={"file": ("proof.png", _png(), "image/png")},
    )
    assert uploaded.status_code == 201
    owner_id = session["user"]["id"]
    owner_folder = tmp_path / "private_uploads" / owner_id
    assert owner_folder.is_dir()
    response = client.request(
        "DELETE", "/api/v1/me", headers=headers, json={"password": "secure-test-password-42"}
    )
    assert response.status_code == 204
    assert not owner_folder.exists()
    assert client.get("/api/v1/me", headers=headers).status_code == 401


def test_upload_rejects_unsupported_content_and_missing_auth(client: TestClient) -> None:
    assert client.get("/api/v1/captures").status_code == 401
    _account, headers = register(client, "file-check@example.com")
    invalid = client.post(
        "/api/v1/captures/upload",
        headers=headers,
        files={"file": ("anything.exe", b"not an allowed document format", "application/octet-stream")},
    )
    assert invalid.status_code == 415


def test_worker_claims_each_accounts_due_reminders_once(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(worker, "SessionLocal", client.app.state.test_sessions)
    owners = []
    for index in ("a", "b"):
        session, headers = register(client, f"worker-{index}@example.com")
        owners.append((session["user"]["id"], headers, index))
        device = client.put(
            "/api/v1/push/devices",
            headers=headers,
            json={
                "device_id": f"device-owner-{index}",
                "expo_push_token": f"ExpoPushToken[owner-{index}-token-123456789]",
                "platform": "ios",
                "show_details": True,
            },
        )
        assert device.status_code == 200
        reminder = client.post(
            "/api/v1/reminders",
            headers=headers,
            json={
                "title": f"Reminder for {index}", "kind": "deadline",
                "due_at": (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat(),
                "reminder_offsets_minutes": [0],
            },
        )
        assert reminder.status_code == 201

    jobs = worker._claim_due_attempts()
    assert len(jobs) == 2
    by_owner = {owner_id: token for owner_id, token in ((job["owner_id"], job["token"]) for job in jobs)}
    for owner_id, _headers, index in owners:
        assert by_owner[owner_id] == f"ExpoPushToken[owner-{index}-token-123456789]"
    assert worker._claim_due_attempts() == []
