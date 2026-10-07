import { adresseVon, schnittstellenVon } from '../model/adressen';
import type { NetzDatei } from '../model/datei';
import { ipZuZahl } from '../model/ip';
import { findeGeraet } from '../model/netz';
import type { Paket, ProtokollEintrag } from './simulation';

/**
 * Zerlegt ein Paket auf einem Abschnitt seines Weges in die vier Schichten (Bildungsplan 11, TK 1 und 7).
 * Rein beschreibend: Die Simulation selbst rechnet nicht mit Ports oder MAC-Adressen – sie werden
 * hier deterministisch abgeleitet, damit man sieht, welche Information auf welcher Schicht hinzukommt.
 */
export interface Feld {
  name: string;
  wert: string;
}

export interface Schichten {
  anwendung: { protokoll: string; felder: Feld[] };
  transport: { protokoll: 'TCP' | 'UDP'; felder: Feld[] };
  vermittlung: { protokoll: 'IP'; felder: Feld[] };
  netzzugang: { protokoll: string; felder: Feld[] };
}

/** Bekannte Ports (Zielports der Dienste). */
const DIENST_PORT = { nachricht: 7, dns: 53, http: 80 } as const;

/** Port des Clients: aus der Paketnummer der Anfrage, im Bereich der „dynamischen“ Ports. */
function clientPort(anfrageId: string): number {
  return 49152 + (Number(anfrageId.replace(/\D/g, '')) % 1000);
}

/**
 * Pseudo-MAC-Adresse einer Schnittstelle: stabil aus Geräte- und Leitungs-ID abgeleitet.
 * Präfix 02 = „lokal verwaltet“, kommt also bei echten Herstellern nicht vor.
 */
