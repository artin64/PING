# Setup and production-readiness

## Local development

The Compose file starts PostgreSQL, a one-shot Alembic migration service, the FastAPI API, the private upload volume, an Expo notification worker, and an optional Ollama service. Copy `.env.example` to `.env`, then run `docker compose up --build`. Migrations complete before the API and worker start; use `/api/v1/health` and `/docs` to inspect the API.

For Expo, copy `mobile/.env.example` to `mobile/.env.local`, set `EXPO_PUBLIC_API_URL` to an address reachable from the device, and run `npm ci` plus `npx expo start` from `mobile`. Android emulators normally reach the host as `10.0.2.2`; a physical phone uses the development computer's LAN address and needs `PINGO_API_BIND_HOST=0.0.0.0` in the project `.env`. For host-only development, bind to `127.0.0.1`. If using web, add the exact web origin to `CORS_ORIGINS`.

## Supabase PostgreSQL for the phone demonstration

PINGO's mobile app talks to its authenticated FastAPI backend; the backend owns the database connection. This lets the app read and save real records in a Supabase-hosted PostgreSQL database while keeping the database password off the phone. Do not add a Supabase admin or service-role key to Expo configuration.

1. In the Supabase project dashboard, open **Connect** and copy the PostgreSQL connection string. Use the direct connection when the development computer supports the project's IP version; otherwise use the **Session pooler** connection. Do not use transaction-pooler mode for this long-running SQLAlchemy backend.
2. As the database administrator, create dedicated `pingo_api` and `pingo_worker` login roles. Both must be `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`. Give each a unique password and only `CONNECT` to the app database plus `USAGE` on `public`. The Alembic migration configures the table grants and creates the non-login `pingo_broker` role with narrowly scoped grants. Do not make the API or worker a member of the broker role.

   ```sql
   CREATE ROLE pingo_api LOGIN PASSWORD '<unique-api-password>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
   CREATE ROLE pingo_worker LOGIN PASSWORD '<unique-worker-password>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
   GRANT CONNECT ON DATABASE postgres TO pingo_api, pingo_worker;
   GRANT USAGE ON SCHEMA public TO pingo_api, pingo_worker;
   ```

   Run this once in the Supabase SQL editor using the project's database administrator connection. Use the actual database name if it is not `postgres`.
3. In the project-root `.env`, set three server-only PostgreSQL URLs: `DATABASE_URL` using `pingo_api`, `WORKER_DATABASE_URL` using `pingo_worker`, and `MIGRATIONS_DATABASE_URL` using the database administrator. Change the URL prefix to `postgresql+psycopg://`, add `?sslmode=require`, and percent-encode reserved password characters. Keep `PINGO_ENVIRONMENT=development` for the classroom demo. Never use a service-role/admin URL as the API runtime URL.
4. Start the API and notification worker with `docker compose up --build`. The one-shot migration service applies Alembic before the API and worker start. The local Postgres container still starts as part of the development Compose stack but is not the API's active database when hosted URLs are set. Configure the worker URL separately so notifications also use the hosted database.
5. In `mobile/.env.local`, set `EXPO_PUBLIC_API_URL` to the API's LAN address so the phone can reach the computer. This is an API address, not a Supabase credential.
6. Create or sign into a PINGO account, save a note from **Add**, then open **Memory**. The screen reads the saved record from the backend. Force-close the app, reopen it, sign into the same account if needed, and confirm the note remains.

The app does not connect to Supabase directly. The current PINGO account system and owner-scoped FastAPI routes remain responsible for authorization, while hosted PostgreSQL URLs stay on the server. Migration `0006_tenant_rls` enables and forces PostgreSQL RLS on tenant tables. Production API/worker startup rejects superuser or `BYPASSRLS` runtime roles and checks the tenant policies and least-privilege worker grants. The worker obtains due notification identifiers through restricted database functions, then reads each record inside that owner's RLS scope.

Local AI is optional. Set `AI_PROVIDER=ollama`, start Compose with `--profile ai-local`, and pull the configured model into Ollama. For Gemini, put the key only in the server `.env` and keep user consent disabled until the person explicitly opts in. Never put the provider key in an `EXPO_PUBLIC_` variable.

## Production requirements before accepting customer data

The included Compose deployment is for development. Complete and verify these items before a public launch:

1. **Runtime and network:** Deploy behind TLS with a managed API ingress, secure headers, origin policy, request-size limits and health monitoring. Replace the process-local rate limiter with Redis, a gateway, or equivalent shared control before scaling API replicas.
2. **Secrets and authentication:** Set `PINGO_ENVIRONMENT=production`; configure a unique randomly generated `JWT_SECRET` of at least 32 characters, TLS-required PostgreSQL URLs and unique API/worker database passwords; use a secrets manager; add email verification, password reset and abuse monitoring.
3. **Database:** Use managed PostgreSQL, private networking, encrypted connections/storage, automated backups, tested restore, migration review and a single controlled migration job per release.
4. **Attachments:** Replace the local Docker volume with private object storage, encrypted at rest, policy-scoped keys, authenticated access or short-lived signed URLs, malware/content scanning and idempotent deletion jobs. The current upload limit defaults to 20 MiB.
5. **Notifications:** Create an Expo/EAS project, assign Android package and iOS bundle identifiers, configure APNs/FCM credentials and production API URLs, build a development client, then test delivery and receipt/retry behavior on real devices. Expo Go is not the production push target. Maintain a local scheduling fallback and disclose OS permission limits.
6. **Mobile releases:** Set stable app identifiers, configure EAS build/submit profiles and signing credentials, privacy manifests/store declarations, deep links and crash reporting. Test permission prompts, camera, document picker, background/closed-app notifications and low-end/small-screen layouts on Android and iOS.
7. **Privacy and operations:** Publish privacy/retention terms, obtain required legal review, define data residency, external AI processor terms and consent withdrawal, support/incident workflows, deletion verification, audit retention and backup expiration.
8. **Commercial and localization:** Implement entitlement verification and restore/cancellation handling before charging; wire pricing through a subscription provider and app stores. Add reviewed Albanian and German translations and regional date/currency/time-zone tests.
9. **Quality:** The included backend suite passes 9 SQLite API/migration tests covering two-account authorization, uploads, export and deletion. SQLite does not emulate RLS; apply and verify the PostgreSQL migration and startup guard using target Supabase roles, then run mobile journey tests, dependency/secret scanning, observability and load testing before accepting customer data.

## Data and security behavior

Every protected lookup derives the owner from a short-lived access token. Refresh tokens are stored hashed and rotate on use. Passwords use Argon2. Uploads use private file paths and signature checks; the original filename is never a storage path. Attachment endpoints check ownership. The account export contains captures, reminders, trips, payment history and original attachments. Account deletion removes database records and then the local attachment directory.

These controls do not constitute an independent security certification. Managed hosting, at-rest encryption settings, backup deletion policy, shared rate limiting and independent review must be configured and checked for the target deployment.

## Build validation in this workspace

`backend/tests` contains reproducible API authorization and private-file regression tests. SQLite is used for these fast API tests; it does not emulate PostgreSQL RLS. Run a migration and two-role isolation check against the intended Supabase project before describing that hosted project as verified. A successful app build does not prove APNs/FCM delivery, store signing or behavior on real devices.
