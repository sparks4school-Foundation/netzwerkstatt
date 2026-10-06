import type { Dienst, GeraetTyp } from './datei';

/**
 * Technische Eigenschaften der Bausteine (siehe AGENTS.md 3.1, TK 2).
 * Bewusste Vereinfachung: Ein Endgerät hat genau EINEN Netzanschluss – Kabel ODER WLAN.
 * Bezeichnungen für die Oberfläche stehen in src/content/geraete.ts.
 */
export type Kategorie = 'endgeraet' | 'verteiler';

export interface GeraetEigenschaften {
  kategorie: Kategorie;
  /** Höchstzahl an Kabeln; `Infinity` = beliebig viele. */
  maxKabel: number;
  /** 'client' = kann sich per WLAN verbinden, 'basis' = stellt WLAN bereit (Access Point). */
  wlan: 'nein' | 'client' | 'basis';
}

export const geraeteKatalog: Record<GeraetTyp, GeraetEigenschaften> = {
  computer: { kategorie: 'endgeraet', maxKabel: 1, wlan: 'client' },
  smartphone: { kategorie: 'endgeraet', maxKabel: 0, wlan: 'client' },
  spielkonsole: { kategorie: 'endgeraet', maxKabel: 1, wlan: 'client' },
  server: { kategorie: 'endgeraet', maxKabel: 1, wlan: 'nein' },
  switch: { kategorie: 'verteiler', maxKabel: Infinity, wlan: 'nein' },
  router: { kategorie: 'verteiler', maxKabel: Infinity, wlan: 'nein' },
  'access-point': { kategorie: 'verteiler', maxKabel: 1, wlan: 'basis' },
};

export const geraetTypen = Object.keys(geraeteKatalog) as GeraetTyp[];

/** Neue Computer, Smartphones und Spielkonsolen haben schon einen Browser – wie im echten Leben. */
export function standardDienste(typ: GeraetTyp): Dienst[] {
  return typ === 'computer' || typ === 'smartphone' || typ === 'spielkonsole' ? [{ art: 'browser' }] : [];
}
