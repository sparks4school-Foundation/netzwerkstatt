import type { Paket, ProtokollEintrag } from './simulation';

/**
 * Sequenzdiagramm aus dem Kommunikationsprotokoll (Bildungsplan 11, TK 5 und 6), an UML angelehnt.
 * - Ende-zu-Ende: ein Pfeil je Paket vom Absender zum Empfänger (oder ✕ dort, wo es verloren ging).
 * - Mit Zwischenstationen: ein Pfeil je Abschnitt (über Switches und Router).
 */
export interface Pfeil {
  /** Nummer des Protokolleintrags, aus dem der Pfeil stammt (für Details/Schichten). */
  nr: number;
  vonId: string;
  nachId: string;
  paket: Paket;
  /** Paket ist hier verloren gegangen (UML: „lost message“). */
  verloren: boolean;
}

export interface Sequenz {
  /** Lebenslinien in der Reihenfolge ihres ersten Auftretens. */
  teilnehmer: string[];
  pfeile: Pfeil[];
}

export function sequenzdiagramm(protokoll: readonly ProtokollEintrag[], zwischenstationen: boolean): Sequenz {
  const pfeile: Pfeil[] = [];
  const verworfenBei = new Map<string, string>();
  const empfangenBei = new Map<string, string>();
  for (const e of protokoll) {
    if (e.art === 'verworfen') verworfenBei.set(e.paket.id, e.geraetId);
    if (e.art === 'empfangen') empfangenBei.set(e.paket.id, e.geraetId);
  }

  for (const e of protokoll) {
    if (e.art !== 'gesendet' && e.art !== 'weitergeleitet') continue;
    if (zwischenstationen) {
      pfeile.push({
        nr: e.nr,
        vonId: e.geraetId,
        nachId: e.nachId,
        paket: e.paket,
        verloren: verworfenBei.get(e.paket.id) === e.nachId,
      });
    } else if (e.art === 'gesendet') {
      const ziel = empfangenBei.get(e.paket.id) ?? verworfenBei.get(e.paket.id);
      if (!ziel) continue; // noch unterwegs
      pfeile.push({
        nr: e.nr,
        vonId: e.geraetId,
        nachId: ziel,
        paket: e.paket,
        verloren: !empfangenBei.has(e.paket.id),
      });
    }
  }

  const teilnehmer: string[] = [];
  for (const p of pfeile) {
    for (const id of [p.vonId, p.nachId]) if (!teilnehmer.includes(id)) teilnehmer.push(id);
  }
  return { teilnehmer, pfeile };
}
