# Udhëzime për agjentët e PINGO-s

## Ideja e projektit (M0)

Sipas `EKIPI.md`, `BISEDAT.md` dhe `HARTA.md`, **PINGO i mban të gjetshme gjërat e rëndësishme dhe i ndihmon njerëzit të veprojnë në kohë**: ruan fotografi, dokumente, lidhje dhe shënime si kujtime private të kërkueshme, pastaj i kthen datat e konfirmuara nga përdoruesi në përkujtesa të dobishme.

## Struktura dhe të dhënat

- `mobile/` është aplikacioni Expo SDK 58, React Native dhe TypeScript; navigimi kryesor është Today, Memory, Add, Money dhe Life.
- `backend/` është API-ja FastAPI me autentikim dhe autorizim sipas llogarisë.
- API-ja përdor PostgreSQL për ruajtje afatgjatë. PostgreSQL lokal niset me Docker Compose; PostgreSQL i menaxhuar në Supabase konfigurohet vetëm në backend përmes `DATABASE_URL` dhe migrimeve Alembic.
- Telefoni lidhet me API-në përmes `EXPO_PUBLIC_API_URL`. Mos vendos fjalëkalime të bazës së të dhënave, çelësa admin/service-role ose çelësa AI në aplikacionin celular.

## Rregulla të produktit

- Përdor të dhëna reale të përgjigjes së API-së; mos shto shuma, kujtime, detyra ose udhëtime demonstrative si të dhëna të përdoruesit.
- Misionet M1–M3 përdorin të dhënat e llogarisë aktive përmes `GET /api/v1/captures`, `POST /api/v1/captures` dhe `GET /api/v1/dashboard`; pa konfigurim Supabase, mos pretendo se lidhja cloud është aktive.
- Ruaj dhe rifresko të dhënat përmes API-së dhe bazës së të dhënave; gjendja e përkohshme e ekranit nuk zëvendëson ruajtjen e serverit.
- Datat e nxjerra nga OCR ose AI janë sugjerime. Përdoruesi i kontrollon vetë para krijimit të përkujtesës.
- Mbaj dokumentet private, autorizimin sipas pronarit dhe pëlqimin e përdoruesit për analizën e jashtme me AI.
- Për ndërfaqen, ndiq `mobile/src/lib/theme.ts` dhe komponentët e përbashkët në `mobile/src/components/ui.tsx`; ruaj pesë destinacionet e navigimit.

Para një ndryshimi, përmblidhe idenë kështu: **PINGO i mban të gjetshme gjërat e rëndësishme dhe i ndihmon njerëzit të veprojnë në kohë.**
