export type Artikull = {
  id: string;
  titulli: string;
  kategoria: string;
  pershkrimi: string;
  burimi: string;
  detaje: string[];
};

// Të dhëna fiktive për demonstrimin e rrjedhës J3; nuk janë memories të përdoruesve.
export const artikujt: Artikull[] = [
  {
    id: 'hotel-berlin',
    titulli: 'Hoteli në Berlin',
    kategoria: 'UDHËTIM',
    pershkrimi: 'Rezervim shembull · 12–15 qershor',
    burimi: 'PDF demonstrues (fiktiv)',
    detaje: ['Qyteti: Berlin', 'Hyrja: 12 qershor, pas orës 15:00', 'Adresa: Alexanderplatz 1 (shembull)'],
  },
  {
    id: 'fatura-internet',
    titulli: 'Fatura e internetit',
    kategoria: 'PAGESË',
    pershkrimi: 'Shembull mujor · skadenca më 18',
    burimi: 'Shënim demonstrues (fiktiv)',
    detaje: ['Kategoria: internet', 'Vlera: nuk është caktuar', 'Data dhe vlera duhen kontrolluar te fatura reale'],
  },
  {
    id: 'bileta-prishtine',
    titulli: 'Udhëtimi Prishtinë–Berlin',
    kategoria: 'BILETË',
    pershkrimi: 'Itinerar shembull · 12 qershor',
    burimi: 'Screenshot demonstrues (fiktiv)',
    detaje: ['Nisja: Prishtinë', 'Mbërritja: Berlin', 'Ora dhe numri i fluturimit nuk janë të dhëna reale'],
  },
  {
    id: 'pasaporta',
    titulli: 'Afati i pasaportës',
    kategoria: 'DOKUMENT',
    pershkrimi: 'Shembull kujtese · data kërkon konfirmim',
    burimi: 'Dokument demonstrues (fiktiv)',
    detaje: ['Nuk përmban numër dokumenti', 'Përdoruesi duhet ta kontrollojë dokumentin origjinal', 'Asnjë kujtesë nuk aktivizohet nga kjo kartë shembull'],
  },
  {
    id: 'laptopi',
    titulli: 'Laptop për studime',
    kategoria: 'IDE',
    pershkrimi: 'Pajisje e ruajtur në listën e dëshirave',
    burimi: 'Shënim demonstrues (fiktiv)',
    detaje: ['Përdorimi: studime', 'Modeli dhe çmimi nuk janë caktuar', 'Shënim i thjeshtë për demonstrimin e kërkimit'],
  },
  {
    id: 'garancia-kufjeve',
    titulli: 'Garancia e kufjeve',
    kategoria: 'GARANCI',
    pershkrimi: 'Shembull dokumenti · ruajeni faturën',
    burimi: 'Faturë demonstrues (fiktiv)',
    detaje: ['Dyqani: nuk është caktuar', 'Afati: nuk është caktuar', 'Për një dokument real, kontrolloni faturën origjinale'],
  },
];

export function gjeArtikullin(id: string | undefined): Artikull | undefined {
  if (!id) return undefined;
  return artikujt.find((artikull) => artikull.id === id);
}
