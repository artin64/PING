# PINGO

**Never Miss What Matters.** PINGO is a private memory and follow-through app: save useful information, find it later, and turn dates you have reviewed into reminders.

## Current working product

- Expo SDK 58, React Native and TypeScript app with Today, Memory, Add, Money and Life navigation, light/dark system themes, email/password sign-in and rotating refresh sessions.
- Private notes, URLs, screenshots/photos and PDFs. Image text recognition uses local Tesseract; PDFs use local text extraction with optional OCR on scanned pages. OCR status is shown, and the original stays attached to the record.
- Optional, user-triggered memory analysis through local Ollama or consent-gated Gemini. Output is schema-validated, quotes must exist in the source, and suggested dates do not create reminders automatically.
- Owner-scoped full-text search across saved items, reminders and trips, with basic natural-language cleanup, synonyms and common relative date windows. This is conventional database search, not vector/semantic retrieval.
- User-confirmed deadlines, appointments and payment reminders; weekly/monthly/yearly recurring payments; manually recorded payment history; custom advance-notice intervals.
- Device-local notifications and a durable Expo Push worker. The app distinguishes local scheduling from a registered remote push device; system permissions and APNs/FCM/EAS setup still determine delivery.
- Trips with time-zone-aware dates, flight/stay/transport details, saved Memory attachments, preparation checklists and trip reminders. PINGO does not show live flight status.
- Private attachment reads, account-scoped records, audit events, account export and account deletion.
- PostgreSQL/Alembic, Docker Compose and an SQLite option for direct local API development.

## Start the development environment

1. Copy `.env.example` to `.env`. The included credentials are local-only defaults. Change them before sharing the development environment. To use hosted Supabase PostgreSQL, set `DATABASE_URL` in this server-side file; see [the Supabase setup](docs/DEPLOYMENT.md#supabase-postgresql-for-the-phone-demonstration).
2. From the repository root, start the API, database and notification worker:

   ```powershell
   docker compose up --build
   ```

   API: `http://localhost:8000` · API docs: `http://localhost:8000/docs`.

3. In another terminal, configure the mobile client and start Expo:

   ```powershell
   Copy-Item mobile/.env.example mobile/.env.local
   Set-Location mobile
   npm ci
   npx expo start
   ```

   Expo Go is sufficient for the basic capture and local development flows. Android emulators should use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`. For a physical phone, use the computer's LAN address and add the app's web origin to `CORS_ORIGINS` only when web access is needed.

### Optional local AI

Set `AI_PROVIDER=ollama` in `.env`, then start Ollama with the compose profile and download a model:

```powershell
docker compose --profile ai-local up --build
docker compose exec ollama ollama pull qwen2.5:3b
```

The first model download needs an internet connection and disk space. For Gemini, set a server-side `GEMINI_API_KEY`, choose `AI_PROVIDER=gemini`, and require the account holder to enable external AI processing in PINGO privacy settings. The original attachment is not sent by the analysis endpoint; extracted/user-entered text is.

### Run the API outside Docker

Use Python 3.13, create and activate a virtual environment in `backend`, install `requirements.txt`, then run:

```powershell
alembic upgrade head
uvicorn app.main:app --reload
```

Without `DATABASE_URL`, the API uses a local SQLite database. Tesseract and its English language data must be installed separately for image OCR; PDF text extraction works locally, and scanned PDF pages use Tesseract when available.

## Main journeys

1. **Capture:** Add a note or URL, take/import a photo, or select a PDF. The server confirms the save and reports the OCR/extraction result.
2. **Retrieve:** Search saved source text, reminders and trips in Memory. Search never generates a record that was not saved.
3. **Verify and act:** Ask the configured AI provider to analyze a saved item, check its source quotes, then enter a reminder yourself. No extracted date is activated automatically.
4. **Track payments:** Set a currency explicitly, choose recurrence and notice offsets, mark a payment paid, and review the recorded history.
5. **Plan a trip:** Add a trip from Life, attach a saved booking/document, add travel details and checklist items, and add a trip reminder.
6. **Control data:** Export the account ZIP or permanently delete the account from Settings.

## Configuration and docs

- `.env.example` — backend and Compose configuration.
- `mobile/.env.example` — public API address and optional EAS project ID.
- [docs/API.md](docs/API.md) — endpoint and data contract summary.
- [docs/PRODUCT.md](docs/PRODUCT.md) — product behavior and current scope.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — local setup and production-readiness requirements.
- [AGENTS.md](AGENTS.md) — product summary and engineering guardrails for agents.
- [docs/CLASS-CHECKOFF.md](docs/CLASS-CHECKOFF.md) — M0–M3 classroom check-off flows using real records.

## What this build does not claim

This repository is a functional development product, not a store-published commercial service. The UI is currently English-only; locale-aware date/time formatting and user-selected currency are supported, but Albanian/German translations, subscription purchases/entitlements, semantic/vector search, email/share-sheet ingestion, notification quiet hours, and a production object-storage adapter are not implemented. Production release still needs a managed deployment, EAS project and app identifiers, push credentials, privacy/support operations, and real Android/iOS verification. See [deployment notes](docs/DEPLOYMENT.md) for the full gate list.
