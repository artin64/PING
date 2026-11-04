# Setup and production-readiness

## Local development

The Compose file starts PostgreSQL, the FastAPI API, the private upload volume, an Expo notification worker, and an optional Ollama service. Copy `.env.example` to `.env`, then run `docker compose up --build`. The API applies Alembic migrations before serving requests; use `/api/v1/health` and `/docs` to inspect it.

For Expo, copy `mobile/.env.example` to `mobile/.env.local`, set `EXPO_PUBLIC_API_URL` to an address reachable from the device, and run `npm ci` plus `npx expo start` from `mobile`. Android emulators normally reach the host as `10.0.2.2`; a physical phone uses the development computer's LAN address. If using web, add the exact web origin to `CORS_ORIGINS`.

## Supabase PostgreSQL for the phone demonstration

PINGO's mobile app talks to its authenticated FastAPI backend; the backend owns the database connection. This lets the app read and save real records in a Supabase-hosted PostgreSQL database while keeping the database password off the phone. Do not add a Supabase admin or service-role key to Expo configuration.

1. In the Supabase project dashboard, open **Connect** and copy the PostgreSQL connection string. Use the direct connection when the development computer supports the project's IP version; otherwise use the **Session pooler** connection. Do not use transaction-pooler mode for this long-running SQLAlchemy backend.
2. In the project-root `.env`, set `DATABASE_URL` to that server-only connection string, changing the prefix from `postgresql://` to `postgresql+psycopg://` and adding `?sslmode=require`. Percent-encode reserved characters in the database password. Keep `PINGO_ENVIRONMENT=development` for the class demo.
3. Start the API and notification worker with `docker compose up --build`. Compose passes the same database URL to both processes. The API runs Alembic migrations before serving requests. The local Postgres container still starts as part of the development Compose stack but is not the API's active database when `DATABASE_URL` is set.
4. In `mobile/.env.local`, set `EXPO_PUBLIC_API_URL` to the API's LAN address so the phone can reach the computer. This is an API address, not a Supabase credential.
5. Create or sign into a PINGO account, save a note from **Add**, then open **Memory**. The screen reads the saved record from the backend. Force-close the app, reopen it, sign into the same account if needed, and confirm the note remains.

The app does not connect to Supabase directly. This is deliberate: the current PINGO account system and owner-scoped FastAPI routes remain responsible for authorization, while the hosted PostgreSQL connection stays on the server. Use a dedicated database password and rotate any credential that has been shared in chat or source control.

Local AI is optional. Set `AI_PROVIDER=ollama`, start Compose with `--profile ai-local`, and pull the configured model into Ollama. For Gemini, put the key only in the server `.env` and keep user consent disabled until the person explicitly opts in. Never put the provider key in an `EXPO_PUBLIC_` variable.

## Production requirements before accepting customer data

The included Compose deployment is for development. Complete and verify these items before a public launch:

1. **Runtime and network:** Deploy behind TLS with a managed API ingress, secure headers, origin policy, request-size limits and health monitoring. Replace the process-local rate limiter with Redis, a gateway, or equivalent shared control before scaling API replicas.
2. **Secrets and authentication:** Set `PINGO_ENVIRONMENT=production`; configure a unique randomly generated `JWT_SECRET` of at least 32 characters; use a secrets manager; add email verification, password reset, session/device management and abuse monitoring.
3. **Database:** Use managed PostgreSQL, private networking, encrypted connections/storage, automated backups, tested restore, migration review and a single controlled migration job per release.
4. **Attachments:** Replace the local Docker volume with private object storage, encrypted at rest, policy-scoped keys, authenticated access or short-lived signed URLs, malware/content scanning and idempotent deletion jobs. The current upload limit defaults to 20 MiB.
5. **Notifications:** Create an Expo/EAS project, assign Android package and iOS bundle identifiers, configure APNs/FCM credentials and production API URLs, build a development client, then test delivery and receipt/retry behavior on real devices. Expo Go is not the production push target. Maintain a local scheduling fallback and disclose OS permission limits.
6. **Mobile releases:** Set stable app identifiers, configure EAS build/submit profiles and signing credentials, privacy manifests/store declarations, deep links and crash reporting. Test permission prompts, camera, document picker, background/closed-app notifications and low-end/small-screen layouts on Android and iOS.
7. **Privacy and operations:** Publish privacy/retention terms, obtain required legal review, define data residency, external AI processor terms and consent withdrawal, support/incident workflows, deletion verification, audit retention and backup expiration.
8. **Commercial and localization:** Implement entitlement verification and restore/cancellation handling before charging; wire pricing through a subscription provider and app stores. Add reviewed Albanian and German translations and regional date/currency/time-zone tests.
9. **Quality:** Add automated backend integration/authorization/migration tests, mobile journey tests, dependency and secret scanning, observability and load testing. The current workspace has not run backend integration tests or physical-device tests.

## Data and security behavior

Every protected lookup derives the owner from a short-lived access token. Refresh tokens are stored hashed and rotate on use. Passwords use Argon2. Uploads use private file paths and signature checks; the original filename is never a storage path. Attachment endpoints check ownership. The account export contains captures, reminders, trips, payment history and original attachments. Account deletion removes database records and then the local attachment directory.

These are application-level controls for the included local setup, not a completed security certification. Add independent review, encryption-at-rest guarantees, backup deletion policy and shared deployment controls before production use.

## Build validation in this workspace

The repository can be linted/typechecked and Expo can produce a static web export locally. A successful bundle does not prove API/database operations, APNs/FCM delivery, store signing or correct behavior on real devices. Docker Engine, Python API runtime and attached Android/iOS devices were not available during this implementation session, so those verification steps remain open.
