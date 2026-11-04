# Check-off i telefonit — M0 deri M3

Ky dokument lidh kërkesat e ushtrimit me rrjedhat reale të PINGO-s. Ekranet përdorin llogarinë dhe të dhënat e përdoruesit, jo të dhëna shembull.

## M0 · Konteksti i agjentit

- **Fajlli:** [`../AGENTS.md`](../AGENTS.md).
- **Përmbledhja e idesë:** PINGO i mban të gjetshme gjërat e rëndësishme dhe i ndihmon njerëzit të veprojnë në kohë.
- Agjenti duhet ta lexojë këtë fajll para ndryshimeve që prekin produktin, të ruajë strukturën Expo/FastAPI dhe të mos sajojë të dhëna.

## M1 · Lexo një rekord real nga Supabase dhe shfaqe në telefon

- **Rruga e të dhënave:** `Memory` → `GET /api/v1/captures` → FastAPI → PostgreSQL i Supabase-it përmes `DATABASE_URL`.
- **Krijimi i rekordit:** `Add` → `POST /api/v1/captures` → e njëjta bazë e të dhënave.
- URL-ja private e PostgreSQL konfigurohet vetëm te backend-i në `.env`; nuk vendoset në `mobile/.env.local` ose në bundle të aplikacionit.
- Konfigurimi dhe demonstrimi: [DEPLOYMENT.md — Supabase PostgreSQL](DEPLOYMENT.md#supabase-postgresql-for-the-phone-demonstration).

## M2 · Shto nga telefoni, mbylle dhe rihape

1. Në telefon kyçu në PINGO dhe ruaj një shënim me titull unik përmes **Add → Note → Save Note**.
2. Prit konfirmimin e ruajtjes dhe hape **Memory**; shënimi duhet të shfaqet nga përgjigjja e API-së.
3. Mbylle plotësisht aplikacionin, hape përsëri dhe kyçu sërish në të njëjtën llogari nëse kërkohet.
4. Hape **Memory**. I njëjti shënim duhet të jetë ende aty, sepse ruhet në PostgreSQL të backend-it. Sesioni celular ruhet në SecureStore në iOS/Android.

## M3 · Ekrani kryesor me të dhëna reale

- **Ekrani:** `Today` në [`mobile/src/app/(app)/index.tsx`](../mobile/src/app/%28app%29/index.tsx).
- **Burimi:** `GET /api/v1/dashboard`, me kujtesat e fundit, afatet/pagesat për vëmendje dhe udhëtimet e ardhshme të llogarisë aktive.
- Për demonstrim, krijo një kujtesë ose përkujtesë me **Add**, kthehu në **Today** dhe trego rekordin që sapo u ruajt. Kur llogaria nuk ka përkujtesa, shfaqet gjendja bosh; nuk shfaqen detyra të sajuara.

## Kufiri mes kodit dhe demonstrimit

Kodi përmban rrugët reale të ruajtjes, leximit dhe rifreskimit. Kriteret që kërkojnë **telefon fizik**, **Supabase të konfiguruar** dhe **mbyllje/ririhapje të aplikacionit** duhen demonstruar në pajisje pas konfigurimit të `.env` dhe `mobile/.env.local`; kjo dosje nuk i paraqet si testime fizike të kryera.
