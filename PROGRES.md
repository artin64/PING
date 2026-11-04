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

## Statusi i lidhjes cloud dhe hapi i radhës

Në këtë kopje nuk ka `.env`, `mobile/.env.local` ose `DATABASE_URL` të Supabase. Prandaj rrugët e aplikacionit janë gati, por lidhja live me projektin Supabase dhe demonstrimi në telefon **nuk mund të konfirmohen ende**.

1. Krijo `.env` nga `.env.example` dhe vendos `DATABASE_URL` nga Supabase → **Connect**. Përdor direct connection në rrjet IPv6/IPv4 add-on ose session pooler në IPv4; mbaje vargun vetëm në këtë fajll lokal.
2. Në `mobile/.env.local`, vendos `EXPO_PUBLIC_API_URL` në adresën LAN të kompjuterit ku dëgjon API-ja.
3. Nise vetë stack-un lokal. API-ja aplikon migrimet Alembic; mos e vendos DB password ose service-role key në Expo.
4. Në telefon: kyçu → ruaj një shënim me titull unik → shfaqe në Memory dhe Today → mbylle e rihape app-in dhe konfirmo që rekordi mbetet.
5. Ruaje një screenshot real të telefonit për dorëzim dhe shënoje misionin e demonstruar.
