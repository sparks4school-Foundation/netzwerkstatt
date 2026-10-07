import { adresseVon, besitztIp, schnittstellenVon } from '../model/adressen';
import type { Dienst, Geraet, NetzDatei } from '../model/datei';
import { dienstVon, hatDienst } from '../model/dienste';
import { normalisiereDomain, normalisierePfad, zerlegeAdresse, type Adresse } from '../model/domain';
import { gleichesNetz, ipZuZahl, istPrivat, netzBeschreibung, zahlZuIp } from '../model/ip';
import { findeGeraet, geraetAendern, leitungAendern, leitungenVon } from '../model/netz';
import { aktivesNetz, gleichGuteRouten, routeFuer, routenVon, type Route } from '../model/routing';
import { istVerteilerImSegment, nachbarn, segment, weg } from '../model/topologie';
import { Ereigniswarteschlange } from './ereignisse';
import { erzeugeZufall } from './zufall';

/**
 * Simulation des Nachrichtenaustauschs (Phase 2: lokales Rechnernetz, Phase 3: DNS und HTTP,
 * Phase 4a: Routing zwischen Netzen).
 *
 * Zeitmodell: Ein Schritt = jedes Paket, das gerade auf einer Leitung ist, kommt beim nächsten Gerät an
 * und wird dort verarbeitet. Animation und Geschwindigkeit sind Sache der Oberfläche.
 * Die Simulation arbeitet auf einer Kopie des Netzes. Einzige erlaubte Änderung während des Laufs:
 * Leitungen ausfallen lassen (Routingszenarien). Alles andere erfordert eine neue Simulation.
 */

/** Startwert der Lebensdauer (TTL): So viele Router darf ein Paket höchstens passieren. */
export const START_TTL = 16;

/**
 * Nach so vielen Schritten ohne Antwort gibt der Browser auf. Hängt von der Netzgröße ab, damit auch
 * der längste mögliche Hin- und Rückweg hineinpasst (jede Leitung höchstens einmal je Richtung).
 */
export function zeitlimit(netz: NetzDatei): number {
  return Math.max(8, 2 * netz.leitungen.length + 2);
}

/** Inhalt eines Pakets – entspricht der Anwendungsschicht. */
export type PaketDaten =
  | { art: 'nachricht'; inhalt: string }
  | { art: 'antwort'; inhalt: string }
  | { art: 'dns-anfrage'; domain: string }
  | { art: 'dns-antwort'; domain: string; ip: string | null }
  | { art: 'http-anfrage'; host: string; pfad: string }
  | { art: 'http-antwort'; pfad: string; status: 200 | 404; html: string }
  /** Auf dem Zielgerät läuft der angefragte Dienst nicht. */
  | { art: 'abgelehnt'; dienst: 'webserver' | 'dns-server' }
  /** Teil einer in Pakete zerlegten Nachricht (paketorientierte Datenübertragung, TK 4). */
  | { art: 'teil'; sendungId: string; nr: number; anzahl: number; inhalt: string }
  /** Empfänger bestätigt einen Teil (wie TCP). */
  | { art: 'bestaetigung'; sendungId: string; nr: number; anzahl: number }
  /** DHCP: „Gibt es hier einen DHCP-Server?“ (Rundsendung) */
  | { art: 'dhcp-discover'; clientId: string }
  /** DHCP: Server bietet eine Adresse an */
  | ({ art: 'dhcp-offer'; clientId: string } & DhcpAngebot)
  /** DHCP: Client nimmt das Angebot an (Rundsendung, damit alle Server es erfahren) */
  | { art: 'dhcp-request'; clientId: string; ip: string; serverIp: string }
  /** DHCP: Server bestätigt – ab jetzt gilt die Adresse */
  | ({ art: 'dhcp-ack'; clientId: string } & DhcpAngebot);

export interface DhcpAngebot {
  ip: string;
  subnetzmaske: string;
  gateway: string;
  dnsServer: string;
}

/** Ziel-IP einer Rundsendung an alle Geräte im lokalen Rechnernetz. */
export const RUNDSENDUNG = '255.255.255.255';

export type DhcpZustand =
  | { phase: 'suche' }
  | { phase: 'anfrage'; angebot: DhcpAngebot; serverIp: string }
  | { phase: 'fertig'; angebot: DhcpAngebot; serverIp: string }
  | { phase: 'fehler' };

export interface NatEintrag {
  anfrageId: string;
  innenIp: string;
  aussenIp: string;
  /** Anschauliche Portnummer der Übersetzung (die Simulation ordnet Antworten über die Anfrage zu). */
  port: number;
  zielIp: string;
}

export type PaketArt = PaketDaten['art'];

export type Paket = PaketDaten & {
  id: string;
  quelleIp: string;
  zielIp: string;
  /** Gerät, das dieses Paket losgeschickt hat. */
  absenderId: string;
  /** Lebensdauer: Jeder Router zieht 1 ab; bei 0 wird das Paket verworfen (verhindert Endlosschleifen). */
  ttl: number;
  /** Bei Antworten: ID der Anfrage. */
  bezug?: string;
  /** Bei Antworten: Gerät, das die Anfrage gestellt hat (für den Hinweis „beim falschen Gerät“). */
  erwartetVon?: string;
};

const anfragen: PaketArt[] = [
  'nachricht',
  'dns-anfrage',
  'http-anfrage',
  'teil',
  'dhcp-discover',
  'dhcp-request',
];
export const istAnfrage = (p: Paket) => anfragen.includes(p.art);

export interface Unterwegs {
  paket: Paket;
  leitungId: string;
  vonId: string;
  nachId: string;
  /** IP-Adresse des nächsten Geräts auf dem Weg (Ziel selbst oder nächster Router). */
  hopIp: string;
  start: number;
  ende: number;
}

export type SendeFehler =
  | { grund: 'keine-ip' }
  | { grund: 'ziel-ungueltig' }
  | { grund: 'eigene-ip' }
  | { grund: 'nicht-verbunden' }
  | { grund: 'leitung-ausgefallen' }
  | { grund: 'anderes-netz'; eigenesNetz: string }
  | { grund: 'gateway-falsch'; eigenesNetz: string; gateway: string }
  | { grund: 'keine-route' }
  | { grund: 'dhcp-fehlt' };

export type VerwerfGrund =
  | 'kein-ziel'
  | 'falsche-ip'
  | 'keine-route'
  | 'ttl'
  | 'leitung-ausgefallen'
  /** Auf einer gestörten Leitung verloren gegangen (Zufall mit festem Startwert). */
  | 'stoerung'
  /** Rundsendung erreicht ein Gerät, das nicht zuständig ist (z. B. kein DHCP-Server). */
  | 'rundsendung-ignoriert';

