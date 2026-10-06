import type { Geraet, NetzDatei } from './datei';
import { geraeteKatalog } from './geraete';
import { STANDARD_SUBNETZMASKE, ipZuZahl, istReserviert, maskeZuZahl, netzanteil, zahlZuIp } from './ip';
import { segment } from './topologie';

/**
 * Prüft die Adressierung aller Geräte und liefert Fehlkonfigurationen (Bildungsplan 7/8, TK 3).
 * Texte dazu: src/content/meldungen.ts.
 */
export type AdressProblem =
  | { art: 'ip-ungueltig' }
  | { art: 'maske-ungueltig' }
  | { art: 'gateway-ungueltig' }
  | { art: 'dns-ungueltig' }
  | { art: 'ip-doppelt'; mit: Geraet[] }
  | { art: 'ip-reserviert'; welche: 'netzadresse' | 'broadcast' }
  | { art: 'anderes-netz'; erwartet: { ip: number; maske: number } };

export interface Adresse {
  ip: number;
  maske: number;
  gateway: number | null;
}

/** Hat das Gerät überhaupt Netzwerkeinstellungen? (Endgeräte ja; Switch/AP nein; Router ab Phase 4) */
export function hatIpAdresse(g: Geraet): boolean {
  return geraeteKatalog[g.typ].kategorie === 'endgeraet';
}

/** Gültige Adresse des Geräts oder `null`, wenn keine/ungültige IP eingetragen ist. */
export function adresseVon(g: Geraet): Adresse | null {
  if (!hatIpAdresse(g) || !g.ip) return null;
  const ip = ipZuZahl(g.ip);
  const maske = maskeZuZahl(g.subnetzmaske?.trim() || STANDARD_SUBNETZMASKE);
  if (ip === null || maske === null) return null;
  const gateway = g.gateway?.trim() ? ipZuZahl(g.gateway) : null;
  return { ip, maske, gateway };
}

export function adressProbleme(netz: NetzDatei): Map<string, AdressProblem[]> {
  const probleme = new Map<string, AdressProblem[]>();
  const melde = (id: string, p: AdressProblem) => probleme.set(id, [...(probleme.get(id) ?? []), p]);

  const gueltig = new Map<string, Adresse>();
  for (const g of netz.geraete) {
    if (!hatIpAdresse(g)) continue;
    if (g.ip?.trim() && ipZuZahl(g.ip) === null) melde(g.id, { art: 'ip-ungueltig' });
    if (g.subnetzmaske?.trim() && maskeZuZahl(g.subnetzmaske) === null)
      melde(g.id, { art: 'maske-ungueltig' });
    if (g.gateway?.trim() && ipZuZahl(g.gateway) === null) melde(g.id, { art: 'gateway-ungueltig' });
    if (g.dnsServer?.trim() && ipZuZahl(g.dnsServer) === null) melde(g.id, { art: 'dns-ungueltig' });
    const a = adresseVon(g);
    if (!a) continue;
    gueltig.set(g.id, a);
    const reserviert = istReserviert(a.ip, a.maske);
    if (reserviert) melde(g.id, { art: 'ip-reserviert', welche: reserviert });
  }

  // Doppelte Adressen und abweichende Netze werden je lokalem Rechnernetz (Segment) geprüft.
  const erledigt = new Set<string>();
  for (const g of netz.geraete) {
    if (erledigt.has(g.id) || !gueltig.has(g.id)) continue;
    const imSegment = netz.geraete.filter((x) => segment(netz, g.id).has(x.id) && gueltig.has(x.id));
    imSegment.forEach((x) => erledigt.add(x.id));

    const nachIp = new Map<number, Geraet[]>();
    for (const x of imSegment)
      nachIp.set(gueltig.get(x.id)!.ip, [...(nachIp.get(gueltig.get(x.id)!.ip) ?? []), x]);
    for (const gruppe of nachIp.values()) {
      if (gruppe.length < 2) continue;
      for (const x of gruppe) melde(x.id, { art: 'ip-doppelt', mit: gruppe.filter((y) => y !== x) });
    }

    // Mehrheitsnetz bestimmen; abweichende Geräte markieren. Bei Gleichstand wird nichts markiert,
    // weil unklar ist, welches Gerät „falsch“ ist – dann hilft die Simulation beim Herausfinden.
    const zaehler = new Map<string, { anzahl: number; ip: number; maske: number }>();
    for (const x of imSegment) {
      const a = gueltig.get(x.id)!;
      const schluessel = `${netzanteil(a.ip, a.maske)}/${a.maske}`;
      const z = zaehler.get(schluessel) ?? { anzahl: 0, ip: a.ip, maske: a.maske };
      z.anzahl++;
      zaehler.set(schluessel, z);
    }
    const sortiert = [...zaehler.entries()].sort((a, b) => b[1].anzahl - a[1].anzahl);
    const [erstes, zweites] = sortiert;
    if (!erstes || (zweites && zweites[1].anzahl === erstes[1].anzahl)) continue;
    for (const x of imSegment) {
      const a = gueltig.get(x.id)!;
      if (`${netzanteil(a.ip, a.maske)}/${a.maske}` !== erstes[0]) {
        melde(x.id, { art: 'anderes-netz', erwartet: { ip: erstes[1].ip, maske: erstes[1].maske } });
      }
    }
  }
  return probleme;
}

/** Schlägt die nächste freie Adresse im Netz der anderen Geräte vor (Standard: 192.168.0.x). */
export function ipVorschlag(netz: NetzDatei, geraetId: string): string {
  const imSegment = segment(netz, geraetId);
  const vorhanden = netz.geraete
    .filter((g) => g.id !== geraetId && imSegment.has(g.id))
    .map(adresseVon)
    .filter((a): a is Adresse => a !== null);
  const basis = vorhanden[0] ?? { ip: ipZuZahl('192.168.0.0')!, maske: ipZuZahl(STANDARD_SUBNETZMASKE)! };
  const belegt = new Set(
    netz.geraete
      .map(adresseVon)
      .filter((a) => a)
      .map((a) => a!.ip),
  );
  const netzStart = netzanteil(basis.ip, basis.maske);
  const anzahlAdressen = ~basis.maske >>> 0;
  // Ab .10 beginnen: wirkt wie in echten Heimnetzen und lässt Platz für Router/Server.
  for (let host = Math.min(10, anzahlAdressen - 1); host < anzahlAdressen; host++) {
    const kandidat = netzStart + host;
    if (!belegt.has(kandidat) && !istReserviert(kandidat, basis.maske)) return zahlZuIp(kandidat);
  }
  return '';
}
