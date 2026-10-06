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

  starte: (netz: NetzDatei) => void;
  beende: () => void;
  senden: (vonId: string, zielIp: string, text: string) => { ok: true } | ({ ok: false } & SendeFehler);
  abspielen: () => void;
  pause: () => void;
  schritt: () => void;
  setzeTempo: (tempo: number) => void;
  setzeProtokollOffen: (offen: boolean) => void;
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

  starte: (netz) =>
    set((z) => ({
      sim: new Simulation(netz),
      version: z.version + 1,
      laeuft: false,
      angehalten: false,
      einzelschritt: false,
      fortschritt: 0,
    })),
  beende: () => set({ sim: null, laeuft: false, einzelschritt: false, fortschritt: 0 }),

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

  ticke: (ms) => {
    const z = get();
    if (!z.sim || !(z.laeuft || z.einzelschritt)) return;
    if (!z.sim.aktiv) {
      set({ laeuft: false, einzelschritt: false, fortschritt: 0 });
      return;
    }
    const fortschritt = z.fortschritt + ms / TEMPI[z.tempo]!.dauer;
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
