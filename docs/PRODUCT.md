# PINGO product behavior

**Promise:** Never Miss What Matters. PINGO keeps personal information retrievable and helps a person follow through on dates they have checked and confirmed.

## Follow-through lifecycle

**Capture → Understand → Verify → Act → Follow up → Complete.** The current app supports each step as a small, explicit action:

- Capture a note, URL, screenshot/photo or PDF into the personal archive without choosing a category first.
- Extract local OCR/text and optionally ask a configured AI provider for a summary, category, quoted entities and date suggestions.
- Review source text and source quotes. PINGO filters extracted dates/entities unless the quoted text exists in the saved source.
- The user chooses whether to create a payment, deadline, appointment or trip reminder. AI does not activate a date or create a payment automatically.
- Reminders and recurring payments remain in the active list until completed or archived. Marking a payment paid creates a history event and advances a recurring schedule.
- Active reminders can be edited, rescheduled or snoozed. Recurring payments can be edited/rescheduled, but snoozing them is intentionally not available because it would otherwise shift the recurrence anchor.
- Trips group time-zone-aware dates, booking details, saved document references, preparation items and trip reminders.

## Product principles

- Save first; classification can follow.
- Keep the original attachment and OCR text separate from user notes.
- Do not invent prices, amounts, expiry dates, warranties, travel status or reminders.
- Keep externally processed AI off until the account holder opts in; expose analysis as an intentional action.
- Use the user's selected currency; never assume EUR and never show fabricated income, balances or a safe-to-spend number.
- Keep notification status honest: a queued job, Expo acceptance and OS delivery are different states.
- Keep the main navigation at Today, Memory, Add, Money and Life. Trip management lives within Life.
- Treat accessibility labels, readable contrast, touch targets, empty/loading/error states and light/dark palettes as core product behavior.

## Current scope

Implemented: memory capture/retrieval, local OCR and PDF text extraction, AI abstraction with source checks, recurring payment records, local and Expo push scheduling paths, trip organization, account export/deletion, and user-scoped API routes.

Still outside this build: operating-system share-sheet ingestion, automatic email import, OCR beyond English language data, semantic/vector retrieval, notification quiet hours, three ranked suggested actions, income/expense budgets and purchase simulation, subscription purchase/entitlement verification, app translations, email recovery, and live flight data.

The first shipped value should be judged by capture speed, retrieval accuracy, source correction rate, reminder reliability and follow-through completion—not the number of AI screens.
