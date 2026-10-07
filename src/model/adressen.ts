import type { Geraet, NetzDatei } from './datei';
import { geraeteKatalog } from './geraete';
import {
  STANDARD_SUBNETZMASKE,
  gleichesNetz,
  ipZuZahl,
  istReserviert,
  maskeZuZahl,
  netzanteil,
  zahlZuIp,
} from './ip';
import { leitungenVon } from './netz';
import { segmentAnLeitung, segmentSchluessel } from './topologie';

/**
 * Adressierung (Bildungsplan 7/8 TK 3, 11 TK 2). Grundbegriff ist die **Schnittstelle**:
 * Ein Endgerät hat genau eine, ein Router eine je Anschluss (Leitung). Switches und Access Points haben keine.
 * Texte zu den Problemen: src/content/meldungen.ts.
 */
export type AdressProblem = { anschluss?: string } & (
  | { art: 'ip-ungueltig' }
  | { art: 'maske-ungueltig' }
  | { art: 'gateway-ungueltig' }
  | { art: 'gateway-anderes-netz' }
  | { art: 'dns-ungueltig' }
  | { art: 'ip-doppelt'; mit: Geraet[] }
  | { art: 'ip-reserviert'; welche: 'netzadresse' | 'broadcast' }
  | { art: 'anderes-netz'; erwartet: { ip: number; maske: number } }
);

export interface Adresse {
  ip: number;
  maske: number;
  gateway: number | null;
}

/** Eine konfigurierte, gültige IP-Adresse an einem Gerät. */
export interface Schnittstelle {
  geraetId: string;
  /** Leitung, an der die Schnittstelle hängt (`null` bei einem Endgerät ohne Leitung). */
  leitungId: string | null;
  ip: number;
  maske: number;
}

/** Hat das Gerät genau eine eigene IP-Adresse? (Endgeräte; Router haben eine je Anschluss) */
export function hatIpAdresse(g: Geraet): boolean {
  return geraeteKatalog[g.typ].kategorie === 'endgeraet';
}

const standardMaske = () => maskeZuZahl(STANDARD_SUBNETZMASKE)!;

/** Gültige Adresse eines Endgeräts oder `null`, wenn keine/ungültige IP eingetragen ist. */
export function adresseVon(g: Geraet): Adresse | null {
  if (!hatIpAdresse(g) || !g.ip) return null;
  const ip = ipZuZahl(g.ip);
  const maske = maskeZuZahl(g.subnetzmaske?.trim() || STANDARD_SUBNETZMASKE);
  if (ip === null || maske === null) return null;
  const gateway = g.gateway?.trim() ? ipZuZahl(g.gateway) : null;
  return { ip, maske, gateway };
}

/** Alle gültigen Schnittstellen eines Geräts. */
export function schnittstellenVon(netz: NetzDatei, g: Geraet): Schnittstelle[] {
  if (hatIpAdresse(g)) {
    const a = adresseVon(g);
    if (!a) return [];
    return [{ geraetId: g.id, leitungId: leitungenVon(netz, g.id)[0]?.id ?? null, ip: a.ip, maske: a.maske }];
  }
  if (g.typ !== 'router' || !g.anschluesse) return [];
  const ergebnis: Schnittstelle[] = [];
  for (const l of leitungenVon(netz, g.id)) {
    const a = g.anschluesse[l.id];
    const ip = a ? ipZuZahl(a.ip) : null;
    const maske = maskeZuZahl(a?.subnetzmaske?.trim() || STANDARD_SUBNETZMASKE);
    if (ip !== null && maske !== null) ergebnis.push({ geraetId: g.id, leitungId: l.id, ip, maske });
  }
  return ergebnis;
}

/** Gehört diese IP-Adresse zu einer Schnittstelle des Geräts? */
export function besitztIp(netz: NetzDatei, g: Geraet, ip: number): boolean {
  return schnittstellenVon(netz, g).some((s) => s.ip === ip);
}

/** Schlüssel des lokalen Rechnernetzes, in dem eine Schnittstelle liegt. */
function schluesselVon(netz: NetzDatei, s: Schnittstelle): string {
  return s.leitungId ? segmentSchluessel(netz, s.geraetId, s.leitungId) : `allein:${s.geraetId}`;
}