/** Einstellungen der Simulation (Klasse 11, Paketvermittlung). */
export interface SimOptionen {
  /** Router verteilen Pakete abwechselnd auf gleich gute Wege. */
  mehrwege: boolean;
  /** Empfänger bestätigt Teile; fehlende Teile werden erneut gesendet (wie TCP). */
  bestaetigen: boolean;
  /** Startwert für den Zufall (Paketverlust) – gleicher Startwert, gleicher Ablauf. */
  startwert: number;
}

export const STANDARD_OPTIONEN: SimOptionen = { mehrwege: false, bestaetigen: true, startwert: 1 };

/** So oft wird ein unbestätigter Teil höchstens erneut gesendet. */
export const MAX_WIEDERHOLUNGEN = 5;

/** Zustand einer in Teile zerlegten Nachricht beim Empfänger. */
export interface Empfangspuffer {
  sendungId: string;
  absenderId: string;
  anzahl: number;
  /** Teil je Position (Index = Nr − 1); `null` = fehlt noch. */
  teile: (string | null)[];
  /** Nummern der Teile in der Reihenfolge, in der sie angekommen sind. */
  ankunft: number[];
  text: string | null;
}

/** Zustand beim Absender. */
export interface Sendung {
  sendungId: string;
  absenderId: string;
  zielIp: string;
  teile: string[];
  bestaetigt: number[];
  aufgegeben: boolean;
}

/** Die Route, nach der ein Router entschieden hat – für Protokoll und Whitebox-Ansicht. */
export interface GenutzteRoute {
  ziel: string;
  subnetzmaske: string;
  gateway: string | null;
}

export type BrowserFehler =
  | { grund: 'kein-browser' }
  | { grund: 'adresse-ungueltig' }
  | { grund: 'kein-dns-server' }
  | { grund: 'domain-unbekannt'; domain: string }
  | { grund: 'keine-antwort'; von: 'dns-server' | 'webserver'; ip: string }
  | { grund: 'dienst-fehlt'; dienst: 'webserver' | 'dns-server'; ip: string }
  | { grund: 'senden'; fehler: SendeFehler; ip: string };

export type BrowserZustand =
  | { phase: 'dns'; eingabe: string; adresse: Adresse; anfrageId: string; dnsIp: string }
  | { phase: 'laden'; eingabe: string; adresse: Adresse; anfrageId: string; ip: string }
  | { phase: 'fertig'; eingabe: string; adresse: Adresse; ip: string; status: 200 | 404; html: string }
  | { phase: 'fehler'; eingabe: string; adresse?: Adresse; fehler: BrowserFehler };

export type ProtokollEintrag = { nr: number; zeit: number; geraetId: string } & (
  | { art: 'gesendet'; nachId: string; leitungId: string; hopIp: string; paket: Paket; route?: GenutzteRoute }
  | {
      art: 'weitergeleitet';
      nachId: string;
      leitungId: string;
      hopIp: string;
      paket: Paket;
      route?: GenutzteRoute;
    }
  | { art: 'empfangen'; paket: Paket }
  | { art: 'verworfen'; paket: Paket; grund: VerwerfGrund; vonId?: string }
  | { art: 'nicht-gesendet'; zielIp: string; fehler: SendeFehler }
  | { art: 'ip-doppelt'; paket: Paket; geraeteIds: string[] }
  | { art: 'falscher-empfaenger'; paket: Paket; erwartetId: string }
  | { art: 'aufruf'; eingabe: string }
  | { art: 'browser-fehler'; fehler: BrowserFehler }
  | { art: 'seite-angezeigt'; adresse: Adresse; status: 200 | 404 }
  | { art: 'zerlegt'; sendungId: string; anzahl: number; zielIp: string }
  | { art: 'einsortiert'; sendungId: string; teilNr: number; anzahl: number; alsWievielter: number }
  | { art: 'teil-doppelt'; sendungId: string; teilNr: number }
  | { art: 'zusammengesetzt'; sendungId: string; text: string; anzahl: number; inReihenfolge: boolean }
  | { art: 'erneut-gesendet'; sendungId: string; teilNr: number; versuch: number }
  | { art: 'aufgegeben'; sendungId: string; fehlende: number[] }
  | { art: 'dhcp-start' }
  | { art: 'dhcp-erhalten'; angebot: DhcpAngebot; serverIp: string }
  | { art: 'dhcp-fehlgeschlagen' }
  | { art: 'dhcp-voll' }
  | { art: 'nat'; richtung: 'aus' | 'ein'; innenIp: string; aussenIp: string; port: number }
);

/** Logische Verbindung zwischen Client und Dienst (Dienste-Ansicht, TK 1). */
export interface LogischeVerbindung {
  clientId: string;
  serverId: string;
  protokoll: 'DNS' | 'HTTP' | 'Nachricht';
}

type Ereignis =
  | { typ: 'ankunft'; paket: Paket; geraetId: string; vonId: string; leitungId: string; hopIp: string }
  | { typ: 'zeitablauf'; geraetId: string; anfrageId: string }
  | { typ: 'teil-senden'; sendungId: string; nr: number }
  | { typ: 'teil-zeitablauf'; sendungId: string; nr: number }
  | { typ: 'dhcp-zeitablauf'; geraetId: string };

type OhneKopf<T> = T extends unknown ? Omit<T, 'nr' | 'zeit'> : never;

export class Simulation {
  #netz: NetzDatei;
  /** Netz ohne ausgefallene Leitungen – darauf laufen Weg- und Segmentberechnungen. */
  #aktiv: NetzDatei;
  #warteschlange = new Ereigniswarteschlange<Ereignis>();
  #unterwegs: Unterwegs[] = [];
  #protokoll: ProtokollEintrag[] = [];
  #browser = new Map<string, BrowserZustand>();
  #paketNr = 0;
  #optionen: SimOptionen;
  #zufall: () => number;
  #sendungen = new Map<string, Sendung & { versuche: Map<number, number> }>();
  #empfang = new Map<string, Empfangspuffer>();
  /** Zähler je Router für das abwechselnde Verteilen auf gleich gute Wege. */
  #reihum = new Map<string, number>();
  #dhcp = new Map<string, DhcpZustand>();
  /** Vergebene Adressen je DHCP-Server: clientId → IP */
  #leases = new Map<string, Map<string, string>>();
  #nat = new Map<string, NatEintrag[]>();

  constructor(netz: NetzDatei, optionen: Partial<SimOptionen> = {}) {
    this.#netz = netz;
    this.#aktiv = aktivesNetz(netz);
    this.#optionen = { ...STANDARD_OPTIONEN, ...optionen };
    this.#zufall = erzeugeZufall(this.#optionen.startwert);
  }

