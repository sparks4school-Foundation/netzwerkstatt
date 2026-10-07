import { create } from 'zustand';
import { geraeteTexte } from '../content/geraete';
import { verbindungsMeldung } from '../content/meldungen';
import {
  leeresNetz,
  type Dienst,
  type Geraet,
  type GeraetTyp,
  type LeitungsArt,
  type NetzDatei,
} from '../model/datei';
import {
  geraetAendern,
  freiePosition,
  geraetEntfernen,
  geraetHinzufuegen,
  leitungAendern,
  leitungEntfernen,
  verbinden,
} from '../model/netz';
import type { StufeId } from '../model/stufe';

export type Modus = 'aufbauen' | 'ausprobieren';
export type Ansicht = 'infrastruktur' | 'dienste';
export type Auswahl = { art: 'geraet' | 'leitung'; id: string } | null;
export type Meldung = { text: string; art: 'fehler' | 'info'; nr: number } | null;

const MAX_VERLAUF = 100;

interface AppZustand {
  netz: NetzDatei;
  vergangenheit: NetzDatei[];
  zukunft: NetzDatei[];
  modus: Modus;
  /** 2-Schichten-Modell (7/8, TK 1): physische Infrastruktur oder Dienste mit logischen Verbindungen. */
  ansicht: Ansicht;
  auswahl: Auswahl;
  verbindungsart: LeitungsArt;
  meldung: Meldung;
  /** Arbeitsauftrag des zuletzt geöffneten Beispiels (wird nicht gespeichert; Aufgabenmodus folgt in Phase 5). */
  auftrag: { titel: string; text: string; sichtbar: boolean } | null;
  beispieleOffen: boolean;

  setzeStufe: (stufe: StufeId) => void;
  setzeModus: (modus: Modus) => void;
  setzeAnsicht: (ansicht: Ansicht) => void;
  setzeVerbindungsart: (art: LeitungsArt) => void;
  waehle: (auswahl: Auswahl) => void;
  melde: (text: string, art?: 'fehler' | 'info') => void;
  meldungSchliessen: () => void;

  geraetHinzufuegen: (typ: GeraetTyp, position: { x: number; y: number }) => void;
  umbenennen: (id: string, name: string) => void;
  setzeNetzwerk: (
    id: string,
    werte: { ip?: string; subnetzmaske?: string; gateway?: string; dnsServer?: string },
  ) => void;
  setzeDienste: (id: string, dienste: Dienst[]) => void;
  setzeAnschluss: (routerId: string, leitungId: string, werte: { ip: string; subnetzmaske?: string }) => void;
  setzeRouting: (routerId: string, routing: NonNullable<Geraet['routing']>) => void;
  setzeLeitungAusgefallen: (leitungId: string, ausgefallen: boolean) => void;
  setzeLeitung: (leitungId: string, aenderung: { verlust?: number; verzoegerung?: number }) => void;
  /** Verschieben während des Ziehens: ohne Verlaufseintrag. Vorher `merkeZustand()` aufrufen. */
  verschieben: (id: string, position: { x: number; y: number }) => void;
  merkeZustand: () => void;
  verbinde: (vonId: string, nachId: string, art?: LeitungsArt) => boolean;
  entferneAuswahl: () => void;
  entferne: (auswahl: NonNullable<Auswahl>) => void;

  rueckgaengig: () => void;
  wiederholen: () => void;
  ersetzeNetz: (netz: NetzDatei, auftrag?: { titel: string; text: string }) => void;
  setzeAuftragSichtbar: (sichtbar: boolean) => void;
  setzeBeispieleOffen: (offen: boolean) => void;
}

/** Fügt den aktuellen Zustand dem Verlauf hinzu und leert die Wiederholen-Liste. */
function mitVerlauf(z: AppZustand, neu: NetzDatei): Partial<AppZustand> {
  return {
    netz: neu,
    vergangenheit: [...z.vergangenheit, z.netz].slice(-MAX_VERLAUF),
    zukunft: [],
  };
}

/** Erster freier Name nach dem Muster „Computer 1“, „Computer 2“ … */
function freierName(netz: NetzDatei, typ: GeraetTyp): string {
  const basis = geraeteTexte[typ].name;
  const namen = new Set(netz.geraete.map((g) => g.name));
  let n = 1;
  while (namen.has(`${basis} ${n}`)) n++;
  return `${basis} ${n}`;
}

let meldungNr = 0;