export function adressProbleme(netz: NetzDatei): Map<string, AdressProblem[]> {
  const probleme = new Map<string, AdressProblem[]>();
  const melde = (id: string, p: AdressProblem) => probleme.set(id, [...(probleme.get(id) ?? []), p]);

  // 1. Eingaben prüfen
  for (const g of netz.geraete) {
    if (hatIpAdresse(g)) {
      if (g.ip?.trim() && ipZuZahl(g.ip) === null) melde(g.id, { art: 'ip-ungueltig' });
      if (g.subnetzmaske?.trim() && maskeZuZahl(g.subnetzmaske) === null)
        melde(g.id, { art: 'maske-ungueltig' });
      if (g.gateway?.trim() && ipZuZahl(g.gateway) === null) melde(g.id, { art: 'gateway-ungueltig' });
      if (g.dnsServer?.trim() && ipZuZahl(g.dnsServer) === null) melde(g.id, { art: 'dns-ungueltig' });
      const a = adresseVon(g);
      if (a && a.gateway !== null && !gleichesNetz(a.gateway, a.ip, a.maske)) {
        melde(g.id, { art: 'gateway-anderes-netz' });
      }
    } else if (g.typ === 'router') {
      for (const [anschluss, a] of Object.entries(g.anschluesse ?? {})) {
        if (a.ip.trim() && ipZuZahl(a.ip) === null) melde(g.id, { art: 'ip-ungueltig', anschluss });
        if (a.subnetzmaske?.trim() && maskeZuZahl(a.subnetzmaske) === null) {
          melde(g.id, { art: 'maske-ungueltig', anschluss });
        }
      }
    }
  }

  // 2. Reservierte Adressen, doppelte Adressen und abweichende Netze – je lokalem Rechnernetz.
  const nachSegment = new Map<string, Schnittstelle[]>();
  for (const g of netz.geraete) {
    for (const s of schnittstellenVon(netz, g)) {
      const reserviert = istReserviert(s.ip, s.maske);
      if (reserviert) melde(g.id, { art: 'ip-reserviert', welche: reserviert, ...anschlussVon(g, s) });
      const k = schluesselVon(netz, s);
      nachSegment.set(k, [...(nachSegment.get(k) ?? []), s]);
    }
  }
  const geraet = (id: string) => netz.geraete.find((g) => g.id === id)!;

  for (const imSegment of nachSegment.values()) {
    const nachIp = new Map<number, Schnittstelle[]>();
    for (const s of imSegment) nachIp.set(s.ip, [...(nachIp.get(s.ip) ?? []), s]);
    for (const gruppe of nachIp.values()) {
      if (gruppe.length < 2) continue;
      for (const s of gruppe) {
        const mit = gruppe.filter((x) => x !== s).map((x) => geraet(x.geraetId));
        melde(s.geraetId, { art: 'ip-doppelt', mit, ...anschlussVon(geraet(s.geraetId), s) });
      }
    }

    // Mehrheitsnetz bestimmen; abweichende Schnittstellen markieren. Bei Gleichstand wird nichts markiert,
    // weil unklar ist, welche „falsch“ ist – dann hilft die Simulation beim Herausfinden.
    const zaehler = new Map<string, { anzahl: number; ip: number; maske: number }>();
    for (const s of imSegment) {
      const schluessel = `${netzanteil(s.ip, s.maske)}/${s.maske}`;
      const z = zaehler.get(schluessel) ?? { anzahl: 0, ip: s.ip, maske: s.maske };
      z.anzahl++;
      zaehler.set(schluessel, z);
    }
    const [erstes, zweites] = [...zaehler.entries()].sort((a, b) => b[1].anzahl - a[1].anzahl);
    if (!erstes || (zweites && zweites[1].anzahl === erstes[1].anzahl)) continue;
    for (const s of imSegment) {
      if (`${netzanteil(s.ip, s.maske)}/${s.maske}` !== erstes[0]) {
        melde(s.geraetId, {
          art: 'anderes-netz',
          erwartet: { ip: erstes[1].ip, maske: erstes[1].maske },
          ...anschlussVon(geraet(s.geraetId), s),
        });
      }
    }
  }
  return probleme;
}

function anschlussVon(g: Geraet, s: Schnittstelle): { anschluss?: string } {
  return g.typ === 'router' && s.leitungId ? { anschluss: s.leitungId } : {};
}

/**
 * Schlägt die nächste freie Adresse im Netz der Nachbarn vor (Standard: 192.168.0.x).
 * Für Router-Anschlüsse `leitungId` angeben; Router bekommen bevorzugt .1 (wie in echten Netzen).
 */
export function ipVorschlag(netz: NetzDatei, geraetId: string, leitungId?: string): string {
  const g = netz.geraete.find((x) => x.id === geraetId);
  const leitung = leitungId ?? leitungenVon(netz, geraetId)[0]?.id;
  const imSegment = leitung ? segmentAnLeitung(netz, geraetId, leitung) : new Set([geraetId]);
  const andere = netz.geraete
    .filter((x) => imSegment.has(x.id))
    .flatMap((x) => schnittstellenVon(netz, x))
    .filter((s) => !(s.geraetId === geraetId && s.leitungId === leitung))
    .filter(
      (s) =>
        !s.leitungId || !leitung || schluesselVon(netz, s) === segmentSchluessel(netz, geraetId, leitung),
    );
  const basis = andere[0] ?? { ip: ipZuZahl('192.168.0.0')!, maske: standardMaske() };
  const belegt = new Set(netz.geraete.flatMap((x) => schnittstellenVon(netz, x)).map((s) => s.ip));
  const netzStart = netzanteil(basis.ip, basis.maske);
  const anzahlAdressen = ~basis.maske >>> 0;
  // Endgeräte ab .10 (wie in Heimnetzen), Router ab .1.
  const start = g?.typ === 'router' ? 1 : Math.min(10, anzahlAdressen - 1);
  for (let host = start; host < anzahlAdressen; host++) {
    const kandidat = netzStart + host;
    if (!belegt.has(kandidat) && !istReserviert(kandidat, basis.maske)) return zahlZuIp(kandidat);
  }
  return '';
}

/** Vorschlag für das Gateway eines Endgeräts: Router-Anschluss im eigenen lokalen Rechnernetz. */
export function gatewayVorschlag(netz: NetzDatei, geraetId: string): string {
  const g = netz.geraete.find((x) => x.id === geraetId);
  const leitung = leitungenVon(netz, geraetId)[0];
  if (!g || !leitung) return '';
  const schluessel = segmentSchluessel(netz, geraetId, leitung.id);
  const eigene = adresseVon(g);
  for (const r of netz.geraete.filter((x) => x.typ === 'router')) {
    for (const s of schnittstellenVon(netz, r)) {
      if (
        s.leitungId &&
        schluesselVon(netz, s) === schluessel &&
        (!eigene || gleichesNetz(s.ip, eigene.ip, eigene.maske))
      ) {
        return zahlZuIp(s.ip);
      }
    }
  }
  return '';
}
