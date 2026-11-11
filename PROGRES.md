# PROGRES · PINGO · JAVA 6

**Data:** 11.11.2026
**Repository:** https://github.com/artin64/PING

## Çka u implementua për JAVA 6

- JWT kërkon subject, skadim dhe session ID aktiv; refresh token-ët ruhen si hash, rrotullohen në përdorim, reuse revokon familjen dhe logout revokon menjëherë edhe access token-in.
- Migrimi Alembic `0006_tenant_rls` aktivizon dhe detyron RLS me policy për çdo tabelë me pronar; konfigurimi i prodhimit ndalet nëse roli i API-së/worker-it mund të anashkalojë RLS.
- API-ja përdor `pingo_api`; worker-i përdor `pingo_worker` me leje të kufizuara dhe kontekst RLS për një pronar. Funksionet e claim-it nxjerrin vetëm ID-të e punëve të njoftimeve.
- Capture, reminders, trips, bookings, checklist, payment history, push devices, audit logs, attachments dhe ZIP export trajtohen me kontrolle pronësie.
- Ngarkimet validohen sipas përmbajtjes dhe madhësisë, ruhen në folder privat sipas llogarisë me leje kufizuese dhe shërbehen vetëm pas autorizimit.
- Fshirja e llogarisë heq të dhënat përmes cascade, sesionet dhe folderin privat të dokumenteve.
- U shtua `backend/tests/test_java6_security.py` për dy llogari, revokim session-esh, CRUD ndërmjet pronarëve, upload privat, eksport ZIP, account deletion, audit logs dhe izolimin e worker-it.

## Verifikimi teknik

- `python -m compileall -q backend/app backend/migrations backend/tests` — kaluar.
- `docker compose config -q` — kaluar; shërbimet nuk u nisën.
- `git diff --check` — kaluar.
- `python -m pytest -q backend/tests` — 9 teste kaluan: autentikimi/sesionet, dy llogari, pagesat, udhëtimet, dokumentet private, eksporti, fshirja, worker-i dhe skema.
- `alembic upgrade head` — zinxhiri i plotë u aplikua në databazë SQLite të pastër; migrimi PostgreSQL-specific RLS nuk ekzekutohet në SQLite.
- Migrimi dhe startup guard për PostgreSQL/Supabase janë të përfshira; verifikimi i një instance të hostuar kërkon URL-të e ndara të roleve në konfigurimin e backend-it.

## Skema e lidhjes me Supabase

Kontrata e roleve dhe hapat janë te `docs/DEPLOYMENT.md`; auditimi teknik dhe kontrollet janë te `docs/SECURITY-JAVA6.md`. `DATABASE_URL` përdoret vetëm nga API-ja, `WORKER_DATABASE_URL` vetëm nga worker-i, ndërsa `MIGRATIONS_DATABASE_URL` vetëm për migrime.

## Misionet M0–M3

`AGENTS.md` ruan përmbledhjen e idesë; Today dhe Memory lexojnë të dhënat e llogarisë aktive përmes API-së; Add i ruan në PostgreSQL/Supabase sipas `DATABASE_URL`; dashboard rifreskohet pas krijimit të rekordit.
