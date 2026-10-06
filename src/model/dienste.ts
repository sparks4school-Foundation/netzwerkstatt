import { adresseVon } from './adressen';
import type { Dienst, DienstArt, Geraet, GeraetTyp, NetzDatei } from './datei';
import { istGueltigeDomain, normalisiereDomain } from './domain';
import { ipZuZahl } from './ip';
import { segment } from './topologie';

/**
 * Dienste (Software) auf Geräten. Welcher Dienst wo installiert werden kann:
 * - Browser (Client): auf allen Endgeräten
 * - Webserver und DNS-Server (Server-Dienste): auf Server UND Computer – ein Computer kann auch Server sein.
 */
const erlaubt: Partial<Record<GeraetTyp, DienstArt[]>> = {
  computer: ['browser', 'webserver', 'dns-server'],
  server: ['browser', 'webserver', 'dns-server'],
  smartphone: ['browser'],
  spielkonsole: ['browser'],
};

export function installierbareDienste(typ: GeraetTyp): DienstArt[] {
  return erlaubt[typ] ?? [];
}

export const STARTSEITE = '/';

export function neuerDienst(art: DienstArt, geraet: Geraet): Dienst {
  switch (art) {
    case 'browser':
      return { art };
    case 'webserver':
      return { art, seiten: [{ pfad: STARTSEITE, html: beispielSeite(geraet.name) }] };
    case 'dns-server':
      return { art, eintraege: [] };
  }
}

function beispielSeite(name: string): string {
  return `<h1>Willkommen!</h1>
<p>Diese Seite liegt auf dem Webserver von ${name}.</p>
<p>Ändere den Text und rufe die Seite im Browser auf.</p>
`;
}

export function dienstVon<A extends DienstArt>(g: Geraet, art: A): Extract<Dienst, { art: A }> | undefined {
  return g.dienste?.find((d): d is Extract<Dienst, { art: A }> => d.art === art);
}

export function hatDienst(g: Geraet, art: DienstArt): boolean {
  return !!dienstVon(g, art);
}

export function dienstInstallieren(g: Geraet, art: DienstArt): Dienst[] {
  if (hatDienst(g, art) || !installierbareDienste(g.typ).includes(art)) return g.dienste ?? [];
  return [...(g.dienste ?? []), neuerDienst(art, g)];
}

export function dienstEntfernen(g: Geraet, art: DienstArt): Dienst[] {
  return (g.dienste ?? []).filter((d) => d.art !== art);
}

/** Ersetzt einen Dienst desselben Typs (z. B. nach dem Bearbeiten der Seiten). */
export function dienstErsetzen(g: Geraet, neu: Dienst): Dienst[] {
  return (g.dienste ?? []).map((d) => (d.art === neu.art ? neu : d));
}

export type DnsEintragProblem = 'domain-ungueltig' | 'ip-ungueltig' | 'domain-doppelt';

/** Prüft die Tabelle eines DNS-Servers; liefert je Zeile die Probleme. */
export function dnsEintragProbleme(eintraege: { domain: string; ip: string }[]): DnsEintragProblem[][] {
  const gesehen = new Map<string, number>();
  eintraege.forEach((e) => {
    const d = normalisiereDomain(e.domain);
    gesehen.set(d, (gesehen.get(d) ?? 0) + 1);
  });
  return eintraege.map((e) => {
    const p: DnsEintragProblem[] = [];
    if (!istGueltigeDomain(e.domain)) p.push('domain-ungueltig');
    if (ipZuZahl(e.ip) === null) p.push('ip-ungueltig');
    if ((gesehen.get(normalisiereDomain(e.domain)) ?? 0) > 1) p.push('domain-doppelt');
    return p;
  });
}

/** IP-Adresse des ersten DNS-Servers im lokalen Rechnernetz – als Vorschlag für das Feld „DNS-Server“. */
export function dnsServerVorschlag(netz: NetzDatei, geraetId: string): string {
  const imSegment = segment(netz, geraetId);
  const server = netz.geraete.find(
    (g) => g.id !== geraetId && imSegment.has(g.id) && hatDienst(g, 'dns-server') && adresseVon(g),
  );
  return server?.ip?.trim() ?? '';
}
