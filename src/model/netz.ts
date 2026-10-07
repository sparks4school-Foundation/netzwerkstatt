import type { Geraet, GeraetTyp, Leitung, LeitungsArt, NetzDatei } from './datei';
import { geraeteKatalog, standardDienste } from './geraete';

/**
 * Reine Funktionen zum Bearbeiten eines Netzes. Sie verändern nie das übergebene Objekt,
 * sondern liefern ein neues – so funktionieren Rückgängig/Wiederholen trivial.
 */

/** Liefert die nächste freie ID mit Präfix, z. B. "g3". Lesbar in der JSON-Datei. */
export function naechsteId(vorhandene: readonly { id: string }[], praefix: string): string {
  let max = 0;
  for (const { id } of vorhandene) {
    if (id.startsWith(praefix)) {
      const n = Number(id.slice(praefix.length));
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return `${praefix}${max + 1}`;
}

export function findeGeraet(netz: NetzDatei, id: string): Geraet | undefined {
  return netz.geraete.find((g) => g.id === id);
}

export function leitungenVon(netz: NetzDatei, geraetId: string): Leitung[] {
  return netz.leitungen.filter((l) => l.von === geraetId || l.nach === geraetId);
}

/** Ungefähre Größe eines Geräts im Netzplan – genügt, um Überlappungen beim Ablegen zu vermeiden. */
export const GERAET_BREITE = 128;
export const GERAET_HOEHE = 96;

/**
 * Sucht ab `wunsch` spiralförmig im Raster die nächste Position, an der kein Gerät liegt.
 * So landen nacheinander hinzugefügte Geräte nebeneinander statt übereinander.
 */
export function freiePosition(netz: NetzDatei, wunsch: { x: number; y: number }): { x: number; y: number } {
  const dx = GERAET_BREITE + 96;
  const dy = GERAET_HOEHE + 72;
  const frei = (p: { x: number; y: number }) =>
    netz.geraete.every(
      (g) =>
        Math.abs(g.position.x - p.x) >= GERAET_BREITE + 8 || Math.abs(g.position.y - p.y) >= GERAET_HOEHE + 8,
    );
  for (let ring = 0; ring < 12; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const p = { x: wunsch.x + i * dx, y: wunsch.y + j * dy };
        if (frei(p)) return p;
      }
    }
  }
  return wunsch;
}

export function geraetHinzufuegen(
  netz: NetzDatei,
  typ: GeraetTyp,
  name: string,
  position: { x: number; y: number },
): { netz: NetzDatei; id: string } {
  const id = naechsteId(netz.geraete, 'g');
  const dienste = standardDienste(typ);
  const geraet: Geraet = { id, typ, name, position, ...(dienste.length ? { dienste } : {}) };
  return { netz: { ...netz, geraete: [...netz.geraete, geraet] }, id };
}

export function geraetAendern(
  netz: NetzDatei,
  id: string,
  aenderung: Partial<Omit<Geraet, 'id' | 'typ'>>,
): NetzDatei {
  return { ...netz, geraete: netz.geraete.map((g) => (g.id === id ? { ...g, ...aenderung } : g)) };
}

/** Entfernt ein Gerät samt aller daran hängenden Leitungen. */
/** Entfernt ein Gerät samt aller daran hängenden Leitungen. */
export function geraetEntfernen(netz: NetzDatei, id: string): NetzDatei {
  const weg = netz.leitungen.filter((l) => l.von === id || l.nach === id).map((l) => l.id);
  return aufraeumen(
    {
      ...netz,
      geraete: netz.geraete.filter((g) => g.id !== id),
      leitungen: netz.leitungen.filter((l) => !weg.includes(l.id)),
    },
    weg,
  );
}

export function leitungEntfernen(netz: NetzDatei, id: string): NetzDatei {
  return aufraeumen({ ...netz, leitungen: netz.leitungen.filter((l) => l.id !== id) }, [id]);
}

export function leitungAendern(
  netz: NetzDatei,
  id: string,
  aenderung: Partial<Pick<Leitung, 'ausgefallen'>>,
): NetzDatei {
  return { ...netz, leitungen: netz.leitungen.map((l) => (l.id === id ? { ...l, ...aenderung } : l)) };
}

