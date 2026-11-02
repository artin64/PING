# Dorëzimi dhe check-off

**Afati i dhënë:** e hënë, 2 nëntor 2026, ora 23:59 (Europe/Warsaw).

## Statusi i detyrës

Sipas konfirmimit të ekipit, kërkesat e detyrës janë përfunduar:

- [x] Rruga 1 është shënuar te `EKIPI.md`.
- [x] Tri bisedat reale janë përmbledhur në `BISEDAT.md`, pa emra të plotë ose numra telefoni.
- [x] Pitch-i është provuar me zë dy herë me kronometër; shih `PITCH.md`.
- [x] Demoja listë → detaje dhe kontrolli i ID-së që mungon janë treguar në Expo Go.
- [x] Kontrolli i commit-it për `.env`, token-a, dokumente personale dhe `node_modules` është kryer.
- [x] Kolegët janë njoftuar për repository-n dhe demonstrimin.
- [x] Erion Miftari është shtuar si collaborator.
- [x] Repository është i qasshëm për vlerësim: publik ose me `Agonb` si collaborator.
- [x] `EKIPI.md`, `BISEDAT.md` dhe `HARTA.md` janë në rrënjë të projektit.
- [x] Commit-i dhe push-i i dorëzimit janë kryer në `main`.

Repository zyrtar: <https://github.com/artin64/PING>.

## Rrjedha e demonstrimit

Hapni listën në telefon, prekni një kujtim, shpjegoni se faqja e detajeve e gjen sipas ID-së, kthehuni te lista dhe hapni një ID që nuk ekziston për të treguar mesazhin mbrojtës. Shpjegojeni me fjalët tuaja brenda rreth 30 sekondave.

Për nisje lokale në Expo Go, nga rrënja e repository-t:

~~~powershell
cd mobile
Copy-Item .env.example .env.local
npm ci
npx expo start
~~~
