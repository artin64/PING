# HARTA · MVP-ja e PINGO-s

## Puna e vetme e aplikacionit

Kur dikush ruan një informacion të rëndësishëm, PINGO e mban burimin bashkë me përmbajtjen që përdoruesi ta gjejë shpejt dhe ta kthejë një datë të konfirmuar në veprim.

## Rrjedha kryesore

1. **Today** — përmbledhja e llogarisë aktive nga API-ja dhe PostgreSQL (Supabase kur konfigurohet `DATABASE_URL`).
2. **Memory** — lista reale e kujtimeve të llogarisë, me kërkim.
3. **Detajet** — rekordi dhe burimi i ruajtur, i hapur sipas ID-së.
4. **Add** — përdoruesi ruan një shënim ose lidhje; API-ja e shkruan në databazë.
   Pas ruajtjes, Memory dhe Today rifreskohen nga API-ja dhe tregojnë rekordin e ri.

~~~mermaid
flowchart LR
  A[Sot: të dhënat e llogarisë] --> B[Memory: lista reale]
  B --> C[Detajet dhe burimi]
  B --> D[Shto shënim ose lidhje]
  D --> E[PostgreSQL i konfiguruar: ruajtje përmes API-së]
  E --> B
  E --> A
  C --> F[Kontrollo dhe konfirmo datën]
  F --> A
~~~

## Skica të shpejta

### Lista

~~~text
PINGO                                      [Kërko]
Kujtimet e tua
[Hotelet]  Rezervimi i Berlinit                 ›
[Pagesat]  Fatura e internetit                  ›
[Udhëtim]  Bileta Prishtinë–Berlin              ›
                                      [+ Shto]
~~~

### Detajet

~~~text
‹ Lista
REZERVIM · UDHËTIM
Hoteli në Berlin
12–15 qershor · Berlin
Burimi: screenshot i ruajtur
[Kontrollo datat]            [Ndrysho]
~~~

Skicat janë vetëm wireframe tekstuale. Aplikacioni nuk përdor kujtime shembull si të dhëna të përdoruesit.

## Brenda MVP-së

- Listë reale nga `GET /api/v1/captures`, me llogari private dhe gjendje bosh kur nuk ka rekorde.
- Hapja e kujtimit sipas ID-së dhe kontrolli kur ID-ja nuk ekziston.
- Ruajtja e shënimeve/lidhjeve nga telefoni me `POST /api/v1/captures` dhe leximi i tyre pas rifreskimit ose rihapjes.
- Kërkimi në informacionin e ruajtur.
- Ekrani Today i lidhur me `GET /api/v1/dashboard` dhe të dhënat e llogarisë aktive.
- PostgreSQL i Supabase konfigurohet vetëm në backend me `DATABASE_URL`; telefoni nuk merr fjalëkalim DB ose service-role key.
- Kujtesat për afate që përdoruesi i shqyrton dhe i konfirmon vetë.
- Gjendje të lexueshme për listë bosh, gabim kërkimi dhe artikull që mungon.

## Jashtë MVP-së

- Pagesa bankare, lidhje me llogari bankare ose inicim transaksionesh.
- Status fluturimi në kohë reale.
- Aktivizimi automatik i datave të nxjerra nga AI/OCR pa konfirmim.
- Parashikimi automatik i shumës së lirë javore për shpenzim; kjo doli si një sinjal nga një bisedë dhe kërkon verifikim para se të zgjerohet MVP-ja.
- Pretendimi që OCR ose njoftimet funksionojnë pa rezultat/leje të verifikuar.
- Sinkronizim me email, share sheet ose shërbime të tjera pa integrim dhe pëlqim.
- Kërkim semantik/vector dhe blerje abonimi në këtë demonstrim J3.