/** Entfernt Router-Anschlüsse und Routen, die auf gelöschte Leitungen verweisen. */
function aufraeumen(netz: NetzDatei, geloeschteLeitungen: string[]): NetzDatei {
  if (geloeschteLeitungen.length === 0) return netz;
  return {
    ...netz,
    geraete: netz.geraete.map((g) => {
      if (!g.anschluesse && !g.routing) return g;
      const anschluesse = g.anschluesse
        ? Object.fromEntries(Object.entries(g.anschluesse).filter(([l]) => !geloeschteLeitungen.includes(l)))
        : undefined;
      const routing = g.routing && {
        ...g.routing,
        tabelle: g.routing.tabelle.filter((r) => !geloeschteLeitungen.includes(r.leitungId)),
      };
      return { ...g, ...(anschluesse ? { anschluesse } : {}), ...(routing ? { routing } : {}) };
    }),
  };
}

/**
 * Gründe, warum zwei Geräte nicht verbunden werden können.
 * Die Oberfläche übersetzt sie mit src/content/meldungen.ts in verständliche Sätze.
 */
export type VerbindungsProblem =
  | { grund: 'selbst' }
  | { grund: 'schon-verbunden' }
  | { grund: 'kein-kabelanschluss'; geraet: Geraet }
  | { grund: 'anschluss-belegt'; geraet: Geraet }
  | { grund: 'wlan-nur-mit-access-point' }
  | { grund: 'kein-wlan'; geraet: Geraet };

export type VerbindungsPruefung = { ok: true } | ({ ok: false } & VerbindungsProblem);

export function pruefeVerbindung(
  netz: NetzDatei,
  vonId: string,
  nachId: string,
  art: LeitungsArt,
): VerbindungsPruefung {
  const a = findeGeraet(netz, vonId);
  const b = findeGeraet(netz, nachId);
  if (!a || !b) throw new Error(`Unbekanntes Gerät: ${!a ? vonId : nachId}`);
  if (a.id === b.id) return { ok: false, grund: 'selbst' };
  const schonVerbunden = netz.leitungen.some(
    (l) => (l.von === a.id && l.nach === b.id) || (l.von === b.id && l.nach === a.id),
  );
  if (schonVerbunden) return { ok: false, grund: 'schon-verbunden' };

  if (art === 'kabel') {
    for (const g of [a, b]) {
      const eig = geraeteKatalog[g.typ];
      if (eig.maxKabel === 0) return { ok: false, grund: 'kein-kabelanschluss', geraet: g };
      if (belegt(netz, g, 'kabel')) return { ok: false, grund: 'anschluss-belegt', geraet: g };
    }
    return { ok: true };
  }

  const basis = [a, b].find((g) => geraeteKatalog[g.typ].wlan === 'basis');
  const client = basis === a ? b : a;
  if (!basis || geraeteKatalog[client.typ].wlan === 'basis') {
    return { ok: false, grund: 'wlan-nur-mit-access-point' };
  }
  if (geraeteKatalog[client.typ].wlan !== 'client') return { ok: false, grund: 'kein-wlan', geraet: client };
  if (belegt(netz, client, 'wlan')) return { ok: false, grund: 'anschluss-belegt', geraet: client };
  return { ok: true };
}

/** Ist der passende Anschluss des Geräts schon voll? Endgeräte haben insgesamt nur einen Anschluss. */
function belegt(netz: NetzDatei, g: Geraet, art: LeitungsArt): boolean {
  const eig = geraeteKatalog[g.typ];
  const leitungen = leitungenVon(netz, g.id);
  if (eig.kategorie === 'endgeraet') return leitungen.length >= 1;
  if (art === 'kabel') return leitungen.filter((l) => l.art === 'kabel').length >= eig.maxKabel;
  return false;
}

export function verbinden(
  netz: NetzDatei,
  vonId: string,
  nachId: string,
  art: LeitungsArt,
): { ok: true; netz: NetzDatei; id: string } | ({ ok: false } & VerbindungsProblem) {
  const pruefung = pruefeVerbindung(netz, vonId, nachId, art);
  if (!pruefung.ok) return pruefung;
  const id = naechsteId(netz.leitungen, 'l');
  return {
    ok: true,
    id,
    netz: { ...netz, leitungen: [...netz.leitungen, { id, art, von: vonId, nach: nachId }] },
  };
}

/** Name des Geräts am anderen Ende einer Leitung. */
export function gegenueberName(netz: NetzDatei, geraetId: string, leitungId: string): string {
  const l = netz.leitungen.find((x) => x.id === leitungId);
  if (!l) return '?';
  return findeGeraet(netz, l.von === geraetId ? l.nach : l.von)?.name ?? '?';
}