export function macAdresse(geraetId: string, leitungId: string): string {
  let h = 2166136261;
  for (const z of `${geraetId}/${leitungId}`) h = Math.imul(h ^ z.charCodeAt(0), 16777619) >>> 0;
  const bytes = [0x02, 0x00, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(':');
}

function anwendung(p: Paket): Schichten['anwendung'] {
  switch (p.art) {
    case 'nachricht':
      return { protokoll: 'Nachricht (Echo)', felder: [{ name: 'Inhalt', wert: p.inhalt }] };
    case 'antwort':
      return { protokoll: 'Nachricht (Echo)', felder: [{ name: 'Antwort', wert: p.inhalt }] };
    case 'dns-anfrage':
      return { protokoll: 'DNS', felder: [{ name: 'Frage', wert: `IP-Adresse von ${p.domain}?` }] };
    case 'dns-antwort':
      return {
        protokoll: 'DNS',
        felder: [{ name: 'Antwort', wert: p.ip ? `${p.domain} → ${p.ip}` : `${p.domain}: unbekannt` }],
      };
    case 'http-anfrage':
      return {
        protokoll: 'HTTP',
        felder: [
          { name: 'Anfrage', wert: `GET ${p.pfad}` },
          { name: 'Host', wert: p.host },
        ],
      };
    case 'http-antwort':
      return {
        protokoll: 'HTTP',
        felder: [
          { name: 'Status', wert: p.status === 200 ? '200 OK' : '404 Not Found' },
          { name: 'Inhalt', wert: p.status === 200 ? `HTML-Seite (${p.html.length} Zeichen)` : '–' },
        ],
      };
    case 'abgelehnt':
      return {
        protokoll: p.dienst === 'webserver' ? 'HTTP' : 'DNS',
        felder: [{ name: 'Fehler', wert: 'Dienst nicht erreichbar' }],
      };
  }
}

function transport(p: Paket): Schichten['transport'] {
  const art =
    p.art === 'http-anfrage' ||
    p.art === 'http-antwort' ||
    (p.art === 'abgelehnt' && p.dienst === 'webserver')
      ? 'http'
      : p.art === 'dns-anfrage' || p.art === 'dns-antwort' || p.art === 'abgelehnt'
        ? 'dns'
        : 'nachricht';
  const protokoll = art === 'http' ? 'TCP' : 'UDP';
  const dienstPort = DIENST_PORT[art];
  const istAnfrage = p.art === 'nachricht' || p.art === 'dns-anfrage' || p.art === 'http-anfrage';
  const client = clientPort(istAnfrage ? p.id : (p.bezug ?? p.id));
  return {
    protokoll,
    felder: [
      { name: 'Quellport', wert: String(istAnfrage ? client : dienstPort) },
      { name: 'Zielport', wert: String(istAnfrage ? dienstPort : client) },
    ],
  };
}

/**
 * Schichten eines Pakets auf dem Abschnitt `vonId → (Gerät mit hopIp)` über `leitungId`.
 * Auf der Netzzugangsschicht steht der Empfänger *dieses Abschnitts* (nächster Router oder das Ziel),
 * nicht das endgültige Ziel – genau das macht den Unterschied zwischen MAC- und IP-Adresse sichtbar.
 */
export function schichtenVon(
  netz: NetzDatei,
  p: Paket,
  vonId: string,
  leitungId: string,
  hopIp: string,
): Schichten {
  const hop = ipZuZahl(hopIp);
  const empfaenger = netz.geraete.find(
    (g) => hop !== null && schnittstellenVon(netz, g).some((s) => s.ip === hop),
  );
  const empfaengerLeitung =
    empfaenger && schnittstellenVon(netz, empfaenger).find((s) => s.ip === hop)?.leitungId;
  const von = findeGeraet(netz, vonId);
  const leitung = netz.leitungen.find((l) => l.id === leitungId);
  return {
    anwendung: anwendung(p),
    transport: transport(p),
    vermittlung: {
      protokoll: 'IP',
      felder: [
        { name: 'Quell-IP', wert: p.quelleIp || '–' },
        { name: 'Ziel-IP', wert: p.zielIp },
        { name: 'TTL', wert: String(p.ttl) },
      ],
    },
    netzzugang: {
      protokoll: leitung?.art === 'wlan' ? 'WLAN' : 'Ethernet (Kabel)',
      felder: [
        { name: 'Absender', wert: `${von?.name ?? vonId} (${macAdresse(vonId, leitungId)})` },
        {
          name: 'Empfänger',
          wert: empfaenger
            ? `${empfaenger.name} (${macAdresse(empfaenger.id, empfaengerLeitung ?? '')})`
            : `unbekannt (${hopIp})`,
        },
      ],
    },
  };
}

/** Vereinfachte Sicht für Klasse 7/8: 2-Schichten-Modell aus Dienst und Infrastruktur. */
export function zweiSchichten(netz: NetzDatei, p: Paket): { dienst: Feld[]; infrastruktur: Feld[] } {
  const a = anwendung(p);
  const name = (ip: string) => netz.geraete.find((g) => adresseVon(g)?.ip === ipZuZahl(ip))?.name ?? ip;
  return {
    dienst: [{ name: 'Dienst', wert: a.protokoll }, ...a.felder],
    infrastruktur: [
      { name: 'Von', wert: `${name(p.quelleIp)} (${p.quelleIp || '–'})` },
      { name: 'An', wert: `${name(p.zielIp)} (${p.zielIp})` },
    ],
  };
}

export type HopEintrag = Extract<ProtokollEintrag, { art: 'gesendet' | 'weitergeleitet' }>;

/** Zu einem Protokolleintrag mit Paket den passenden Abschnitt (gesendet/weitergeleitet) finden. */
export function hopEintrag(protokoll: readonly ProtokollEintrag[], nr: number): HopEintrag | undefined {
  const e = protokoll.find((x) => x.nr === nr);
  if (!e || !('paket' in e)) return undefined;
  if (e.art === 'gesendet' || e.art === 'weitergeleitet') return e;
  return protokoll.findLast(
    (x): x is HopEintrag =>
      (x.art === 'gesendet' || x.art === 'weitergeleitet') && x.nr < nr && x.paket.id === e.paket.id,
  );
}