  get optionen(): SimOptionen {
    return this.#optionen;
  }

  /** Optionen während des Laufs ändern (der Zufall läuft mit seinem Startwert weiter). */
  setzeOptionen(optionen: Partial<Omit<SimOptionen, 'startwert'>>): void {
    this.#optionen = { ...this.#optionen, ...optionen };
  }

  dhcpZustand(geraetId: string): DhcpZustand | undefined {
    return this.#dhcp.get(geraetId);
  }

  natTabelle(routerId: string): readonly NatEintrag[] {
    return this.#nat.get(routerId) ?? [];
  }

  /**
   * Endgerät fragt per DHCP nach einer Adresse: Discover (Rundsendung) → Offer → Request (Rundsendung) → Ack.
   */
  dhcpAnfordern(geraetId: string): void {
    const g = this.#geraet(geraetId);
    const leitung = leitungenVon(this.#aktiv, g.id)[0];
    this.#protokolliere({ art: 'dhcp-start', geraetId });
    this.#warteschlange.entfernen((e) => e.typ === 'dhcp-zeitablauf' && e.geraetId === geraetId);
    if (!leitung) {
      this.#dhcp.set(geraetId, { phase: 'fehler' });
      this.#protokolliere({ art: 'dhcp-fehlgeschlagen', geraetId });
      return;
    }
    this.#dhcp.set(geraetId, { phase: 'suche' });
    this.#rundsenden(g, leitung.id, { art: 'dhcp-discover', clientId: g.id }, '0.0.0.0');
    this.#warteschlange.planen(zeitlimit(this.#netz), { typ: 'dhcp-zeitablauf', geraetId });
  }

  /** Empfangspuffer eines Geräts (zerlegte Nachrichten, die dort ankommen). */
  empfangspuffer(geraetId: string): Empfangspuffer[] {
    return [...this.#empfang.entries()].filter(([k]) => k.startsWith(`${geraetId}|`)).map(([, v]) => v);
  }

  /** Sendungen eines Geräts (zerlegte Nachrichten, die es verschickt). */
  sendungenVon(geraetId: string): Sendung[] {
    return [...this.#sendungen.values()]
      .filter((s) => s.absenderId === geraetId)
      .map((s) => ({
        sendungId: s.sendungId,
        absenderId: s.absenderId,
        zielIp: s.zielIp,
        teile: s.teile,
        bestaetigt: s.bestaetigt,
        aufgegeben: s.aufgegeben,
      }));
  }

  get netz(): NetzDatei {
    return this.#netz;
  }

  /** Störung während des Laufs: Leitung fällt aus oder funktioniert wieder. */
  leitungAusfallen(leitungId: string, ausgefallen: boolean): void {
    this.leitungAendern(leitungId, { ausgefallen });
  }

  /** Eigenschaften einer Leitung während des Laufs ändern (Ausfall, Verlust, Verzögerung). */
  leitungAendern(leitungId: string, aenderung: Parameters<typeof leitungAendern>[2]): void {
    this.#netz = leitungAendern(this.#netz, leitungId, aenderung);
    this.#aktiv = aktivesNetz(this.#netz);
  }

  get zeit(): number {
    return this.#warteschlange.zeit;
  }

  /** Ist noch etwas unterwegs oder wartet ein Browser auf eine Antwort? */
  get aktiv(): boolean {
    return !this.#warteschlange.leer;
  }

  get unterwegs(): readonly Unterwegs[] {
    return this.#unterwegs;
  }

  get protokoll(): readonly ProtokollEintrag[] {
    return this.#protokoll;
  }

  browser(geraetId: string): BrowserZustand | undefined {
    return this.#browser.get(geraetId);
  }

  /** Alle Client-Dienst-Paare, die bisher tatsächlich miteinander kommuniziert haben. */
  get verbindungen(): LogischeVerbindung[] {
    const ergebnis = new Map<string, LogischeVerbindung>();
    for (const e of this.#protokoll) {
      if (e.art !== 'empfangen' || !istAnfrage(e.paket)) continue;
      const protokoll =
        e.paket.art === 'dns-anfrage' ? 'DNS' : e.paket.art === 'http-anfrage' ? 'HTTP' : 'Nachricht';
      const v = { clientId: e.paket.absenderId, serverId: e.geraetId, protokoll } as const;
      ergebnis.set(`${v.clientId}>${v.serverId}>${protokoll}`, v);
    }
    return [...ergebnis.values()];
  }

  /** Testnachricht (wie „ping“): Das Ziel antwortet automatisch. */
  senden(vonId: string, zielIpText: string, inhalt: string): { ok: true } | ({ ok: false } & SendeFehler) {
    const fehler = this.#sende(this.#geraet(vonId), zielIpText, { art: 'nachricht', inhalt });
    return fehler ? { ok: false, ...fehler } : { ok: true };
  }

  /**
   * Zerlegt einen Text in Teile zu je `zeichenProTeil` Zeichen und schickt sie nacheinander los
   * (ein Teil pro Schritt). Der Empfänger setzt sie wieder zusammen.
   */
  inPaketenSenden(
    vonId: string,
    zielIpText: string,
    text: string,
    zeichenProTeil: number,
  ): { ok: true; sendungId: string; anzahl: number } | ({ ok: false } & SendeFehler) {
    const von = this.#geraet(vonId);
    const pruefung = this.#pruefeSenden(von, zielIpText);
    if ('grund' in pruefung) {
      this.#protokolliere({
        art: 'nicht-gesendet',
        geraetId: vonId,
        zielIp: zielIpText.trim(),
        fehler: pruefung,
      });
      return { ok: false, ...pruefung };
    }
    const groesse = Math.max(1, Math.floor(zeichenProTeil));
    const teile: string[] = [];
    for (let i = 0; i < Math.max(text.length, 1); i += groesse) teile.push(text.slice(i, i + groesse));
    const sendungId = `s${this.#sendungen.size + 1}`;
    this.#sendungen.set(sendungId, {
      sendungId,
      absenderId: vonId,
      zielIp: zielIpText.trim(),
      teile,
      bestaetigt: [],
      aufgegeben: false,
      versuche: new Map(),
    });
    this.#protokolliere({
      art: 'zerlegt',
      geraetId: vonId,
      sendungId,
      anzahl: teile.length,
      zielIp: zielIpText.trim(),
    });
    this.#teilSenden(sendungId, 1);
    for (let nr = 2; nr <= teile.length; nr++)
      this.#warteschlange.planen(nr - 1, { typ: 'teil-senden', sendungId, nr });
    return { ok: true, sendungId, anzahl: teile.length };
  }

  /** Browser auf `geraetId` ruft eine Adresse auf (Domain oder IP-Adresse, optional mit Pfad). */
  aufrufen(geraetId: string, eingabe: string): BrowserZustand {
    const g = this.#geraet(geraetId);
    this.#protokolliere({ art: 'aufruf', geraetId, eingabe: eingabe.trim() });
    if (!hatDienst(g, 'browser')) return this.#browserFehler(g, eingabe, { grund: 'kein-browser' });
    const adresse = zerlegeAdresse(eingabe);
    if (!adresse) return this.#browserFehler(g, eingabe, { grund: 'adresse-ungueltig' });

    // Eine eventuell noch laufende Anfrage dieses Browsers wird abgebrochen.
    this.#zeitlimitEntfernen(g.id);

    if (adresse.istIp) return this.#seiteAnfordern(g, eingabe, adresse, adresse.host);

    const dnsIp = g.dnsServer?.trim() ?? '';
    if (!dnsIp || ipZuZahl(dnsIp) === null)
      return this.#browserFehler(g, eingabe, { grund: 'kein-dns-server' }, adresse);
    const anfrage = this.#neuesPaket(g, dnsIp, { art: 'dns-anfrage', domain: adresse.host });
    const fehler = this.#sendePaket(g, anfrage);
    if (fehler) return this.#browserFehler(g, eingabe, { grund: 'senden', fehler, ip: dnsIp }, adresse);
    return this.#setzeBrowser(g.id, { phase: 'dns', eingabe, adresse, anfrageId: anfrage.id, dnsIp });
  }

  /** Führt einen Schritt aus: alle Pakete auf den Leitungen kommen an und werden verarbeitet. */
  schritt(): void {
    if (this.#warteschlange.leer) return;
    // Die Uhr läuft immer genau einen Schritt weiter – auch wenn gerade nichts ankommt
    // (z. B. Paket auf einer langen Leitung), damit man Laufzeiten sieht.
    const zeit = this.zeit + 1;
    this.#warteschlange.vorstellen(zeit);
    const jetzt: Ereignis[] = [];
    while (this.#warteschlange.naechsteZeit === zeit) jetzt.push(this.#warteschlange.naechstes()!.daten);
    // Erst alle ankommenden Pakete, dann neue Teile, dann abgelaufene Zeitlimits: Kommt eine Antwort genau
    // im letzten erlaubten Schritt an, zählt sie noch.
    for (const daten of jetzt) {
      if (daten.typ !== 'ankunft') continue;
      this.#unterwegs = this.#unterwegs.filter((u) => u.paket !== daten.paket);
      this.#verarbeite(daten.paket, daten.geraetId, daten.leitungId, daten.hopIp, daten.vonId);
    }
    for (const daten of jetzt) if (daten.typ === 'teil-senden') this.#teilSenden(daten.sendungId, daten.nr);
    for (const daten of jetzt) {
      if (daten.typ === 'zeitablauf') this.#zeitAbgelaufen(daten.geraetId, daten.anfrageId);
      if (daten.typ === 'teil-zeitablauf') this.#teilZeitAbgelaufen(daten.sendungId, daten.nr);
      if (daten.typ === 'dhcp-zeitablauf' && this.#dhcp.get(daten.geraetId)?.phase !== 'fertig') {
        this.#dhcp.set(daten.geraetId, { phase: 'fehler' });
        this.#protokolliere({ art: 'dhcp-fehlgeschlagen', geraetId: daten.geraetId });
      }
    }
  }

  // --- Senden -------------------------------------------------------------------------------------

  #neuesPaket(von: Geraet, zielIp: string, daten: PaketDaten, bezug?: Paket, quelleIp?: string): Paket {
    return {
      ...daten,
      id: `p${++this.#paketNr}`,
      quelleIp: quelleIp ?? von.ip?.trim() ?? '',
      zielIp: zielIp.trim(),
      absenderId: von.id,
      ttl: START_TTL,
      ...(bezug ? { bezug: bezug.id, erwartetVon: bezug.absenderId } : {}),
    };
  }

  /** Prüft, baut und verschickt ein Paket; Fehler werden protokolliert und zurückgegeben. */
  #sende(von: Geraet, zielIp: string, daten: PaketDaten, bezug?: Paket): SendeFehler | null {
    if (von.typ === 'router') return this.#routerSendet(von, zielIp, daten, bezug);
    return this.#sendePaket(von, this.#neuesPaket(von, zielIp, daten, bezug));
  }

  #sendePaket(von: Geraet, paket: Paket): SendeFehler | null {
    const ergebnis = this.#pruefeSenden(von, paket.zielIp);
    if ('grund' in ergebnis) {
      this.#protokolliere({
        art: 'nicht-gesendet',
        geraetId: von.id,
        zielIp: paket.zielIp,
        fehler: ergebnis,
      });
      return ergebnis;
    }
    if (istAnfrage(paket)) this.#hinweisBeiDoppelterZielIp(von, paket);
    const leitung = leitungenVon(this.#aktiv, von.id)[0]!;
    this.#aufLeitung(von.id, leitung.id, paket, 'gesendet', ergebnis.hopIp);
    return null;
  }

  /**
   * Prüft, ob ein Endgerät senden kann, und bestimmt den nächsten Schritt: Liegt das Ziel im eigenen Netz,
   * geht es direkt dorthin, sonst zum Gateway (Router).
   */
  #pruefeSenden(von: Geraet, zielIpText: string): SendeFehler | { hopIp: string } {
    const eigene = adresseVon(von);
    if (!eigene) return von.dhcp ? { grund: 'dhcp-fehlt' } : { grund: 'keine-ip' };
    const ziel = ipZuZahl(zielIpText);
    if (ziel === null) return { grund: 'ziel-ungueltig' };
    if (ziel === eigene.ip) return { grund: 'eigene-ip' };
    if (leitungenVon(this.#netz, von.id).length === 0) return { grund: 'nicht-verbunden' };
    if (leitungenVon(this.#aktiv, von.id).length === 0) return { grund: 'leitung-ausgefallen' };
    if (gleichesNetz(ziel, eigene.ip, eigene.maske)) return { hopIp: zahlZuIp(ziel) };
    const eigenesNetz = netzBeschreibung(eigene.ip, eigene.maske);
    if (eigene.gateway === null) return { grund: 'anderes-netz', eigenesNetz };
    if (!gleichesNetz(eigene.gateway, eigene.ip, eigene.maske)) {
      return { grund: 'gateway-falsch', eigenesNetz, gateway: zahlZuIp(eigene.gateway) };
    }
    return { hopIp: zahlZuIp(eigene.gateway) };
  }

  /** Ein Router schickt selbst ein Paket (z. B. Antwort auf eine an ihn gerichtete Nachricht). */
  #routerSendet(router: Geraet, zielIp: string, daten: PaketDaten, bezug?: Paket): SendeFehler | null {
    const ziel = ipZuZahl(zielIp);
    const route = ziel === null ? null : routeFuer(routenVon(this.#netz, router.id), ziel);
    if (!route) {
      const fehler: SendeFehler = { grund: 'keine-route' };
      this.#protokolliere({ art: 'nicht-gesendet', geraetId: router.id, zielIp, fehler });
      return fehler;
    }
    const quelle = schnittstellenVon(this.#netz, router).find((s) => s.leitungId === route.leitungId);
    const paket = this.#neuesPaket(router, zielIp, daten, bezug, quelle ? zahlZuIp(quelle.ip) : '');
    this.#aufLeitung(router.id, route.leitungId, paket, 'gesendet', zahlZuIp(route.gateway ?? ziel!), route);
    return null;
  }

  /** Router leitet ein fremdes Paket nach seiner Routingtabelle weiter. */
  #routerLeitetWeiter(router: Geraet, eingang: Paket) {
    const paket = { ...eingang, ttl: eingang.ttl - 1 };
    if (paket.ttl <= 0) {
      this.#protokolliere({ art: 'verworfen', geraetId: router.id, paket, grund: 'ttl' });
      return;
    }
    const ziel = ipZuZahl(paket.zielIp)!;
    const route = this.#waehleRoute(router.id, ziel);
    if (!route) {
      this.#protokolliere({ art: 'verworfen', geraetId: router.id, paket, grund: 'keine-route' });
      return;
    }
    this.#aufLeitung(
      router.id,
      route.leitungId,
      this.#natAusgehend(router, paket, route.leitungId),
      'weitergeleitet',
      zahlZuIp(route.gateway ?? ziel),
      route,
    );
  }

  /** Rundsendung über eine bestimmte Leitung (DHCP): geht an alle Geräte im lokalen Rechnernetz. */
  #rundsenden(von: Geraet, leitungId: string, daten: PaketDaten, quelleIp: string, bezug?: Paket) {
    const paket = this.#neuesPaket(von, RUNDSENDUNG, daten, bezug, quelleIp);
    this.#aufLeitung(von.id, leitungId, paket, 'gesendet', RUNDSENDUNG);
  }

  /** NAT: Paket aus privatem Netz verlässt den Router über den Internet-Anschluss → Absender übersetzen. */
  #natAusgehend(router: Geraet, paket: Paket, leitungId: string): Paket {
    if (!router.nat || router.nat.aussenLeitungId !== leitungId) return paket;
    const quelle = ipZuZahl(paket.quelleIp);
    if (quelle === null || !istPrivat(quelle)) return paket;
    const aussen = schnittstellenVon(this.#netz, router).find((s) => s.leitungId === leitungId);
    if (!aussen) return paket;
    const tabelle = this.#nat.get(router.id) ?? [];
    const eintrag: NatEintrag = {
      anfrageId: paket.id,
      innenIp: paket.quelleIp,
      aussenIp: zahlZuIp(aussen.ip),
      port: 50000 + tabelle.length + 1,
      zielIp: paket.zielIp,
    };
    this.#nat.set(router.id, [...tabelle, eintrag]);
    this.#protokolliere({
      art: 'nat',
      geraetId: router.id,
      richtung: 'aus',
      innenIp: eintrag.innenIp,
      aussenIp: eintrag.aussenIp,
      port: eintrag.port,
    });
    return { ...paket, quelleIp: eintrag.aussenIp };
  }

  /** Route wählen; mit „verschiedene Wege“ reihum über alle gleich guten Wege. */
  #waehleRoute(routerId: string, ziel: number): Route | null {
    if (!this.#optionen.mehrwege) return routeFuer(routenVon(this.#netz, routerId), ziel);
    const kandidaten = gleichGuteRouten(this.#netz, routerId, ziel);
    if (kandidaten.length <= 1) return kandidaten[0] ?? null;
    const n = this.#reihum.get(routerId) ?? 0;
    this.#reihum.set(routerId, n + 1);
    return kandidaten[n % kandidaten.length]!;
  }

  #aufLeitung(
    vonId: string,
    leitungId: string,
    paket: Paket,
    art: 'gesendet' | 'weitergeleitet',
    hopIp: string,
    route?: Route,
  ) {
    const leitung = this.#netz.leitungen.find((l) => l.id === leitungId);
    if (!leitung || leitung.ausgefallen) {
      // z. B. manuelle Routingtabelle zeigt auf eine ausgefallene Leitung
      this.#protokolliere({ art: 'verworfen', geraetId: vonId, paket, grund: 'leitung-ausgefallen' });
      return;
    }
    const nachId = leitung.von === vonId ? leitung.nach : leitung.von;
    const zeit = this.zeit;
    const dauer = leitung.verzoegerung ?? 1;
    this.#unterwegs.push({ paket, leitungId, vonId, nachId, hopIp, start: zeit, ende: zeit + dauer });
    this.#warteschlange.planen(dauer, { typ: 'ankunft', paket, geraetId: nachId, vonId, leitungId, hopIp });
    const genutzt = route && {
      ziel: zahlZuIp(route.ziel),
      subnetzmaske: zahlZuIp(route.maske),
      gateway: route.gateway === null ? null : zahlZuIp(route.gateway),
    };
    this.#protokolliere({
      art,
      geraetId: vonId,
      nachId,
      leitungId,
      hopIp,
      paket,
      ...(genutzt ? { route: genutzt } : {}),
    });
  }

  // --- Empfangen ----------------------------------------------------------------------------------

  #verarbeite(paket: Paket, geraetId: string, leitungId: string, hopIp: string, vonId: string) {
    const g = this.#geraet(geraetId);
    const leitung = this.#netz.leitungen.find((l) => l.id === leitungId);

    // Leitung ist ausgefallen, während das Paket unterwegs war → es kommt nie an.
    if (leitung?.ausgefallen) {
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'leitung-ausgefallen' });
      return;
    }
    // Gestörte Leitung: Paket geht mit der eingestellten Wahrscheinlichkeit verloren.
    if (leitung?.verlust && this.#zufall() * 100 < leitung.verlust) {
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'stoerung', vonId });
      return;
    }

    if (istVerteilerImSegment(g) && hopIp === RUNDSENDUNG) {
      // Rundsendung: an alle Anschlüsse außer dem, über den sie kam (Fluten).
      for (const n of nachbarn(this.#aktiv, g.id)) {
        if (n.leitung.id !== leitungId) {
          this.#aufLeitung(g.id, n.leitung.id, { ...paket }, 'weitergeleitet', RUNDSENDUNG);
        }
      }
      return;
    }

    if (istVerteilerImSegment(g)) {
      // Switch/Access Point: zum nächstgelegenen Gerät mit der IP des nächsten Schritts weiterleiten.
      const ziel = this.#naechstesGeraetMitIp(g.id, hopIp);
      const pfad = ziel && weg(this.#aktiv, g.id, ziel.id);
      if (!pfad?.[0]) {
        this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'kein-ziel' });
        return;
      }
      this.#aufLeitung(g.id, pfad[0].id, paket, 'weitergeleitet', hopIp);
      return;
    }

    if (hopIp === RUNDSENDUNG) {
      this.#rundsendungEmpfangen(g, paket, leitungId);
      return;
    }

    const hop = ipZuZahl(hopIp);
    if (hop === null || !besitztIp(this.#netz, g, hop)) {
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'falsche-ip' });
      return;
    }

    const ziel = ipZuZahl(paket.zielIp)!;
    // NAT: Antwort an die öffentliche Adresse → über die NAT-Tabelle zurück an das Gerät im Heimnetz.
    if (g.typ === 'router' && g.nat && besitztIp(this.#netz, g, ziel) && paket.bezug) {
      const eintrag = this.#nat.get(g.id)?.find((e) => e.anfrageId === paket.bezug);
      if (eintrag) {
        this.#protokolliere({
          art: 'nat',
          geraetId: g.id,
          richtung: 'ein',
          innenIp: eintrag.innenIp,
          aussenIp: eintrag.aussenIp,
          port: eintrag.port,
        });
        // TTL wie bei normaler Weiterleitung nur einmal verringern
        this.#routerLeitetWeiter(g, { ...paket, zielIp: eintrag.innenIp });
        return;
      }
    }
    if (!besitztIp(this.#netz, g, ziel)) {
      if (g.typ === 'router') this.#routerLeitetWeiter(g, paket);
      else this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'falsche-ip' });
      return;
    }

    this.#protokolliere({ art: 'empfangen', geraetId, paket });
    if (paket.erwartetVon && paket.erwartetVon !== g.id) {
      this.#protokolliere({ art: 'falscher-empfaenger', geraetId, paket, erwartetId: paket.erwartetVon });
    }

    switch (paket.art) {
      case 'nachricht':
        this.#sende(g, paket.quelleIp, { art: 'antwort', inhalt: paket.inhalt }, paket);
        return;
      case 'dns-anfrage':
        this.#dnsBeantworten(g, paket);
        return;
      case 'http-anfrage':
        this.#httpBeantworten(g, paket);
        return;
      case 'dns-antwort':
      case 'http-antwort':
      case 'abgelehnt':
        this.#antwortImBrowser(g, paket);
        return;
      case 'teil':
        this.#teilEmpfangen(g, paket);
        return;
      case 'bestaetigung':
        this.#bestaetigungEmpfangen(paket);
        return;
      case 'antwort':
        return;
    }
  }

  // --- DHCP ---------------------------------------------------------------------------------------

  #rundsendungEmpfangen(g: Geraet, paket: Paket, leitungId: string) {
    const server = dienstVon(g, 'dhcp-server');
    if (server && (paket.art === 'dhcp-discover' || paket.art === 'dhcp-request')) {
      this.#protokolliere({ art: 'empfangen', geraetId: g.id, paket });
      if (paket.art === 'dhcp-discover') this.#dhcpAnbieten(g, server, paket, leitungId);
      else this.#dhcpBestaetigen(g, server, paket, leitungId);
      return;
    }
    if ((paket.art === 'dhcp-offer' || paket.art === 'dhcp-ack') && paket.clientId === g.id) {
      this.#protokolliere({ art: 'empfangen', geraetId: g.id, paket });
      this.#dhcpAntwortAmClient(g, paket);
      return;
    }
    this.#protokolliere({ art: 'verworfen', geraetId: g.id, paket, grund: 'rundsendung-ignoriert' });
  }

  /** Eigene Adresse des DHCP-Servers an der Leitung, über die die Rundsendung kam. */
  #serverIp(server: Geraet, leitungId: string): string | null {
    const s = schnittstellenVon(this.#netz, server).find(
      (x) => server.typ !== 'router' || x.leitungId === leitungId,
    );
    return s ? zahlZuIp(s.ip) : null;
  }

  #dhcpAnbieten(
    server: Geraet,
    dienst: Extract<Dienst, { art: 'dhcp-server' }>,
    p: Extract<Paket, { art: 'dhcp-discover' }>,
    leitungId: string,
  ) {
    const eigeneIp = this.#serverIp(server, leitungId);
    const von = ipZuZahl(dienst.von);
    const bis = ipZuZahl(dienst.bis);
    if (!eigeneIp || von === null || bis === null) return;
    const leases = this.#leases.get(server.id) ?? new Map<string, string>();
    this.#leases.set(server.id, leases);
    let ip = leases.get(p.clientId) ?? null;
    if (!ip) {
      const belegt = new Set([
        ...this.#netz.geraete.flatMap((x) => schnittstellenVon(this.#netz, x)).map((x) => x.ip),
        ...[...leases.values()].map((x) => ipZuZahl(x)!),
      ]);
      for (let k = von; k <= bis; k++) {
        if (!belegt.has(k)) {
          ip = zahlZuIp(k);
          break;
        }
      }
    }
    if (!ip) {
      this.#protokolliere({ art: 'dhcp-voll', geraetId: server.id });
      return;
    }
    leases.set(p.clientId, ip);
    const angebot: DhcpAngebot = {
      ip,
      subnetzmaske: dienst.subnetzmaske,
      gateway: dienst.gateway,
      dnsServer: dienst.dnsServer,
    };
    this.#rundsenden(server, leitungId, { art: 'dhcp-offer', clientId: p.clientId, ...angebot }, eigeneIp, p);
  }

  #dhcpBestaetigen(
    server: Geraet,
    dienst: Extract<Dienst, { art: 'dhcp-server' }>,
    p: Extract<Paket, { art: 'dhcp-request' }>,
    leitungId: string,
  ) {
    const eigeneIp = this.#serverIp(server, leitungId);
    // Angebot eines anderen Servers angenommen → dieser Server gibt seine reservierte Adresse wieder frei.
    if (!eigeneIp || p.serverIp !== eigeneIp) {
      this.#leases.get(server.id)?.delete(p.clientId);
      return;
    }
    const angebot: DhcpAngebot = {
      ip: p.ip,
      subnetzmaske: dienst.subnetzmaske,
      gateway: dienst.gateway,
      dnsServer: dienst.dnsServer,
    };
    this.#rundsenden(server, leitungId, { art: 'dhcp-ack', clientId: p.clientId, ...angebot }, eigeneIp, p);
  }

  #dhcpAntwortAmClient(client: Geraet, p: Extract<Paket, { art: 'dhcp-offer' | 'dhcp-ack' }>) {
    const zustand = this.#dhcp.get(client.id);
    const angebot: DhcpAngebot = {
      ip: p.ip,
      subnetzmaske: p.subnetzmaske,
      gateway: p.gateway,
      dnsServer: p.dnsServer,
    };
    const leitung = leitungenVon(this.#aktiv, client.id)[0];
    if (p.art === 'dhcp-offer' && zustand?.phase === 'suche' && leitung) {
      // Erstes Angebot annehmen
      this.#dhcp.set(client.id, { phase: 'anfrage', angebot, serverIp: p.quelleIp });
      this.#rundsenden(
        client,
        leitung.id,
        { art: 'dhcp-request', clientId: client.id, ip: p.ip, serverIp: p.quelleIp },
        '0.0.0.0',
        p,
      );
      return;
    }
    if (p.art === 'dhcp-ack' && zustand?.phase === 'anfrage') {
      this.#warteschlange.entfernen((e) => e.typ === 'dhcp-zeitablauf' && e.geraetId === client.id);
      this.#dhcp.set(client.id, { phase: 'fertig', angebot, serverIp: p.quelleIp });
      // Ab jetzt gilt die Adresse – nur in dieser Simulation, nicht in der gespeicherten Datei.
      this.#netz = geraetAendern(this.#netz, client.id, {
        ip: angebot.ip,
        subnetzmaske: angebot.subnetzmaske,
        gateway: angebot.gateway,
        dnsServer: angebot.dnsServer,
        dhcp: false,
      });
      this.#aktiv = aktivesNetz(this.#netz);
      this.#protokolliere({ art: 'dhcp-erhalten', geraetId: client.id, angebot, serverIp: p.quelleIp });
    }
  }

  // --- Paketorientierte Datenübertragung ----------------------------------------------------------

  #teilSenden(sendungId: string, nr: number) {
    const s = this.#sendungen.get(sendungId);
    if (!s || s.aufgegeben || s.bestaetigt.includes(nr)) return;
    const von = this.#geraet(s.absenderId);
    const fehler = this.#sende(von, s.zielIp, {
      art: 'teil',
      sendungId,
      nr,
      anzahl: s.teile.length,
      inhalt: s.teile[nr - 1] ?? '',
    });
    if (!fehler && this.#optionen.bestaetigen) {
      this.#warteschlange.planen(zeitlimit(this.#netz), { typ: 'teil-zeitablauf', sendungId, nr });
    }
  }

  #teilEmpfangen(empfaenger: Geraet, p: Extract<Paket, { art: 'teil' }>) {
    const schluessel = `${empfaenger.id}|${p.sendungId}`;
    const puffer = this.#empfang.get(schluessel) ?? {
      sendungId: p.sendungId,
      absenderId: p.absenderId,
      anzahl: p.anzahl,
      teile: Array.from({ length: p.anzahl }, () => null),
      ankunft: [],
      text: null,
    };
    this.#empfang.set(schluessel, puffer);
    const geraetId = empfaenger.id;

    if (puffer.teile[p.nr - 1] !== null) {
      // Kam doppelt (z. B. weil die Bestätigung verloren ging) – nur erneut bestätigen.
      this.#protokolliere({ art: 'teil-doppelt', geraetId, sendungId: p.sendungId, teilNr: p.nr });
    } else {
      puffer.teile[p.nr - 1] = p.inhalt;
      puffer.ankunft.push(p.nr);
      this.#protokolliere({
        art: 'einsortiert',
        geraetId,
        sendungId: p.sendungId,
        teilNr: p.nr,
        anzahl: p.anzahl,
        alsWievielter: puffer.ankunft.length,
      });
      if (puffer.teile.every((t) => t !== null)) {
        puffer.text = puffer.teile.join('');
        this.#protokolliere({
          art: 'zusammengesetzt',
          geraetId,
          sendungId: p.sendungId,
          text: puffer.text,
          anzahl: p.anzahl,
          inReihenfolge: puffer.ankunft.every((nr, i) => nr === i + 1),
        });
      }
    }
    if (this.#optionen.bestaetigen) {
      this.#sende(
        empfaenger,
        p.quelleIp,
        { art: 'bestaetigung', sendungId: p.sendungId, nr: p.nr, anzahl: p.anzahl },
        p,
      );
    }
  }

  #bestaetigungEmpfangen(p: Extract<Paket, { art: 'bestaetigung' }>) {
    const s = this.#sendungen.get(p.sendungId);
    if (!s || s.bestaetigt.includes(p.nr)) return;
    s.bestaetigt.push(p.nr);
    this.#warteschlange.entfernen(
      (e) => e.typ === 'teil-zeitablauf' && e.sendungId === p.sendungId && e.nr === p.nr,
    );
  }

  #teilZeitAbgelaufen(sendungId: string, nr: number) {
    const s = this.#sendungen.get(sendungId);
    if (!s || s.aufgegeben || s.bestaetigt.includes(nr)) return;
    const versuch = (s.versuche.get(nr) ?? 0) + 1;
    if (versuch > MAX_WIEDERHOLUNGEN) {
      s.aufgegeben = true;
      this.#warteschlange.entfernen(
        (e) => (e.typ === 'teil-zeitablauf' || e.typ === 'teil-senden') && e.sendungId === sendungId,
      );
      const fehlende = s.teile.map((_, i) => i + 1).filter((n) => !s.bestaetigt.includes(n));
      this.#protokolliere({ art: 'aufgegeben', geraetId: s.absenderId, sendungId, fehlende });
      return;
    }
    s.versuche.set(nr, versuch);
    this.#protokolliere({ art: 'erneut-gesendet', geraetId: s.absenderId, sendungId, teilNr: nr, versuch });
    this.#teilSenden(sendungId, nr);
  }

  #dnsBeantworten(server: Geraet, anfrage: Extract<Paket, { art: 'dns-anfrage' }>) {
    const dienst = dienstVon(server, 'dns-server');
    if (!dienst) {
      this.#sende(server, anfrage.quelleIp, { art: 'abgelehnt', dienst: 'dns-server' }, anfrage);
      return;
    }
    const gesucht = normalisiereDomain(anfrage.domain);
    const eintrag = dienst.eintraege.find((e) => normalisiereDomain(e.domain) === gesucht);
    const ip = eintrag && ipZuZahl(eintrag.ip) !== null ? eintrag.ip.trim() : null;
    this.#sende(server, anfrage.quelleIp, { art: 'dns-antwort', domain: anfrage.domain, ip }, anfrage);
  }

  #httpBeantworten(server: Geraet, anfrage: Extract<Paket, { art: 'http-anfrage' }>) {
    const dienst = dienstVon(server, 'webserver');
    if (!dienst) {
      this.#sende(server, anfrage.quelleIp, { art: 'abgelehnt', dienst: 'webserver' }, anfrage);
      return;
    }
    const pfad = normalisierePfad(anfrage.pfad);
    const seite = dienst.seiten.find((s) => normalisierePfad(s.pfad) === pfad);
    this.#sende(
      server,
      anfrage.quelleIp,
      seite
        ? { art: 'http-antwort', pfad, status: 200, html: seite.html }
        : { art: 'http-antwort', pfad, status: 404, html: '' },
      anfrage,
    );
  }

  #antwortImBrowser(client: Geraet, antwort: Paket) {
    const zustand = this.#browser.get(client.id);
    // Antwort passt nicht (mehr) zu einer offenen Anfrage dieses Browsers → ignorieren.
    if (!zustand || !('anfrageId' in zustand) || zustand.anfrageId !== antwort.bezug) return;
    this.#zeitlimitEntfernen(client.id);
    const { eingabe, adresse } = zustand;

    if (antwort.art === 'abgelehnt') {
      this.#browserFehler(
        client,
        eingabe,
        { grund: 'dienst-fehlt', dienst: antwort.dienst, ip: antwort.quelleIp },
        adresse,
      );
      return;
    }
    if (antwort.art === 'dns-antwort' && zustand.phase === 'dns') {
      if (!antwort.ip) {
        this.#browserFehler(client, eingabe, { grund: 'domain-unbekannt', domain: antwort.domain }, adresse);
        return;
      }
      this.#seiteAnfordern(client, eingabe, adresse, antwort.ip);
      return;
    }
    if (antwort.art === 'http-antwort' && zustand.phase === 'laden') {
      this.#setzeBrowser(client.id, {
        phase: 'fertig',
        eingabe,
        adresse,
        ip: zustand.ip,
        status: antwort.status,
        html: antwort.html,
      });
      this.#protokolliere({ art: 'seite-angezeigt', geraetId: client.id, adresse, status: antwort.status });
    }
  }

  #seiteAnfordern(client: Geraet, eingabe: string, adresse: Adresse, ip: string): BrowserZustand {
    const anfrage = this.#neuesPaket(client, ip, {
      art: 'http-anfrage',
      host: adresse.host,
      pfad: adresse.pfad,
    });
    const fehler = this.#sendePaket(client, anfrage);
    if (fehler) return this.#browserFehler(client, eingabe, { grund: 'senden', fehler, ip }, adresse);
    return this.#setzeBrowser(client.id, { phase: 'laden', eingabe, adresse, anfrageId: anfrage.id, ip });
  }

  // --- Browser-Zustand ----------------------------------------------------------------------------

  #setzeBrowser(geraetId: string, zustand: BrowserZustand): BrowserZustand {
    this.#browser.set(geraetId, zustand);
    if ('anfrageId' in zustand) {
      this.#warteschlange.planen(zeitlimit(this.#netz), {
        typ: 'zeitablauf',
        geraetId,
        anfrageId: zustand.anfrageId,
      });
    }
    return zustand;
  }

  #browserFehler(g: Geraet, eingabe: string, fehler: BrowserFehler, adresse?: Adresse): BrowserZustand {
    this.#zeitlimitEntfernen(g.id);
    this.#protokolliere({ art: 'browser-fehler', geraetId: g.id, fehler });
    return this.#setzeBrowser(g.id, {
      phase: 'fehler',
      eingabe: eingabe.trim(),
      fehler,
      ...(adresse ? { adresse } : {}),
    });
  }

  #zeitlimitEntfernen(geraetId: string) {
    this.#warteschlange.entfernen((e) => e.typ === 'zeitablauf' && e.geraetId === geraetId);
  }

  #zeitAbgelaufen(geraetId: string, anfrageId: string) {
    const zustand = this.#browser.get(geraetId);
    if (!zustand || !('anfrageId' in zustand) || zustand.anfrageId !== anfrageId) return;
    const von = zustand.phase === 'dns' ? 'dns-server' : 'webserver';
    const ip = zustand.phase === 'dns' ? zustand.dnsIp : zustand.ip;
    this.#browserFehler(
      this.#geraet(geraetId),
      zustand.eingabe,
      { grund: 'keine-antwort', von, ip },
      zustand.adresse,
    );
  }

  // --- Hilfen -------------------------------------------------------------------------------------

  /** Nächstgelegenes Gerät im Segment, dem diese IP-Adresse gehört (Breitensuche, deterministisch). */
  #naechstesGeraetMitIp(vonId: string, ipText: string): Geraet | undefined {
    const ip = ipZuZahl(ipText);
    if (ip === null) return undefined;
    let bestes: { g: Geraet; laenge: number } | undefined;
    for (const id of segment(this.#aktiv, vonId)) {
      const g = findeGeraet(this.#netz, id);
      if (!g || !besitztIp(this.#netz, g, ip)) continue;
      const laenge = weg(this.#aktiv, vonId, id)?.length;
      if (laenge !== undefined && (!bestes || laenge < bestes.laenge)) bestes = { g, laenge };
    }
    return bestes?.g;
  }

  #hinweisBeiDoppelterZielIp(von: Geraet, paket: Paket) {
    const ziel = ipZuZahl(paket.zielIp);
    if (ziel === null) return;
    const gleiche = [...segment(this.#aktiv, von.id)].filter((id) => {
      const g = findeGeraet(this.#netz, id);
      return id !== von.id && g && besitztIp(this.#netz, g, ziel);
    });
    if (gleiche.length > 1) {
      this.#protokolliere({ art: 'ip-doppelt', geraetId: von.id, paket, geraeteIds: gleiche });
    }
  }

  #geraet(id: string): Geraet {
    const g = findeGeraet(this.#netz, id);
    if (!g) throw new Error(`Unbekanntes Gerät ${id}`);
    return g;
  }

  #protokolliere(eintrag: OhneKopf<ProtokollEintrag>) {
    this.#protokoll.push({ ...eintrag, nr: this.#protokoll.length + 1, zeit: this.zeit } as ProtokollEintrag);
  }
}
