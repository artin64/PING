# PINGO — Java 6 security implementation

PINGO i mban të gjetshme gjërat e rëndësishme dhe i ndihmon njerëzit të veprojnë në kohë.

## Security controls

| Area | Implemented control | Verification in this repository |
| --- | --- | --- |
| Authentication and sessions | Argon2 passwords; signed access JWTs bound to an active database session; hashed rotating refresh tokens; refresh-reuse revokes the family; logout revokes the session and its access JWT. | `backend/tests/test_java6_security.py` exercises rotation, reuse and revocation. |
| PostgreSQL roles and RLS | Runtime `pingo_api` and `pingo_worker` roles are required to be non-superuser and `NOBYPASSRLS`. Migration `0006_tenant_rls` enables and forces RLS and owner policies on user accounts, auth sessions, captures, reminders, payments, device registrations, notification records, trips, trip bookings, checklists and audit events. Production PostgreSQL URLs must request TLS. | Production API/worker startup checks role flags, forced RLS, policy coverage, TLS mode and exact worker grants. |
| API authorization and IDOR | Every authenticated request checks JWT subject, session id, active session, expiry and owner-scoped record lookup. Cross-owner record lookups return not found. | Two-account API regression tests cover captures, reminders, trips, bookings and checklists. |
| Export isolation | Export queries are owner-filtered; only that account's capture attachments are read into the ZIP. | Regression test checks archive content and attachment paths for two accounts. |
| Private uploads | Uploads validate signatures, decoded format and size; storage keys are generated from account and capture IDs; files use private directories and restrictive POSIX permissions; attachment reads are owner checked and `no-store`. | Regression tests perform a real upload, read by owner, deny another account and validate export contents. |
| Data integrity and migrations | Alembic migrations define foreign keys and deletion cascades. The RLS migration is PostgreSQL-specific and leaves SQLite available for development tests. | API regression tests use SQLite foreign keys; production startup fails closed if PostgreSQL RLS is not applied. |
| Notification worker | A `NOLOGIN` broker role owns narrowly scoped claim functions; worker gets only claim identifiers, then accesses notification, reminder and device rows in the specific owner's RLS context. Claiming uses row locks and stale leases; attempts are unique per delivery/device; retries are bounded and Expo receipts are tracked. | Production worker startup verifies the dedicated role, required grants, absence of capture/trip access, broker non-membership, and both claim functions. |
| Account privacy | Account deletion requires password confirmation, removes owned relational data through cascades, revokes sessions by deleting them, and removes the account's private upload directory. Sensitive actions are audit-recorded while the account exists. | Regression test verifies directory removal and access revocation after deletion. |
| Docker and secret handling | API and worker use separate database roles; migration URL is isolated in a one-shot service; secrets are environment-only; private upload volume; DB has no host port; API binding is configurable for host-only or trusted-phone development; Ollama is loopback-bound; health checks are configured. | Compose configuration can be inspected without starting services; no credentials are committed in `.env.example`. |

## Supabase role and migration contract

Set `DATABASE_URL` to a server-only `pingo_api` connection, `WORKER_DATABASE_URL` to a server-only `pingo_worker` connection, and `MIGRATIONS_DATABASE_URL` to the database migration administrator. The migration administrator creates the restricted `pingo_broker` and `pingo_auth_broker` roles and transfers ownership of the respective definer functions. Production startup rejects admin connections for API or worker runtime use.

`pingo_broker` is `NOLOGIN`, has no superuser/database/role-creation privileges, and receives access only to notification delivery, reminder and attempt tables needed by the claim routines. `pingo_auth_broker` separately receives read access to the users table for the limited email/password-hash lookup used during sign-in. Both roles are `NOLOGIN` and neither runtime account is a member. The worker's table policies still require `app.user_id`; the claim functions reveal only queued identifiers and set short database leases. The auth lookup function returns only the account ID and password hash required to verify a login, after which the API loads the user under that account's RLS scope.

## Verification scope

The automated API regression suite passes 9 tests using two independent accounts against an isolated SQLite database, and the full Alembic chain upgrades a clean SQLite database. PostgreSQL RLS behavior is enforced and checked by the PostgreSQL migration and production startup guard; SQLite does not emulate RLS. Run the migration and production guard using the actual target Supabase roles before treating a hosted Supabase deployment as verified. No document or AI provider credential is required for the automated API tests.

Run the test suite from `backend`:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
```
