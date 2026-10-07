import { leeresNetz, type Geraet, type GeraetTyp, type LeitungsArt, type NetzDatei } from './datei';
import { geraetAendern, geraetHinzufuegen, verbinden } from './netz';

/**
 * Kleiner Baukasten für Tests: `baueNetz({ pc1: ['computer', '192.168.0.10'], sw: ['switch'] }, [['pc1', 'sw']])`.
 * Die Schlüssel werden zu Gerätenamen; IDs vergibt das Modell wie gewohnt.
 */
export function baueNetz(
  geraete: Record<string, [GeraetTyp, string?]>,
  leitungen: [string, string, LeitungsArt?][] = [],
): { netz: NetzDatei; id: (name: string) => string } {
  let netz = leeresNetz('7-8');
  const ids = new Map<string, string>();
  for (const [name, [typ, ip]] of Object.entries(geraete)) {
    const r = geraetHinzufuegen(netz, typ, name, { x: 0, y: 0 });
    netz = ip ? geraetAendern(r.netz, r.id, { ip }) : r.netz;
    ids.set(name, r.id);
  }
  const id = (name: string) => {
    const x = ids.get(name);
    if (!x) throw new Error(`Unbekanntes Gerät im Testnetz: ${name}`);
    return x;
  };
  for (const [a, b, art = 'kabel'] of leitungen) {
    const r = verbinden(netz, id(a), id(b), art);
    if (!r.ok) throw new Error(`Testnetz: ${a}–${b} nicht verbindbar (${r.grund})`);
    netz = r.netz;
  }
  return { netz, id };
}

/** Ändert ein Gerät im Testnetz (z. B. Dienste oder DNS-Server setzen). */
export function mitGeraet(
  netz: NetzDatei,
  id: string,
  aenderung: Partial<Omit<Geraet, 'id' | 'typ'>>,
): NetzDatei {
  return geraetAendern(netz, id, aenderung);
}

/** ID der Leitung zwischen zwei Geräten (für Router-Anschlüsse in Tests). */
export function leitungZwischen(netz: NetzDatei, a: string, b: string): string {
  const l = netz.leitungen.find((x) => (x.von === a && x.nach === b) || (x.von === b && x.nach === a));
  if (!l) throw new Error(`Keine Leitung zwischen ${a} und ${b}`);
  return l.id;
}
