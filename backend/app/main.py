import asyncio
import calendar
import hashlib
import io
import json
import logging
import re
import shutil
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from secrets import token_urlsafe
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from starlette.background import BackgroundTask
from sqlalchemy import and_, cast, func, or_, select, String, text, true, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import ALLOWED_ORIGINS, MAX_UPLOAD_BYTES, REFRESH_TOKEN_DAYS, UPLOAD_ROOT
from app.db import get_db
from app.models import (
    AuditEvent,
    AuthSession,
    Capture,
    NotificationDelivery,
    PaymentEvent,
    PushDevice,
    Reminder,
    Trip,
    TripBooking,
    TripChecklistItem,
    User,
    utc_now,
)
from app.schemas import (
    CaptureCreate,
    CaptureOut,
    CaptureUpdate,
    LoginIn,
    PaymentEventOut,
    PushDeviceIn,
    RefreshIn,
    RegisterIn,
    ReminderCreate,
    ReminderOut,
    ReminderUpdate,
    SessionOut,
    TripBookingCreate,
    TripBookingOut,
    TripChecklistCreate,
    TripChecklistOut,
    TripChecklistUpdate,
    TripCreate,
    TripOut,
    TripUpdate,
    UserOut,
    UserUpdate,
)
from app.security import create_access_token, current_user, hash_password, verify_password, verify_unknown_user
from app.services.ocr import read_image_text, read_pdf_text, validate_image, validate_pdf
from app.services.notifications import queue_reminder_notifications
from app.services.ai import AIConsentRequired, AIUnavailable, analyze_memory


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("pingo.api")
app = FastAPI(
    title="PINGO API",
    version="0.1.0",
    description="Private memory capture and reminder API. Interactive docs are available at /docs.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_rate_windows: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_rate_lock = asyncio.Lock()


@app.middleware("http")
async def request_limits_and_headers(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path.startswith("/api/"):
        client = request.client.host if request.client else "unknown"
        path = request.url.path
        bucket = (client, "auth" if "/auth/" in path else "ai" if path.endswith("/understand") else "api")
        now = time.monotonic()
        limit = 8 if bucket[1] in {"auth", "ai"} else 180
        async with _rate_lock:
            events = _rate_windows[bucket]
            while events and now - events[0] > 60:
                events.popleft()
            if len(events) >= limit:
                response = fastapi_response_429()
                response.headers["Retry-After"] = str(max(1, int(60 - (now - events[0]))))
                return response
            events.append(now)
            if len(_rate_windows) > 5000:
                for stale_key in list(_rate_windows)[:1000]:
                    if not _rate_windows[stale_key] or now - _rate_windows[stale_key][-1] > 3600:
                        _rate_windows.pop(stale_key, None)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    return response


def fastapi_response_429():
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=429, content={"detail": "Too many requests. Try again shortly."})


def audit(db: Session, user_id: str, action: str, target_id: str | None = None) -> None:
    db.add(AuditEvent(owner_id=user_id, action=action, target_id=target_id))


def create_refresh_session(db: Session, user_id: str, family_id: str | None = None) -> tuple[str, AuthSession]:
    raw_token = token_urlsafe(48)
    session = AuthSession(
        owner_id=user_id,
        family_id=family_id or str(uuid4()),
        refresh_token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        expires_at=utc_now() + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    db.add(session)
    db.flush()
    return raw_token, session


def capture_result(row: Capture) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "kind": row.kind,
        "body": row.body,
        "extracted_text": row.extracted_text,
        "category": row.category,
        "summary": row.summary,
        "entities": row.entities or [],
        "date_suggestions": row.date_suggestions or [],
        "ai_provider": row.ai_provider,
        "source_url": row.source_url,
        "original_filename": row.original_filename,
        "content_type": row.content_type,
        "ocr_status": row.ocr_status,
        "status": row.status,
        "attachment_url": f"/api/v1/captures/{row.id}/attachment" if row.storage_key else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def reminder_result(row: Reminder) -> dict:
    payment_state = None
    if row.kind == "payment":
        zone = ZoneInfo(row.recurrence_timezone or "UTC")
        due_local = _as_utc(row.due_at).astimezone(zone)
        local_today = utc_now().astimezone(zone).date()
        payment_state = "overdue" if due_local.date() < local_today else "due" if due_local.date() == local_today else "upcoming"
    return {
        "id": row.id,
        "capture_id": row.capture_id,
        "trip_id": row.trip_id,
        "title": row.title,
        "note": row.note,
        "kind": row.kind,
        "due_at": row.due_at,
        "amount": float(row.amount) if row.amount is not None else None,
        "currency": row.currency,
        "recurrence": row.recurrence,
        "recurrence_timezone": row.recurrence_timezone,
        "reminder_offsets_minutes": row.reminder_offsets_minutes,
        "payment_state": payment_state,
        "status": row.status,
        "confirmed_at": row.confirmed_at,
        "completed_at": row.completed_at,
    }


def owned_capture(db: Session, user: User, capture_id: str) -> Capture:
    row = db.scalar(select(Capture).where(Capture.id == capture_id, Capture.owner_id == user.id))
    if row is None:
        raise HTTPException(status_code=404, detail="Saved item not found")
    return row


def owned_reminder(db: Session, user: User, reminder_id: str) -> Reminder:
    row = db.scalar(select(Reminder).where(Reminder.id == reminder_id, Reminder.owner_id == user.id))
    if row is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return row


def owned_trip(db: Session, user: User, trip_id: str) -> Trip:
    row = db.scalar(
        select(Trip)
        .options(selectinload(Trip.bookings), selectinload(Trip.checklist))
        .where(Trip.id == trip_id, Trip.owner_id == user.id)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return row


def valid_timezone(zone_name: str | None) -> None:
    if zone_name is None:
        return
    try:
        ZoneInfo(zone_name)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=422, detail="Choose a valid IANA time zone")


def trip_result(row: Trip) -> dict:
    bookings = sorted(row.bookings, key=lambda item: _as_utc(item.departure_at) if item.departure_at else datetime.max.replace(tzinfo=timezone.utc))
    checklist = sorted(row.checklist, key=lambda item: (item.completed, item.created_at))
    return {
        "id": row.id,
        "title": row.title,
        "destination": row.destination,
        "starts_at": row.starts_at,
        "ends_at": row.ends_at,
        "timezone": row.timezone,
        "notes": row.notes,
        "status": row.status,
        "bookings": [booking_result(item) for item in bookings],
        "checklist": [checklist_result(item) for item in checklist],
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def booking_result(row: TripBooking) -> dict:
    return {
        "id": row.id,
        "trip_id": row.trip_id,
        "capture_id": row.capture_id,
        "kind": row.kind,
        "title": row.title,
        "confirmation_reference": row.confirmation_reference,
        "departure_at": row.departure_at,
        "arrival_at": row.arrival_at,
        "departure_timezone": row.departure_timezone,
        "arrival_timezone": row.arrival_timezone,
        "from_location": row.from_location,
        "to_location": row.to_location,
        "notes": row.notes,
        "created_at": row.created_at,
    }


def checklist_result(row: TripChecklistItem) -> dict:
    return {
        "id": row.id,
        "trip_id": row.trip_id,
        "title": row.title,
        "category": row.category,
        "completed": row.completed,
        "completed_at": row.completed_at,
        "created_at": row.created_at,
    }


def safe_file_path(storage_key: str) -> Path:
    candidate = (UPLOAD_ROOT / storage_key).resolve()
    try:
        candidate.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return candidate


@app.get("/api/v1/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@app.post("/api/v1/auth/register", response_model=SessionOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = str(payload.email).strip().casefold()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    refresh_token, _ = create_refresh_session(db, user.id)
    audit(db, user.id, "account.registered")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    db.refresh(user)
    return {"access_token": create_access_token(user.id), "refresh_token": refresh_token, "user": user}


@app.post("/api/v1/auth/login", response_model=SessionOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = str(payload.email).strip().casefold()
    user = db.scalar(select(User).where(User.email == email))
    valid = verify_password(payload.password, user.password_hash) if user else False
    if user is None:
        verify_unknown_user(payload.password)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    refresh_token, _ = create_refresh_session(db, user.id)
    audit(db, user.id, "auth.login")
    db.commit()
    return {"access_token": create_access_token(user.id), "refresh_token": refresh_token, "user": user}


@app.post("/api/v1/auth/refresh", response_model=SessionOut)
def refresh_session(payload: RefreshIn, db: Session = Depends(get_db)):
    digest = hashlib.sha256(payload.refresh_token.encode("utf-8")).hexdigest()
    session = db.scalar(select(AuthSession).where(AuthSession.refresh_token_hash == digest).with_for_update())
    if session is None:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    now = utc_now()
    if session.revoked_at is not None:
        db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == session.family_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        audit(db, session.owner_id, "auth.refresh_reuse_detected", session.id)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    if session.expires_at <= now:
        session.revoked_at = now
        audit(db, session.owner_id, "auth.refresh_expired", session.id)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    user = db.get(User, session.owner_id)
    if user is None:
        session.revoked_at = now
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    session.revoked_at = now
    refresh_token, replacement = create_refresh_session(db, user.id, session.family_id)
    session.replaced_by_id = replacement.id
    audit(db, user.id, "auth.session_rotated", session.id)
    db.commit()
    return {"access_token": create_access_token(user.id), "refresh_token": refresh_token, "user": user}


@app.post("/api/v1/auth/logout", status_code=204)
def logout(payload: RefreshIn, db: Session = Depends(get_db)):
    digest = hashlib.sha256(payload.refresh_token.encode("utf-8")).hexdigest()
    session = db.scalar(select(AuthSession).where(AuthSession.refresh_token_hash == digest))
    if session is not None and session.revoked_at is None:
        session.revoked_at = utc_now()
        audit(db, session.owner_id, "auth.logout", session.id)
        db.commit()
    return None


@app.get("/api/v1/me", response_model=UserOut)
def get_me(user: User = Depends(current_user)):
    return user


@app.patch("/api/v1/me", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if payload.timezone is not None:
        try:
            ZoneInfo(payload.timezone)
        except ZoneInfoNotFoundError:
            raise HTTPException(status_code=422, detail="Choose a valid IANA time zone")
        user.timezone = payload.timezone
        audit(db, user.id, "account.timezone_updated")
    if payload.ai_external_consent is not None:
        user.ai_external_consent = payload.ai_external_consent
        audit(db, user.id, "privacy.external_ai_consent_updated")
    db.commit()
    db.refresh(user)
    return user


@app.get("/api/v1/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    now = datetime.now(timezone.utc)
    local_now = now.astimezone(ZoneInfo(user.timezone))
    reminders = list(
        db.scalars(
            select(Reminder)
            .where(Reminder.owner_id == user.id, Reminder.status == "active")
            .order_by(Reminder.due_at.asc())
            .limit(50)
        )
    )
    captures = list(
        db.scalars(
            select(Capture)
            .where(Capture.owner_id == user.id, Capture.status == "active")
            .order_by(Capture.created_at.desc())
            .limit(5)
        )
    )
    trips = list(
        db.scalars(
            select(Trip)
            .where(Trip.owner_id == user.id, Trip.status == "active", Trip.ends_at >= now)
            .order_by(Trip.starts_at.asc())
            .limit(3)
        )
    )
    due = [r for r in reminders if _as_utc(r.due_at).astimezone(ZoneInfo(user.timezone)).date() <= local_now.date()]
    return {
        "today": local_now.date().isoformat(),
        "needs_attention": [reminder_result(r) for r in due],
        "upcoming": [reminder_result(r) for r in reminders if _as_utc(r.due_at) > now][:8],
        "upcoming_trips": [trip_result(trip) for trip in trips],
        "recent_captures": [capture_result(c) for c in captures],
    }


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _next_due_at(due_at: datetime, recurrence: str, zone_name: str) -> datetime:
    zone = ZoneInfo(zone_name)
    local = _as_utc(due_at).astimezone(zone)
    if recurrence == "weekly":
        next_local = local + timedelta(days=7)
    elif recurrence == "monthly":
        month_index = local.year * 12 + local.month
        year, month = divmod(month_index, 12)
        month += 1
        day = min(local.day, calendar.monthrange(year, month)[1])
        next_local = local.replace(year=year, month=month, day=day)
    elif recurrence == "yearly":
        year = local.year + 1
        day = min(local.day, calendar.monthrange(year, local.month)[1])
        next_local = local.replace(year=year, day=day)
    else:
        return _as_utc(due_at)
    return next_local.astimezone(timezone.utc)


@app.post("/api/v1/captures", response_model=CaptureOut, status_code=201)
def create_capture(payload: CaptureCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = Capture(
        owner_id=user.id,
        title=payload.title.strip(),
        kind=payload.kind,
        body=payload.body.strip(),
        source_url=str(payload.source_url) if payload.source_url else None,
        ocr_status="not_needed",
    )
    db.add(row)
    db.flush()
    audit(db, user.id, "capture.created", row.id)
    db.commit()
    db.refresh(row)
    return capture_result(row)


@app.post("/api/v1/captures/upload", response_model=CaptureOut, status_code=201)
async def upload_capture(
    file: UploadFile = File(...),
    title: str | None = Form(default=None, max_length=160),
    note: str = Form(default="", max_length=50000),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if content.startswith(b"%PDF-"):
        try:
            await asyncio.to_thread(validate_pdf, content)
        except ValueError as exc:
            raise HTTPException(status_code=415, detail=str(exc))
        extension, media_type, capture_kind = "pdf", "application/pdf", "document"
    else:
        signatures = (
            (content.startswith(b"\x89PNG\r\n\x1a\n"), "png", "image/png"),
            (content.startswith(b"\xff\xd8\xff"), "jpg", "image/jpeg"),
            (len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP", "webp", "image/webp"),
        )
        matched = next((entry for entry in signatures if entry[0]), None)
        if matched is None:
            raise HTTPException(status_code=415, detail="Use a PDF, PNG, JPEG, or WebP file")
        _, extension, media_type = matched
        capture_kind = "screenshot"
        try:
            await asyncio.to_thread(validate_image, content)
        except ValueError as exc:
            raise HTTPException(status_code=415, detail=str(exc))
    capture_id = str(uuid4())
    relative_key = f"{user.id}/{capture_id}.{extension}"
    path = safe_file_path(relative_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    if capture_kind == "document":
        extracted_text, ocr_status = await asyncio.to_thread(read_pdf_text, path)
    else:
        extracted_text, ocr_status = await asyncio.to_thread(read_image_text, path)
    clean_name = Path((file.filename or "screenshot").replace("\\", "/")).name[:255]
    row = Capture(
        id=capture_id,
        owner_id=user.id,
        title=(title or Path(clean_name).stem or ("Saved document" if capture_kind == "document" else "Saved screenshot")).strip()[:160],
        kind=capture_kind,
        body=note.strip(),
        extracted_text=extracted_text,
        original_filename=clean_name,
        content_type=media_type,
        storage_key=relative_key,
        ocr_status=ocr_status,
    )
    db.add(row)
    audit(db, user.id, "capture.document_uploaded" if capture_kind == "document" else "capture.screenshot_uploaded", row.id)
    try:
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    db.refresh(row)
    return capture_result(row)


@app.get("/api/v1/captures", response_model=list[CaptureOut])
def list_captures(
    q: str = Query(default="", max_length=200),
    kind: str | None = Query(default=None, pattern="^(note|link|screenshot|document)$"),
    include_archived: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    statement = select(Capture).where(Capture.owner_id == user.id)
    if not include_archived:
        statement = statement.where(Capture.status == "active")
    if kind:
        statement = statement.where(Capture.kind == kind)
    if q.strip():
        term = f"%{q.strip()}%"
        statement = statement.where(
            or_(Capture.title.ilike(term), Capture.body.ilike(term), Capture.extracted_text.ilike(term), Capture.source_url.ilike(term))
        )
    rows = db.scalars(statement.order_by(Capture.created_at.desc()).limit(100))
    return [capture_result(row) for row in rows]


@app.get("/api/v1/captures/{capture_id}", response_model=CaptureOut)
def get_capture(capture_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return capture_result(owned_capture(db, user, capture_id))


@app.post("/api/v1/captures/{capture_id}/understand", response_model=CaptureOut)
async def understand_capture(capture_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = owned_capture(db, user, capture_id)
    source = "\n\n".join(part for part in (row.title, row.body, row.extracted_text, row.source_url or "") if part).strip()
    if not source:
        raise HTTPException(status_code=422, detail="Add text or upload a file before asking PINGO to understand it")
    try:
        analysis, provider = await analyze_memory(source, external_consent=user.ai_external_consent)
    except AIConsentRequired as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    row.category = analysis.category
    row.summary = analysis.summary
    row.entities = [entity.model_dump(mode="json") for entity in analysis.entities]
    row.date_suggestions = [suggestion.model_dump(mode="json") for suggestion in analysis.date_suggestions]
    row.ai_provider = provider
    row.ai_analyzed_at = utc_now()
    audit(db, user.id, f"ai.memory_understood_{provider}", row.id)
    db.commit()
    db.refresh(row)
    return capture_result(row)


@app.patch("/api/v1/captures/{capture_id}", response_model=CaptureOut)
def update_capture(
    capture_id: str,
    payload: CaptureUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    row = owned_capture(db, user, capture_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value.strip() if isinstance(value, str) and field in {"title", "body"} else value)
    audit(db, user.id, "capture.updated", row.id)
    db.commit()
    db.refresh(row)
    return capture_result(row)


@app.delete("/api/v1/captures/{capture_id}", status_code=204)
def delete_capture(capture_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = owned_capture(db, user, capture_id)
    storage_key = row.storage_key
    audit(db, user.id, "capture.deleted", row.id)
    db.delete(row)
    db.commit()
    if storage_key:
        safe_file_path(storage_key).unlink(missing_ok=True)
    return None


@app.get("/api/v1/captures/{capture_id}/attachment")
def get_attachment(capture_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = owned_capture(db, user, capture_id)
    if not row.storage_key:
        raise HTTPException(status_code=404, detail="This item has no attachment")
    path = safe_file_path(row.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Attachment is unavailable")
    return FileResponse(path, media_type=row.content_type or "application/octet-stream", filename=row.original_filename, content_disposition_type="inline")


@app.get("/api/v1/trips", response_model=list[TripOut])
def list_trips(include_archived: bool = False, db: Session = Depends(get_db), user: User = Depends(current_user)):
    statement = select(Trip).options(selectinload(Trip.bookings), selectinload(Trip.checklist)).where(Trip.owner_id == user.id)
    if not include_archived:
        statement = statement.where(Trip.status == "active")
    rows = db.scalars(statement.order_by(Trip.starts_at.asc()).limit(100))
    return [trip_result(row) for row in rows]


@app.post("/api/v1/trips", response_model=TripOut, status_code=201)
def create_trip(payload: TripCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    valid_timezone(payload.timezone)
    row = Trip(
        owner_id=user.id,
        title=payload.title.strip(),
        destination=payload.destination.strip(),
        starts_at=payload.starts_at.astimezone(timezone.utc),
        ends_at=payload.ends_at.astimezone(timezone.utc),
        timezone=payload.timezone,
        notes=payload.notes.strip(),
        status="active",
    )
    db.add(row)
    db.flush()
    audit(db, user.id, "trip.created", row.id)
    db.commit()
    db.refresh(row)
    return trip_result(row)


@app.get("/api/v1/trips/{trip_id}", response_model=TripOut)
def get_trip(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return trip_result(owned_trip(db, user, trip_id))


@app.patch("/api/v1/trips/{trip_id}", response_model=TripOut)
def update_trip(trip_id: str, payload: TripUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = owned_trip(db, user, trip_id)
    values = payload.model_dump(exclude_unset=True)
    valid_timezone(values.get("timezone"))
    start = values.get("starts_at", row.starts_at)
    end = values.get("ends_at", row.ends_at)
    if start is not None and end is not None and _as_utc(end) <= _as_utc(start):
        raise HTTPException(status_code=422, detail="Trip end must be after trip start")
    for field, value in values.items():
        if field in {"title", "destination", "notes"} and isinstance(value, str):
            value = value.strip()
        if field in {"starts_at", "ends_at"} and value is not None:
            value = value.astimezone(timezone.utc)
        setattr(row, field, value)
    audit(db, user.id, "trip.updated", row.id)
    db.commit()
    db.refresh(row)
    return trip_result(row)


@app.delete("/api/v1/trips/{trip_id}", status_code=204)
def delete_trip(trip_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = owned_trip(db, user, trip_id)
    audit(db, user.id, "trip.deleted", row.id)
    db.delete(row)
    db.commit()
    return None


@app.post("/api/v1/trips/{trip_id}/bookings", response_model=TripBookingOut, status_code=201)
def create_trip_booking(
    trip_id: str,
    payload: TripBookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    owned_trip(db, user, trip_id)
    if payload.capture_id:
        owned_capture(db, user, payload.capture_id)
    valid_timezone(payload.departure_timezone)
    valid_timezone(payload.arrival_timezone)
    row = TripBooking(
        owner_id=user.id,
        trip_id=trip_id,
        capture_id=payload.capture_id,
        kind=payload.kind,
        title=payload.title.strip(),
        confirmation_reference=payload.confirmation_reference.strip() if payload.confirmation_reference else None,
        departure_at=payload.departure_at.astimezone(timezone.utc) if payload.departure_at else None,
        arrival_at=payload.arrival_at.astimezone(timezone.utc) if payload.arrival_at else None,
        departure_timezone=payload.departure_timezone,
        arrival_timezone=payload.arrival_timezone,
        from_location=payload.from_location.strip() if payload.from_location else None,
        to_location=payload.to_location.strip() if payload.to_location else None,
        notes=payload.notes.strip(),
    )
    db.add(row)
    db.flush()
    audit(db, user.id, "trip.booking_created", row.id)
    db.commit()
    db.refresh(row)
    return booking_result(row)


@app.delete("/api/v1/trips/{trip_id}/bookings/{booking_id}", status_code=204)
def delete_trip_booking(
    trip_id: str,
    booking_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    owned_trip(db, user, trip_id)
    row = db.scalar(
        select(TripBooking).where(
            TripBooking.id == booking_id,
            TripBooking.trip_id == trip_id,
            TripBooking.owner_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Trip booking not found")
    audit(db, user.id, "trip.booking_deleted", row.id)
    db.delete(row)
    db.commit()
    return None


@app.post("/api/v1/trips/{trip_id}/checklist", response_model=TripChecklistOut, status_code=201)
def create_trip_checklist_item(
    trip_id: str,
    payload: TripChecklistCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    owned_trip(db, user, trip_id)
    row = TripChecklistItem(
        owner_id=user.id,
        trip_id=trip_id,
        title=payload.title.strip(),
        category=payload.category,
    )
    db.add(row)
    db.flush()
    audit(db, user.id, "trip.checklist_item_created", row.id)
    db.commit()
    db.refresh(row)
    return checklist_result(row)


@app.patch("/api/v1/trips/{trip_id}/checklist/{item_id}", response_model=TripChecklistOut)
def update_trip_checklist_item(
    trip_id: str,
    item_id: str,
    payload: TripChecklistUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    owned_trip(db, user, trip_id)
    row = db.scalar(
        select(TripChecklistItem).where(
            TripChecklistItem.id == item_id,
            TripChecklistItem.trip_id == trip_id,
            TripChecklistItem.owner_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    row.completed = payload.completed
    row.completed_at = utc_now() if payload.completed else None
    audit(db, user.id, "trip.checklist_item_updated", row.id)
    db.commit()
    db.refresh(row)
    return checklist_result(row)


@app.delete("/api/v1/trips/{trip_id}/checklist/{item_id}", status_code=204)
def delete_trip_checklist_item(
    trip_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    owned_trip(db, user, trip_id)
    row = db.scalar(
        select(TripChecklistItem).where(
            TripChecklistItem.id == item_id,
            TripChecklistItem.trip_id == trip_id,
            TripChecklistItem.owner_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    audit(db, user.id, "trip.checklist_item_deleted", row.id)
    db.delete(row)
    db.commit()
    return None


SEARCH_STOP_WORDS = {
    "a", "an", "and", "about", "all", "can", "did", "do", "everything", "find", "for", "from", "i", "in",
    "it", "last", "me", "my", "of", "on", "or", "please", "related", "saved", "show", "that", "the", "this",
    "to", "was", "week", "what", "where", "which", "with", "wanted", "you", "buy", "have", "has", "had",
}
SEARCH_SYNONYMS = {
    "hotel": ("hotel", "lodging", "accommodation"),
    "flight": ("flight", "airline", "boarding", "reservation"),
    "passport": ("passport", "travel document"),
    "bill": ("bill", "invoice", "payment"),
    "phone": ("phone", "telephone", "mobile", "contact"),
    "trip": ("trip", "travel", "vacation"),
    "warranty": ("warranty", "guarantee", "coverage"),
}


def _search_window(query: str, zone_name: str) -> tuple[datetime | None, datetime | None]:
    phrase = query.casefold()
    zone = ZoneInfo(zone_name)
    today = utc_now().astimezone(zone).date()
    if "last week" in phrase:
        this_monday = today - timedelta(days=today.weekday())
        return (
            datetime.combine(this_monday - timedelta(days=7), datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
            datetime.combine(this_monday, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
        )
    if "this week" in phrase:
        this_monday = today - timedelta(days=today.weekday())
        return (
            datetime.combine(this_monday, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
            datetime.combine(this_monday + timedelta(days=7), datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
        )
    if "last month" in phrase:
        this_month = today.replace(day=1)
        previous_month_end = this_month - timedelta(days=1)
        previous_month = previous_month_end.replace(day=1)
        return (
            datetime.combine(previous_month, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
            datetime.combine(this_month, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
        )
    if "this month" in phrase:
        this_month = today.replace(day=1)
        next_month = datetime(this_month.year + (this_month.month == 12), 1 if this_month.month == 12 else this_month.month + 1, 1).date()
        return (
            datetime.combine(this_month, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
            datetime.combine(next_month, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc),
        )
    return None, None


def _search_term_groups(query: str) -> list[tuple[str, ...]]:
    words = re.findall(r"[^\W_]+", query.casefold(), flags=re.UNICODE)
    groups = []
    for word in words:
        if word in SEARCH_STOP_WORDS or len(word) < 2:
            continue
        groups.append(SEARCH_SYNONYMS.get(word, (word,)))
    return groups[:8]


@app.get("/api/v1/search")
def search(q: str = Query(min_length=1, max_length=200), db: Session = Depends(get_db), user: User = Depends(current_user)):
    groups = _search_term_groups(q)
    date_from, date_to = _search_window(q, user.timezone)
    if not groups and not (date_from and date_to):
        groups = [(q.strip().casefold(),)]

    def match_fields(fields, group: tuple[str, ...]):
        conditions = []
        for synonym in group:
            term = f"%{synonym}%"
            conditions.extend(field.ilike(term) for field in fields)
        return or_(*conditions)

    capture_fields = (
        Capture.title,
        Capture.body,
        Capture.extracted_text,
        Capture.summary,
        Capture.source_url,
        Capture.category,
        cast(Capture.entities, String),
        cast(Capture.date_suggestions, String),
        Capture.kind,
    )
    capture_conditions = [match_fields(capture_fields, group) for group in groups]
    capture_statement = select(Capture).where(Capture.owner_id == user.id, Capture.status == "active", and_(*capture_conditions) if capture_conditions else true())
    if date_from and date_to:
        capture_statement = capture_statement.where(Capture.created_at >= date_from, Capture.created_at < date_to)
    captures = db.scalars(capture_statement.order_by(Capture.created_at.desc()).limit(50))

    reminder_fields = (Reminder.title, Reminder.note, cast(Reminder.amount, String), cast(Reminder.due_at, String), Reminder.kind)
    reminder_conditions = [match_fields(reminder_fields, group) for group in groups]
    reminder_statement = select(Reminder).where(Reminder.owner_id == user.id, Reminder.status == "active", and_(*reminder_conditions) if reminder_conditions else true())
    if date_from and date_to:
        reminder_statement = reminder_statement.where(Reminder.due_at >= date_from, Reminder.due_at < date_to)
    reminders = db.scalars(reminder_statement.order_by(Reminder.due_at.asc()).limit(50))
    trip_fields = (Trip.title, Trip.destination, Trip.notes)
    booking_fields = (TripBooking.title, TripBooking.confirmation_reference, TripBooking.from_location, TripBooking.to_location, TripBooking.notes)
    trip_conditions = [or_(match_fields(trip_fields, group), Trip.bookings.any(match_fields(booking_fields, group))) for group in groups]
    trip_statement = select(Trip).options(selectinload(Trip.bookings), selectinload(Trip.checklist)).where(Trip.owner_id == user.id, Trip.status == "active", and_(*trip_conditions) if trip_conditions else true())
    if date_from and date_to:
        trip_statement = trip_statement.where(Trip.starts_at >= date_from, Trip.starts_at < date_to)
    trips = db.scalars(trip_statement.order_by(Trip.starts_at.asc()).limit(50))
    return {
        "captures": [capture_result(row) for row in captures],
        "reminders": [reminder_result(row) for row in reminders],
        "trips": [trip_result(row) for row in trips],
    }


@app.post("/api/v1/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(payload: ReminderCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if payload.capture_id:
        owned_capture(db, user, payload.capture_id)
    if payload.trip_id:
        owned_trip(db, user, payload.trip_id)
        if payload.kind != "trip":
            raise HTTPException(status_code=422, detail="Trip reminders must use the trip reminder type")
    if payload.kind == "payment" and payload.amount is not None and not payload.currency:
        raise HTTPException(status_code=422, detail="Choose a currency for the amount")
    row = Reminder(
        owner_id=user.id,
        capture_id=payload.capture_id,
        trip_id=payload.trip_id,
        title=payload.title.strip(),
        note=payload.note.strip(),
        kind=payload.kind,
        due_at=payload.due_at.astimezone(timezone.utc),
        amount=payload.amount,
        currency=payload.currency,
        recurrence=payload.recurrence,
        recurrence_timezone=user.timezone,
        reminder_offsets_minutes=payload.reminder_offsets_minutes,
        status="active",
        confirmed_at=utc_now(),
    )
    db.add(row)
    db.flush()
    queue_reminder_notifications(db, row, user)
    audit(db, user.id, "reminder.created", row.id)
    db.commit()
    db.refresh(row)
    return reminder_result(row)


@app.get("/api/v1/reminders", response_model=list[ReminderOut])
def list_reminders(
    kind: str | None = Query(default=None, pattern="^(deadline|payment|appointment|trip)$"),
    include_completed: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    statement = select(Reminder).where(Reminder.owner_id == user.id)
    if not include_completed:
        statement = statement.where(Reminder.status == "active")
    if kind:
        statement = statement.where(Reminder.kind == kind)
    rows = db.scalars(statement.order_by(Reminder.due_at.asc()).limit(200))
    return [reminder_result(row) for row in rows]


@app.patch("/api/v1/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: str,
    payload: ReminderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    row = owned_reminder(db, user, reminder_id)
    changes = payload.model_dump(exclude_unset=True)
    amount = changes.get("amount", row.amount)
    currency = changes.get("currency", row.currency)
    if row.kind == "payment" and amount is not None and not currency:
        raise HTTPException(status_code=422, detail="Choose a currency for the amount")
    if row.kind != "payment" and ("amount" in changes or "currency" in changes):
        raise HTTPException(status_code=422, detail="Only payment reminders can have an amount or currency")
    if "title" in changes:
        row.title = changes["title"].strip()
    if "note" in changes:
        row.note = changes["note"].strip()
    if payload.due_at is not None:
        row.due_at = payload.due_at.astimezone(timezone.utc)
    if payload.status is not None:
        row.status = payload.status
    if payload.recurrence is not None:
        if payload.recurrence != "none" and row.kind != "payment":
            raise HTTPException(status_code=422, detail="Recurring schedules are supported for payments")
        row.recurrence = payload.recurrence
    if payload.reminder_offsets_minutes is not None:
        row.reminder_offsets_minutes = payload.reminder_offsets_minutes
    if "amount" in changes:
        row.amount = changes["amount"]
    if "currency" in changes:
        row.currency = changes["currency"]
    if row.status == "active":
        queue_reminder_notifications(db, row, user)
    else:
        db.execute(
            update(NotificationDelivery)
            .where(NotificationDelivery.reminder_id == row.id, NotificationDelivery.status == "pending")
            .values(status="cancelled", error_message="Reminder was archived")
        )
    audit(db, user.id, "reminder.updated", row.id)
    db.commit()
    db.refresh(row)
    return reminder_result(row)


@app.post("/api/v1/reminders/{reminder_id}/snooze", response_model=ReminderOut)
def snooze_reminder(
    reminder_id: str,
    minutes: int = Query(default=1440, ge=15, le=10080),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    row = owned_reminder(db, user, reminder_id)
    if row.status != "active":
        raise HTTPException(status_code=409, detail="Only active reminders can be snoozed")
    if row.recurrence != "none":
        raise HTTPException(status_code=422, detail="Snoozing a recurring payment is not supported yet")
    row.due_at = utc_now() + timedelta(minutes=minutes)
    queue_reminder_notifications(db, row, user)
    audit(db, user.id, "reminder.snoozed", row.id)
    db.commit()
    db.refresh(row)
    return reminder_result(row)


@app.post("/api/v1/reminders/{reminder_id}/complete", response_model=ReminderOut)
def complete_reminder(reminder_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = owned_reminder(db, user, reminder_id)
    now = utc_now()
    if row.kind == "payment":
        db.add(
            PaymentEvent(
                owner_id=user.id,
                reminder_id=row.id,
                due_at=_as_utc(row.due_at),
                paid_at=now,
                amount=row.amount,
                currency=row.currency,
            )
        )
        row.completed_at = now
        if row.recurrence != "none":
            row.due_at = _next_due_at(row.due_at, row.recurrence, row.recurrence_timezone)
            row.status = "active"
            queue_reminder_notifications(db, row, user)
        else:
            row.status = "completed"
            db.execute(
                update(NotificationDelivery)
                .where(NotificationDelivery.reminder_id == row.id, NotificationDelivery.status == "pending")
                .values(status="cancelled", error_message="Payment was recorded")
            )
    else:
        row.status = "completed"
        row.completed_at = now
        db.execute(
            update(NotificationDelivery)
            .where(NotificationDelivery.reminder_id == row.id, NotificationDelivery.status == "pending")
            .values(status="cancelled", error_message="Reminder was completed")
        )
    audit(db, user.id, "reminder.completed", row.id)
    db.commit()
    db.refresh(row)
    return reminder_result(row)


@app.get("/api/v1/payments/overview")
def payment_overview(db: Session = Depends(get_db), user: User = Depends(current_user)):
    now = utc_now()
    zone = ZoneInfo(user.timezone)
    local_now = now.astimezone(zone)
    month_start = datetime(local_now.year, local_now.month, 1, tzinfo=zone).astimezone(timezone.utc)
    if local_now.month == 12:
        next_month_local = datetime(local_now.year + 1, 1, 1, tzinfo=zone)
    else:
        next_month_local = datetime(local_now.year, local_now.month + 1, 1, tzinfo=zone)
    next_month = next_month_local.astimezone(timezone.utc)
    payments = list(
        db.scalars(
            select(Reminder)
            .where(Reminder.owner_id == user.id, Reminder.kind == "payment", Reminder.status == "active")
            .order_by(Reminder.due_at.asc())
            .limit(100)
        )
    )
    month_history = list(
        db.scalars(
            select(PaymentEvent)
            .where(PaymentEvent.owner_id == user.id, PaymentEvent.paid_at >= month_start, PaymentEvent.paid_at < next_month)
            .order_by(PaymentEvent.paid_at.desc())
            .limit(500)
        )
    )
    history = list(
        db.scalars(
            select(PaymentEvent)
            .where(PaymentEvent.owner_id == user.id)
            .order_by(PaymentEvent.paid_at.desc())
            .limit(100)
        )
    )
    totals: dict[str, dict[str, float | int]] = {}
    for event in month_history:
        code = event.currency or "—"
        bucket = totals.setdefault(code, {"amount": 0.0, "count": 0, "amount_count": 0})
        bucket["count"] += 1
        if event.amount is not None:
            bucket["amount"] += float(event.amount)
            bucket["amount_count"] += 1
    return {
        "month": local_now.strftime("%Y-%m"),
        "upcoming": [reminder_result(item) for item in payments],
        "month_paid": [
            {
                "currency": code,
                "amount": round(values["amount"], 2),
                "count": values["count"],
                "amount_count": values["amount_count"],
            }
            for code, values in sorted(totals.items())
        ],
        "history": [
            {
                "id": item.id,
                "reminder_id": item.reminder_id,
                "due_at": item.due_at,
                "paid_at": item.paid_at,
                "amount": float(item.amount) if item.amount is not None else None,
                "currency": item.currency,
            }
            for item in history
        ],
    }


@app.put("/api/v1/push/devices")
def register_push_device(payload: PushDeviceIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    matches = list(
        db.scalars(
            select(PushDevice).where(
                or_(PushDevice.device_id == payload.device_id, PushDevice.expo_push_token == payload.expo_push_token)
            )
        )
    )
    by_token = next((item for item in matches if item.expo_push_token == payload.expo_push_token), None)
    row = by_token or next((item for item in matches if item.device_id == payload.device_id), None)
    for duplicate in matches:
        if duplicate is row:
            continue
        if duplicate.owner_id != user.id:
            audit(db, duplicate.owner_id, "push.device_reassigned", duplicate.id)
        db.delete(duplicate)
    if row is None:
        row = PushDevice(
            owner_id=user.id,
            device_id=payload.device_id,
            expo_push_token=payload.expo_push_token,
            platform=payload.platform,
            show_details=payload.show_details,
            enabled=True,
        )
        db.add(row)
    else:
        row.owner_id = user.id
        row.device_id = payload.device_id
        row.expo_push_token = payload.expo_push_token
        row.platform = payload.platform
        row.show_details = payload.show_details
        row.enabled = True
        row.updated_at = utc_now()
    db.flush()
    for reminder in db.scalars(
        select(Reminder).where(Reminder.owner_id == user.id, Reminder.status == "active")
    ):
        queue_reminder_notifications(db, reminder, user)
    audit(db, user.id, "push.device_registered", row.id)
    db.commit()
    return {"registered": True, "device_id": row.device_id}


@app.delete("/api/v1/push/devices/{device_id}", status_code=204)
def unregister_push_device(device_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = db.scalar(select(PushDevice).where(PushDevice.owner_id == user.id, PushDevice.device_id == device_id))
    if row:
        audit(db, user.id, "push.device_unregistered", row.id)
        db.delete(row)
        db.commit()
    return None


@app.get("/api/v1/notifications/status")
def notification_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    devices = db.scalar(
        select(func.count(PushDevice.id)).where(PushDevice.owner_id == user.id, PushDevice.enabled.is_(True))
    ) or 0
    pending = db.scalar(
        select(func.count(NotificationDelivery.id)).where(
            NotificationDelivery.owner_id == user.id,
            NotificationDelivery.status == "pending",
        )
    ) or 0
    failed = db.scalar(
        select(func.count(NotificationDelivery.id)).where(
            NotificationDelivery.owner_id == user.id,
            NotificationDelivery.status == "failed",
        )
    ) or 0
    return {"push_devices": devices, "pending": pending, "failed": failed}


@app.get("/api/v1/me/export")
def export_account(db: Session = Depends(get_db), user: User = Depends(current_user)):
    captures = list(db.scalars(select(Capture).where(Capture.owner_id == user.id)))
    reminders = list(db.scalars(select(Reminder).where(Reminder.owner_id == user.id)))
    trips = list(
        db.scalars(
            select(Trip)
            .options(selectinload(Trip.bookings), selectinload(Trip.checklist))
            .where(Trip.owner_id == user.id)
        )
    )
    payment_events = list(
        db.scalars(select(PaymentEvent).where(PaymentEvent.owner_id == user.id).order_by(PaymentEvent.paid_at.asc()))
    )
    payload = {
        "format": "pingo-export-v1",
        "exported_at": utc_now().isoformat(),
        "user": {
            "email": user.email,
            "timezone": user.timezone,
            "ai_external_consent": user.ai_external_consent,
        },
        "captures": [capture_result(c) for c in captures],
        "reminders": [reminder_result(r) for r in reminders],
        "trips": [trip_result(trip) for trip in trips],
        "payment_history": [
            {
                "id": item.id,
                "reminder_id": item.reminder_id,
                "due_at": item.due_at,
                "paid_at": item.paid_at,
                "amount": float(item.amount) if item.amount is not None else None,
                "currency": item.currency,
            }
            for item in payment_events
        ],
        "attachments": [],
    }
    archive = io.BytesIO()
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for row in captures:
            if row.storage_key:
                path = safe_file_path(row.storage_key)
                if path.is_file():
                    name = f"attachments/{row.id}/{Path(row.original_filename or 'attachment').name}"
                    bundle.write(path, name)
                    payload["attachments"].append({"capture_id": row.id, "path": name})
        bundle.writestr("pingo-export.json", json.dumps(payload, default=_json_default, ensure_ascii=False, indent=2))
    audit(db, user.id, "account.exported")
    db.commit()
    archive.seek(0)
    return StreamingResponse(
        iter(lambda: archive.read(64 * 1024), b""),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="pingo-export.zip"'},
        background=BackgroundTask(archive.close),
    )


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


@app.delete("/api/v1/me", status_code=204)
def delete_account(db: Session = Depends(get_db), user: User = Depends(current_user)):
    user_id = user.id
    db.delete(user)
    db.commit()
    shutil.rmtree(UPLOAD_ROOT / user_id, ignore_errors=True)
    logger.info("Account deleted user_id=%s", user_id)
    return None
