from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator, model_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class DeleteAccountIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    timezone: str
    ai_external_consent: bool

    model_config = ConfigDict(from_attributes=True)


class SessionOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=128)


class UserUpdate(BaseModel):
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    ai_external_consent: bool | None = None

    @model_validator(mode="after")
    def require_setting(self):
        if self.timezone is None and self.ai_external_consent is None:
            raise ValueError("Provide a setting to update")
        return self


class CaptureCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    kind: Literal["note", "link"] = "note"
    body: str = Field(default="", max_length=50000)
    source_url: HttpUrl | None = None

    @field_validator("title")
    @classmethod
    def capture_title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value


class CaptureUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = Field(default=None, max_length=50000)
    status: Literal["active", "archived"] | None = None

    @field_validator("title")
    @classmethod
    def capture_update_title_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Title cannot be blank")
        return value

    @model_validator(mode="after")
    def reject_null_capture_updates(self):
        invalid = [key for key in ("title", "body", "status") if key in self.model_fields_set and getattr(self, key) is None]
        if invalid:
            raise ValueError(f"These fields cannot be cleared: {', '.join(invalid)}")
        return self


class CaptureOut(BaseModel):
    id: str
    title: str
    kind: str
    body: str
    extracted_text: str
    category: str
    summary: str
    entities: list[dict]
    date_suggestions: list[dict]
    ai_provider: str | None
    source_url: str | None
    original_filename: str | None
    content_type: str | None
    ocr_status: str
    status: str
    attachment_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExtractedEntity(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: Literal["person", "organization", "location", "amount", "product", "reference", "other"]
    source_quote: str = Field(min_length=1, max_length=300)


class SuggestedDate(BaseModel):
    date: date
    label: str = Field(min_length=1, max_length=120)
    source_quote: str = Field(min_length=1, max_length=300)
    confidence: float = Field(ge=0, le=1)


class MemoryAnalysis(BaseModel):
    category: Literal["general", "finance", "travel", "document", "product", "address", "other"]
    summary: str = Field(max_length=1000)
    entities: list[ExtractedEntity] = Field(default_factory=list, max_length=20)
    date_suggestions: list[SuggestedDate] = Field(default_factory=list, max_length=12)


class ReminderCreate(BaseModel):
    capture_id: str | None = None
    trip_id: str | None = None
    title: str = Field(min_length=1, max_length=160)
    note: str = Field(default="", max_length=4000)
    kind: Literal["deadline", "payment", "appointment", "trip"] = "deadline"
    due_at: datetime
    amount: float | None = Field(default=None, ge=0, le=9999999999.99)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    recurrence: Literal["none", "weekly", "monthly", "yearly"] = "none"
    reminder_offsets_minutes: list[int] = Field(default_factory=lambda: [1440, 60], min_length=1, max_length=5)

    @field_validator("reminder_offsets_minutes")
    @classmethod
    def valid_reminder_offsets(cls, value: list[int]) -> list[int]:
        if any(offset < 0 or offset > 525600 for offset in value):
            raise ValueError("Reminder offsets must be between 0 and one year")
        if len(value) != len(set(value)):
            raise ValueError("Reminder offsets must be unique")
        return sorted(value, reverse=True)

    @field_validator("title")
    @classmethod
    def reminder_title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value

    @model_validator(mode="after")
    def recurrence_is_payment_only(self):
        if self.recurrence != "none" and self.kind != "payment":
            raise ValueError("Recurring schedules are supported for payments")
        return self

    @field_validator("due_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("due_at must include a timezone offset")
        return value

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    note: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None
    status: Literal["active", "archived"] | None = None
    recurrence: Literal["none", "weekly", "monthly", "yearly"] | None = None
    amount: float | None = Field(default=None, ge=0, le=9999999999.99)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    reminder_offsets_minutes: list[int] | None = Field(default=None, min_length=1, max_length=5)

    @field_validator("reminder_offsets_minutes")
    @classmethod
    def valid_reminder_offsets(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return value
        if any(offset < 0 or offset > 525600 for offset in value):
            raise ValueError("Reminder offsets must be between 0 and one year")
        if len(value) != len(set(value)):
            raise ValueError("Reminder offsets must be unique")
        return sorted(value, reverse=True)

    @field_validator("due_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("due_at must include a timezone offset")
        return value

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str | None) -> str | None:
        return value.strip().upper() if value else value

    @field_validator("title")
    @classmethod
    def reminder_update_title_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Title cannot be blank")
        return value

    @model_validator(mode="after")
    def reject_null_reminder_updates(self):
        invalid = [key for key in ("title", "note", "due_at", "status", "recurrence", "reminder_offsets_minutes") if key in self.model_fields_set and getattr(self, key) is None]
        if invalid:
            raise ValueError(f"These fields cannot be cleared: {', '.join(invalid)}")
        return self


class ReminderOut(BaseModel):
    id: str
    capture_id: str | None
    trip_id: str | None
    title: str
    note: str
    kind: str
    due_at: datetime
    amount: float | None
    currency: str | None
    recurrence: str
    recurrence_timezone: str
    reminder_offsets_minutes: list[int]
    payment_state: Literal["upcoming", "due", "overdue"] | None
    status: str
    confirmed_at: datetime | None
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ReminderCompleteIn(BaseModel):
    due_at: datetime

    @field_validator("due_at")
    @classmethod
    def completion_occurrence_has_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("due_at must include a timezone offset")
        return value


class PaymentEventOut(BaseModel):
    id: str
    reminder_id: str
    due_at: datetime
    paid_at: datetime
    amount: float | None
    currency: str | None

    model_config = ConfigDict(from_attributes=True)


class PushDeviceIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=100)
    expo_push_token: str = Field(min_length=20, max_length=255)
    platform: Literal["android", "ios"]
    show_details: bool = False

    @field_validator("expo_push_token")
    @classmethod
    def valid_expo_token(cls, value: str) -> str:
        if not (value.startswith("ExponentPushToken[") or value.startswith("ExpoPushToken[")) or not value.endswith("]"):
            raise ValueError("Register a valid Expo push token")
        return value


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    destination: str = Field(min_length=1, max_length=160)
    starts_at: datetime
    ends_at: datetime
    timezone: str = Field(min_length=1, max_length=64)
    notes: str = Field(default="", max_length=5000)

    @field_validator("title", "destination")
    @classmethod
    def trip_text_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank")
        return value

    @field_validator("starts_at", "ends_at")
    @classmethod
    def trip_times_have_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Trip times must include a timezone offset")
        return value

    @model_validator(mode="after")
    def trip_range_is_valid(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("Trip end must be after trip start")
        return self


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    destination: str | None = Field(default=None, min_length=1, max_length=160)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    notes: str | None = Field(default=None, max_length=5000)
    status: Literal["active", "archived"] | None = None

    @field_validator("title", "destination")
    @classmethod
    def optional_trip_text_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("This field cannot be blank")
        return value

    @field_validator("starts_at", "ends_at")
    @classmethod
    def optional_trip_times_have_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Trip times must include a timezone offset")
        return value

    @model_validator(mode="after")
    def reject_null_trip_updates(self):
        invalid = [key for key in ("title", "destination", "starts_at", "ends_at", "timezone", "notes", "status") if key in self.model_fields_set and getattr(self, key) is None]
        if invalid:
            raise ValueError(f"These fields cannot be cleared: {', '.join(invalid)}")
        return self


class TripBookingCreate(BaseModel):
    kind: Literal["flight", "hotel", "transport", "other"]
    title: str = Field(min_length=1, max_length=160)
    capture_id: str | None = None
    confirmation_reference: str | None = Field(default=None, max_length=120)
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    departure_timezone: str | None = Field(default=None, max_length=64)
    arrival_timezone: str | None = Field(default=None, max_length=64)
    from_location: str | None = Field(default=None, max_length=160)
    to_location: str | None = Field(default=None, max_length=160)
    notes: str = Field(default="", max_length=4000)

    @field_validator("title")
    @classmethod
    def booking_title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("departure_at", "arrival_at")
    @classmethod
    def booking_times_have_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Booking times must include a timezone offset")
        return value

    @model_validator(mode="after")
    def booking_times_are_ordered(self):
        if self.departure_at and self.arrival_at and self.arrival_at < self.departure_at:
            raise ValueError("Booking arrival must be after departure")
        if self.kind == "flight" and self.departure_at and not self.departure_timezone:
            raise ValueError("Add the departure time zone for a flight")
        if self.arrival_at and not self.arrival_timezone:
            raise ValueError("Add the arrival time zone when an arrival time is provided")
        return self


class TripChecklistCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    category: Literal["documents", "booking", "packing", "preparation", "other"] = "preparation"

    @field_validator("title")
    @classmethod
    def checklist_title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title cannot be blank")
        return value


class TripChecklistUpdate(BaseModel):
    completed: bool


class TripBookingOut(BaseModel):
    id: str
    trip_id: str
    capture_id: str | None
    kind: str
    title: str
    confirmation_reference: str | None
    departure_at: datetime | None
    arrival_at: datetime | None
    departure_timezone: str | None
    arrival_timezone: str | None
    from_location: str | None
    to_location: str | None
    notes: str
    created_at: datetime


class TripChecklistOut(BaseModel):
    id: str
    trip_id: str
    title: str
    category: str
    completed: bool
    completed_at: datetime | None
    created_at: datetime


class TripOut(BaseModel):
    id: str
    title: str
    destination: str
    starts_at: datetime
    ends_at: datetime
    timezone: str
    notes: str
    status: str
    bookings: list[TripBookingOut]
    checklist: list[TripChecklistOut]
    created_at: datetime
    updated_at: datetime

