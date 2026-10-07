import { create } from 'zustand';
import type { NetzDatei } from '../model/datei';
import { Simulation, type SendeFehler } from '../sim/simulation';

/** Tempostufen: Dauer eines Schritts in Millisekunden. Index 0 = Zeitlupe. */
export const TEMPI = [
  { name: 'Zeitlupe', dauer: 3000 },
  { name: 'langsam', dauer: 1600 },
  { name: 'normal', dauer: 900 },
  { name: 'schnell', dauer: 400 },
] as const;

/** Dauer eines Schritts, in dem nichts unterwegs ist (nur Warten auf ein Zeitlimit). */
const LEERLAUF_DAUER = 150;

interface SimZustand {
  sim: Simulation | null;
  /** Wird bei jeder Änderung der Simulation erhöht, damit React neu zeichnet (die Simulation selbst ist veränderlich). */
  version: number;
  laeuft: boolean;
  /** Hat die Person selbst angehalten (Pause/Einzelschritt)? Dann spielt Senden nicht automatisch ab. */
  angehalten: boolean;
  /** Läuft genau einen Schritt und hält dann an. */
  einzelschritt: boolean;
  tempo: number;
  /** Fortschritt des aktuellen Schritts von 0 bis 1 – Grundlage der Animation. */
  fortschritt: number;
  protokollOffen: boolean;
  /** Gerät, dessen Browser-Fenster offen ist. */
  browserGeraet: string | null;
  /** Protokolleintrag (gesendet/weitergeleitet), dessen Paket im Schichten-Inspektor gezeigt wird. */
  paketDetails: number | null;
  untenAnsicht: 'protokoll' | 'sequenz';
  zwischenstationen: boolean;

  starte: (netz: NetzDatei) => void;
  beende: () => void;
  senden: (vonId: string, zielIp: string, text: string) => { ok: true } | ({ ok: false } & SendeFehler);
  abspielen: () => void;
  pause: () => void;
  schritt: () => void;
  setzeTempo: (tempo: number) => void;
  setzeProtokollOffen: (offen: boolean) => void;
  oeffneBrowser: (geraetId: string | null) => void;
  zeigePaket: (eintragNr: number | null) => void;
  setzeUntenAnsicht: (ansicht: 'protokoll' | 'sequenz') => void;
  setzeZwischenstationen: (an: boolean) => void;
  aufrufen: (geraetId: string, eingabe: string) => void;
  leitungAusfallen: (leitungId: string, ausgefallen: boolean) => void;
  /** Von der Animationsschleife aufgerufen: `ms` Millisekunden sind vergangen. */
  ticke: (ms: number) => void;
}

export const useSim = create<SimZustand>()((set, get) => ({
  sim: null,
  version: 0,
  laeuft: false,
  angehalten: false,
  einzelschritt: false,
  tempo: 2,
  fortschritt: 0,
  protokollOffen: true,
  browserGeraet: null,
  paketDetails: null,
  untenAnsicht: 'protokoll',
  zwischenstationen: false,

  starte: (netz) =>
    set((z) => ({
      sim: new Simulation(netz),
      version: z.version + 1,
      laeuft: false,
      angehalten: false,
      einzelschritt: false,
      fortschritt: 0,
    })),
  beende: () =>
    set({
      sim: null,
      laeuft: false,
      einzelschritt: false,
      fortschritt: 0,
      browserGeraet: null,
      paketDetails: null,
    }),

  senden: (vonId, zielIp, text) => {
    const { sim } = get();
    if (!sim) throw new Error('Keine Simulation aktiv');
    const ergebnis = sim.senden(vonId, zielIp, text);
    // Nach dem Senden automatisch abspielen – außer man hat selbst angehalten, um Schritt für Schritt zu gehen.
    set((z) => ({ version: z.version + 1, laeuft: z.laeuft || (ergebnis.ok && !z.angehalten) }));
    return ergebnis;
  },

  abspielen: () => set({ laeuft: true, angehalten: false, einzelschritt: false }),
  pause: () => set({ laeuft: false, angehalten: true, einzelschritt: false }),
  // Auch ohne laufende Nachricht nutzbar: Dann wartet die nächste gesendete Nachricht auf den nächsten Schritt.
  schritt: () => set((z) => ({ laeuft: false, angehalten: true, einzelschritt: !!z.sim?.aktiv })),
  setzeTempo: (tempo) => set({ tempo }),
  setzeProtokollOffen: (protokollOffen) => set({ protokollOffen }),
  oeffneBrowser: (browserGeraet) => set({ browserGeraet }),
  // Beim Öffnen anhalten, damit man in Ruhe nachsehen kann.
  zeigePaket: (paketDetails) =>
    set((z) =>
      paketDetails === null
        ? { paketDetails }
        : { paketDetails, laeuft: false, angehalten: z.sim?.aktiv ?? false },
    ),
  setzeUntenAnsicht: (untenAnsicht) => set({ untenAnsicht }),
  setzeZwischenstationen: (zwischenstationen) => set({ zwischenstationen }),
  leitungAusfallen: (leitungId, ausgefallen) => {
    get().sim?.leitungAusfallen(leitungId, ausgefallen);
    set((z) => ({ version: z.version + 1 }));
  },
  aufrufen: (geraetId, eingabe) => {
    const { sim } = get();
    if (!sim) return;
    sim.aufrufen(geraetId, eingabe);
    set((z) => ({ version: z.version + 1, laeuft: z.laeuft || (sim.aktiv && !z.angehalten) }));
  },

  ticke: (ms) => {
    const z = get();
    if (!z.sim || !(z.laeuft || z.einzelschritt)) return;
    if (!z.sim.aktiv) {
      set({ laeuft: false, einzelschritt: false, fortschritt: 0 });
      return;
    }
    // Ist kein Paket unterwegs (z. B. Browser wartet nur noch auf ein Zeitlimit), schnell weiterzählen.
    const dauer = z.sim.unterwegs.length === 0 ? LEERLAUF_DAUER : TEMPI[z.tempo]!.dauer;
    const fortschritt = z.fortschritt + ms / dauer;
    if (fortschritt < 1) {
      set({ fortschritt });
      return;
    }
    z.sim.schritt();
    set({
      fortschritt: 0,
      version: z.version + 1,
      einzelschritt: false,
      laeuft: z.laeuft && z.sim.aktiv,
    });
  },
}));
