# PROGRES · PINGO · M0–M3

**Data:** 04.11.2026
**Repository:** https://github.com/artin64/PING

## Çka punon në kod

- **M0 — Konteksti:** `AGENTS.md` përmbledh idenë nga `EKIPI.md`, `BISEDAT.md` dhe `HARTA.md`, si dhe rregullat e produktit.
- **M1 — Lexo:** rruga Memory → `GET /api/v1/captures` → detaj sipas ID-së përdor rekordet e llogarisë aktive; burimi bëhet Supabase kur `DATABASE_URL` konfigurohet.
- **M2 — Shto dhe ruaj:** formulari Add dërgon shënime/lidhje te `POST /api/v1/captures`; API-ja i lidh me përdoruesin dhe kryen `commit`; rihapja i lexon sërish përmes API-së.
- **M3 — Kryefaqja:** Today merr përmbledhjen e llogarisë nga `GET /api/v1/dashboard` dhe rifreskohet pas krijimit të rekordit.
- Backend-i ka migrime Alembic dhe përdor PostgreSQL përmes `DATABASE_URL`; Supabase mbetet në anën e serverit, larg bundle-it të telefonit.
- Ekrani bosh është i qëllimshëm; projekti nuk mbush llogarinë me rekorde fiktive.

## Çka bëri agjenti

- Lexoi materialet e ekipit dhe hartën e produktit; përditësoi `AGENTS.md` për misionin M0.
- Hoqi rrugën e vjetër të listës me kujtime statike, që faqja kryesore dhe Memory të përdorin rrjedhën e autentikuar me të dhëna nga API-ja.
- Përditësoi HARTA-n dhe udhëzuesin e check-off-it që demonstrimi të përdorë vetëm rekorde të krijuara realisht.
- Nuk vendosi kredenciale në repository ose bundle-in e telefonit; konfigurimi i Supabase mbetet vetëm në `.env` lokal të backend-it.
