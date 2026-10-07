import type { Geraet, Leitung, NetzDatei } from './datei';
import { findeGeraet } from './netz';

/**
 * Struktur des Netzes: Welche Geräte bilden ein lokales Rechnernetz (Segment)
 * und über welche Leitung geht es zum nächsten Gerät auf dem Weg zu einem Ziel?
 */

/** Leitet ein Gerät Nachrichten innerhalb eines Segments weiter? (Switch, Access Point) */
export function istVerteilerImSegment(g: Geraet): boolean {
  return g.typ === 'switch' || g.typ === 'access-point';
}

export function nachbarn(netz: NetzDatei, geraetId: string): { leitung: Leitung; geraet: Geraet }[] {
  const ergebnis: { leitung: Leitung; geraet: Geraet }[] = [];
  for (const l of netz.leitungen) {
    const anderes = l.von === geraetId ? l.nach : l.nach === geraetId ? l.von : null;
    if (!anderes) continue;
    const g = findeGeraet(netz, anderes);
    if (g) ergebnis.push({ leitung: l, geraet: g });
  }
  return ergebnis;
}

/**
 * Alle Geräte im selben lokalen Rechnernetz wie `startId`: erreichbar über Leitungen, wobei nur
 * Switches und Access Points durchquert werden. Endgeräte und Router sind Ränder des Segments.
 */
export function segment(netz: NetzDatei, startId: string): Set<string> {
  const start = findeGeraet(netz, startId);
  const besucht = new Set([startId]);
  if (!start || start.typ === 'router') return besucht;
  const schlange = [startId];
  while (schlange.length) {
    const id = schlange.shift()!;
    for (const n of nachbarn(netz, id)) {
      if (besucht.has(n.geraet.id)) continue;
      besucht.add(n.geraet.id);
      if (istVerteilerImSegment(n.geraet)) schlange.push(n.geraet.id);
    }
  }
  return besucht;
}

/**
 * Kürzester Weg von `vonId` zu `zielId` innerhalb eines Segments (Breitensuche).
 * Liefert die Folge der Leitungen oder `null`, wenn kein Weg existiert. Deterministisch:
 * Bei gleich langen Wegen gewinnt die Reihenfolge der Leitungen in der Datei.
 */
export function weg(netz: NetzDatei, vonId: string, zielId: string): Leitung[] | null {
  if (vonId === zielId) return [];
  const vorgaenger = new Map<string, { leitung: Leitung; von: string }>();
  const besucht = new Set([vonId]);
  const schlange = [vonId];
  while (schlange.length) {
    const id = schlange.shift()!;
    for (const n of nachbarn(netz, id)) {
      if (besucht.has(n.geraet.id)) continue;
      besucht.add(n.geraet.id);
      vorgaenger.set(n.geraet.id, { leitung: n.leitung, von: id });
      if (n.geraet.id === zielId) {
        const pfad: Leitung[] = [];
        for (let k = zielId; k !== vonId;) {
          const v = vorgaenger.get(k)!;
          pfad.unshift(v.leitung);
          k = v.von;
        }
        return pfad;
      }
      // Nur durch Switches/Access Points hindurch weitersuchen.
      if (istVerteilerImSegment(n.geraet)) schlange.push(n.geraet.id);
    }
  }
  return null;
}

/**
 * Lokales Rechnernetz hinter einer bestimmten Leitung eines Geräts (z. B. hinter einem Router-Anschluss).
 * Hängt am anderen Ende ein Switch/Access Point, ist es dessen Segment; sonst nur die beiden Geräte.
 */
export function segmentAnLeitung(netz: NetzDatei, geraetId: string, leitungId: string): Set<string> {
  const l = netz.leitungen.find((x) => x.id === leitungId);
  if (!l) return new Set([geraetId]);
  const anderes = findeGeraet(netz, l.von === geraetId ? l.nach : l.von);
  if (!anderes) return new Set([geraetId]);
  if (istVerteilerImSegment(anderes)) return segment(netz, anderes.id);
  return new Set([geraetId, anderes.id]);
}

/**
 * Eindeutiger Name des lokalen Rechnernetzes hinter einer Leitung – gleich für alle Schnittstellen,
 * die im selben Segment liegen. Grundlage für Adressprüfung und Routing.
 */
export function segmentSchluessel(netz: NetzDatei, geraetId: string, leitungId: string): string {
  const l = netz.leitungen.find((x) => x.id === leitungId);
  const anderes = l && findeGeraet(netz, l.von === geraetId ? l.nach : l.von);
  if (!l || !anderes) return `allein:${geraetId}`;
  if (!istVerteilerImSegment(anderes)) return `p2p:${l.id}`;
  const verteiler = netz.geraete
    .filter((g) => istVerteilerImSegment(g) && segment(netz, anderes.id).has(g.id))
    .map((g) => g.id)
    .sort();
  return `l2:${verteiler[0]}`;
}
