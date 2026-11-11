# PROGRES · PINGO · M0–M3

**Data:** 06.11.2026
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
- Kryefaqja përdor tri fotografi të paketuara lokalisht, kalim të butë mes skenave dhe lëvizje të reduktuar sipas cilësimit të pajisjes.
- Hero-ja e Today shtrihet në gjerësinë e ekranit dhe përdor blu të thellë, ar, smerald dhe fotografi me errësim të lehtë; pamjet e fotografive te Memory janë më të mëdha.
- Sfondi i ndërfaqes është i bardhë me karta të pastra dhe thekse sipas modulit; kërkimi nga Today kalon te kërkimi global në Memory dhe ruan frazën e kërkuar.
- Njoftimet lokale dhe push përdorin të njëjtin kanal Android me tingull/dridhje; sinkronizohen kur aplikacioni kthehet në plan të parë dhe hapin përkujtuesin përkatës kur preken.
- Nuk vendosi kredenciale në repository ose bundle-in e telefonit; konfigurimi i Supabase mbetet vetëm në `.env` lokal të backend-it.

## Demonstrimi dhe infrastruktura

Backend-i përdor PostgreSQL përmes `DATABASE_URL`; Supabase PostgreSQL mund të përdoret pa ndryshime në aplikacionin celular. Telefoni komunikon me API-në përmes `EXPO_PUBLIC_API_URL`, ndërsa migrimet e skemës menaxhohen me Alembic. Kredencialet e bazës mbahen vetëm në mjedisin e backend-it.

**Hapi i check-off-it:** demonstrim në telefon me llogari reale: lexim nga Memory, ruajtje e një shënimi, shfaqje në Today dhe Memory pas rihapjes së aplikacionit. Prova vizuale për dorëzim është screenshot-i real i telefonit.