export const useApp = create<AppZustand>()((set, get) => ({
  netz: leeresNetz('7-8'),
  vergangenheit: [],
  zukunft: [],
  modus: 'aufbauen',
  ansicht: 'infrastruktur',
  auswahl: null,
  verbindungsart: 'kabel',
  meldung: null,
  auftrag: null,
  beispieleOffen: false,

  setzeStufe: (stufe) => set((z) => ({ netz: { ...z.netz, stufe } })),
  setzeModus: (modus) => set({ modus }),
  setzeAnsicht: (ansicht) => set({ ansicht }),
  setzeVerbindungsart: (verbindungsart) => set({ verbindungsart }),
  waehle: (auswahl) => set({ auswahl }),
  melde: (text, art = 'info') => set({ meldung: { text, art, nr: ++meldungNr } }),
  meldungSchliessen: () => set({ meldung: null }),

  geraetHinzufuegen: (typ, position) =>
    set((z) => {
      const { netz, id } = geraetHinzufuegen(
        z.netz,
        typ,
        freierName(z.netz, typ),
        freiePosition(z.netz, position),
      );
      return { ...mitVerlauf(z, netz), auswahl: { art: 'geraet', id } };
    }),

  umbenennen: (id, name) => set((z) => mitVerlauf(z, geraetAendern(z.netz, id, { name }))),

  setzeNetzwerk: (id, werte) => set((z) => mitVerlauf(z, geraetAendern(z.netz, id, werte))),
  setzeDienste: (id, dienste) => set((z) => mitVerlauf(z, geraetAendern(z.netz, id, { dienste }))),
  setzeAnschluss: (routerId, leitungId, werte) =>
    set((z) => {
      const router = z.netz.geraete.find((g) => g.id === routerId);
      const anschluesse = { ...(router?.anschluesse ?? {}), [leitungId]: werte };
      return mitVerlauf(z, geraetAendern(z.netz, routerId, { anschluesse }));
    }),
  setzeRouting: (routerId, routing) =>
    set((z) => mitVerlauf(z, geraetAendern(z.netz, routerId, { routing }))),
  setzeLeitung: (leitungId, aenderung) =>
    set((z) => mitVerlauf(z, leitungAendern(z.netz, leitungId, aenderung))),
  setzeLeitungAusgefallen: (leitungId, ausgefallen) =>
    set((z) => mitVerlauf(z, leitungAendern(z.netz, leitungId, { ausgefallen }))),

  verschieben: (id, position) => set((z) => ({ netz: geraetAendern(z.netz, id, { position }) })),

  merkeZustand: () => set((z) => mitVerlauf(z, z.netz)),

  verbinde: (vonId, nachId, art) => {
    const z = get();
    let ergebnis = verbinden(z.netz, vonId, nachId, art ?? z.verbindungsart);
    // Beim Ziehen ohne ausdrückliche Wahl: Kann ein Gerät die gewählte Art gar nicht (Smartphone + Kabel,
    // Server + WLAN), wird automatisch die andere Art versucht.
    if (
      !art &&
      !ergebnis.ok &&
      (ergebnis.grund === 'kein-kabelanschluss' || ergebnis.grund === 'kein-wlan')
    ) {
      const andere = verbinden(z.netz, vonId, nachId, z.verbindungsart === 'kabel' ? 'wlan' : 'kabel');
      if (andere.ok) ergebnis = andere;
    }
    if (!ergebnis.ok) {
      z.melde(verbindungsMeldung(ergebnis), 'fehler');
      return false;
    }
    set({ ...mitVerlauf(z, ergebnis.netz), meldung: null });
    return true;
  },

  entferneAuswahl: () => {
    const { auswahl, entferne } = get();
    if (auswahl) entferne(auswahl);
  },

  entferne: (auswahl) =>
    set((z) => ({
      ...mitVerlauf(
        z,
        auswahl.art === 'geraet' ? geraetEntfernen(z.netz, auswahl.id) : leitungEntfernen(z.netz, auswahl.id),
      ),
      auswahl: z.auswahl?.id === auswahl.id ? null : z.auswahl,
    })),

  rueckgaengig: () =>
    set((z) => {
      const vorher = z.vergangenheit.at(-1);
      if (!vorher) return {};
      return {
        netz: vorher,
        vergangenheit: z.vergangenheit.slice(0, -1),
        zukunft: [z.netz, ...z.zukunft],
        auswahl: null,
      };
    }),

  wiederholen: () =>
    set((z) => {
      const [naechster, ...rest] = z.zukunft;
      if (!naechster) return {};
      return { netz: naechster, vergangenheit: [...z.vergangenheit, z.netz], zukunft: rest, auswahl: null };
    }),

  ersetzeNetz: (netz, auftrag) =>
    set({
      netz,
      vergangenheit: [],
      zukunft: [],
      auswahl: null,
      modus: 'aufbauen',
      auftrag: auftrag ? { ...auftrag, sichtbar: true } : null,
    }),
  setzeAuftragSichtbar: (sichtbar) => set((z) => ({ auftrag: z.auftrag && { ...z.auftrag, sichtbar } })),
  setzeBeispieleOffen: (beispieleOffen) => set({ beispieleOffen }),
}));
