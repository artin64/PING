# PINGO API

The API root is `/api/v1`. FastAPI publishes the generated contract at `/openapi.json` and interactive documentation at `/docs` while the server is running.

All routes except health, registration and login require `Authorization: Bearer <access_token>`. The owner is derived from the token; callers cannot submit an owner ID. Non-owned IDs return `404`.

## Authentication, profile and data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Database health probe |
| `POST` | `/auth/register` | Create an account and issue access and refresh tokens |
| `POST` | `/auth/login` | Sign in and create a refresh-token family |
| `POST` | `/auth/refresh` | Rotate a refresh token; reuse revokes its family |
| `POST` | `/auth/logout` | Revoke the supplied refresh token |
| `GET` | `/me` | Read profile and external-AI consent |
| `PATCH` | `/me` | Update IANA time zone or Gemini text-processing consent |
| `GET` | `/me/export` | Download JSON data and private attachments in a ZIP |
| `DELETE` | `/me` | Delete account records and the account's local attachment directory |

Passwords are 10–128 characters and hashed with Argon2. Access tokens last 15 minutes by default; refresh sessions last 30 days by default and are stored server-side as SHA-256 hashes. There is no email verification or password-reset endpoint yet.

## Memory and search

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/captures` | Save a note or URL |
| `POST` | `/captures/upload` | Save a PNG, JPEG, WebP image or PDF |
| `GET` | `/captures?q=&kind=` | List or search saved items |
| `GET` | `/captures/{id}` | Read one saved item |
| `POST` | `/captures/{id}/understand` | Run explicitly requested AI analysis |
| `PATCH` | `/captures/{id}` | Correct title/body or archive the item |
| `DELETE` | `/captures/{id}` | Delete an item and its attachment |
| `GET` | `/captures/{id}/attachment` | Read a private attachment after owner authorization |
| `GET` | `/search?q=` | Search captures, active reminders and active trips |
| `GET` | `/dashboard` | Return today's due reminders, upcoming reminders/trips and recent captures |

Uploads are capped at 20 MiB by default (`MAX_UPLOAD_BYTES`). Image signatures and decodability are checked; PDFs must open, be unencrypted, contain 1–100 pages and stay under the page-size limit. Image and PDF extraction runs locally in the API container. Search uses PostgreSQL/SQLite full-text-like `ILIKE` matching with simple query cleanup and synonym groups. It is not semantic/vector search.

AI is opt-in per action. `AI_PROVIDER=ollama` uses a local Ollama endpoint; `AI_PROVIDER=gemini` also requires `GEMINI_API_KEY` and explicit per-user consent. The endpoint sends extracted and user-entered text, not the binary original file. Pydantic validates the result, and entity/date source quotes must match the provided text. Date suggestions are never reminders until the user creates one.

## Reminders and payments

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/reminders` | Create a user-confirmed deadline, payment, appointment or trip reminder |
| `GET` | `/reminders?kind=&include_completed=` | List reminders |
| `PATCH` | `/reminders/{id}` | Reschedule or archive/unarchive; update recurrence and notice offsets |
| `POST` | `/reminders/{id}/snooze?minutes=1440` | Defer an active non-recurring reminder by 15 minutes to 7 days |
| `POST` | `/reminders/{id}/complete` | Complete a reminder or record a payment |
| `GET` | `/payments/overview` | List upcoming payments, monthly totals by currency and payment history |
| `PUT` | `/push/devices` | Register an Expo push token for the signed-in device |
| `DELETE` | `/push/devices/{device_id}` | Unregister a device |
| `GET` | `/notifications/status` | Return this account's registered devices and queue counts |

`due_at` must be ISO 8601 with an offset. The server stores UTC timestamps and keeps the user's IANA time zone for recurring payment wall-clock behavior. Recurrence supports `none`, `weekly`, `monthly` and `yearly`, for payments only. Notice offsets are minutes before the due time; up to five unique offsets are allowed.

Creating or changing a reminder queues deduplicated backend delivery rows. The worker submits Expo push messages and retries temporary provider errors. An Expo acceptance/receipt is not proof that a person saw a notification. The mobile app separately schedules up to 56 upcoming local notifications while permission is granted. Web notifications are not configured.

## Trips

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/trips?include_archived=` | List owned trips |
| `POST` | `/trips` | Create a trip with an IANA time zone and offset-aware date/times |
| `GET` | `/trips/{id}` | Read trip, bookings and checklist |
| `PATCH` | `/trips/{id}` | Update trip fields or archive it |
| `DELETE` | `/trips/{id}` | Delete the trip; linked saved captures remain in Memory |
| `POST` | `/trips/{id}/bookings` | Attach a saved capture and/or store booking details |
| `DELETE` | `/trips/{id}/bookings/{booking_id}` | Remove a booking from the trip |
| `POST` | `/trips/{id}/checklist` | Add a preparation item |
| `PATCH` | `/trips/{id}/checklist/{item_id}` | Complete or reopen an item |
| `DELETE` | `/trips/{id}/checklist/{item_id}` | Remove an item |

Flight departure/arrival timestamps must include offsets. IANA time-zone labels are validated. No live flight provider is connected.

## Validation and limits

Errors return a JSON `detail`. Common codes: `401` invalid session, `403` Gemini consent missing, `404` absent or non-owned record, `409` duplicate account, `413` oversized upload, `415` unsupported/corrupt file, `422` validation error, `429` request limit, and `503` unavailable AI provider.

The built-in limiter is process-local: 8 requests/minute for auth and AI routes, 180 requests/minute for other API routes. Replace it with shared infrastructure before running multiple API processes.
