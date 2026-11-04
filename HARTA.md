# HARTA · MVP-ja e PINGO-s

## Puna e vetme e aplikacionit

Kur dikush ruan një informacion të rëndësishëm, PINGO e mban burimin bashkë me përmbajtjen që përdoruesi ta gjejë shpejt dhe ta kthejë një datë të konfirmuar në veprim.

## Rrjedha kryesore

1. **Lista** — memories e ruajtura, të renditura dhe të kërkueshme.
2. **Detajet** — titulli, përmbledhja dhe burimi origjinal i një memory-je.
3. **Shto** — shënim, lidhje, fotografi ose PDF.
4. **Konfirmo afatin** — përdoruesi kontrollon datën dhe konfirmon kujtesën para aktivizimit.
5. **Sot** — përdoruesi sheh afatet që kërkojnë veprim.

~~~mermaid
flowchart LR
  A[Lista e memories] --> B[Detajet dhe burimi]
  A --> C[Shto informacion]
  C --> B
  B --> D[Kontrollo datën]
  D --> E[Konfirmo kujtesën]
  E --> F[Sot: veprimet]
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

Skicat dhe titujt e memories janë shembuj demonstrimi, jo të dhëna të intervistave.

## Brenda MVP-së

- Listë me 5–8 memories shembull për demonstrimin J3.
- Komponent rreshti me props të tipizuara dhe listë FlatList.
- Hapja e artikullit sipas ID-së tekstuale, lidhja nga lista dhe kontrolli kur ID-ja nuk ekziston.
- Ruajtja e shënimeve, lidhjeve, fotografive dhe PDF-ve në llogari private.
- Kërkimi në informacionin e ruajtur.
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

## Shënim për demonstrimin

Rruga J3 përdor të dhëna fiktive të shënuara si shembull që të demonstrohet lista → detajet pa llogari ose server. Modulet e tjera PINGO mbeten në kopje; për konfigurim të tyre shih README.md.
