import { adresseVon, besitztIp, schnittstellenVon } from '../model/adressen';
import type { Geraet, NetzDatei } from '../model/datei';
import { dienstVon, hatDienst } from '../model/dienste';
import { normalisiereDomain, normalisierePfad, zerlegeAdresse, type Adresse } from '../model/domain';
import { gleichesNetz, ipZuZahl, netzBeschreibung, zahlZuIp } from '../model/ip';
import { findeGeraet, leitungAendern, leitungenVon } from '../model/netz';
import { aktivesNetz, routeFuer, routenVon, type Route } from '../model/routing';
import { istVerteilerImSegment, segment, weg } from '../model/topologie';
import { Ereigniswarteschlange } from './ereignisse';

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
  | { art: 'abgelehnt'; dienst: 'webserver' | 'dns-server' };

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

const anfragen: PaketArt[] = ['nachricht', 'dns-anfrage', 'http-anfrage'];
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
  | { grund: 'keine-route' };

export type VerwerfGrund = 'kein-ziel' | 'falsche-ip' | 'keine-route' | 'ttl' | 'leitung-ausgefallen';

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
  | { art: 'gesendet'; nachId: string; paket: Paket }
  | { art: 'weitergeleitet'; nachId: string; paket: Paket; route?: GenutzteRoute }
  | { art: 'empfangen'; paket: Paket }
  | { art: 'verworfen'; paket: Paket; grund: VerwerfGrund }
  | { art: 'nicht-gesendet'; zielIp: string; fehler: SendeFehler }
  | { art: 'ip-doppelt'; paket: Paket; geraeteIds: string[] }
  | { art: 'falscher-empfaenger'; paket: Paket; erwartetId: string }
  | { art: 'aufruf'; eingabe: string }
  | { art: 'browser-fehler'; fehler: BrowserFehler }
  | { art: 'seite-angezeigt'; adresse: Adresse; status: 200 | 404 }
);

/** Logische Verbindung zwischen Client und Dienst (Dienste-Ansicht, TK 1). */
export interface LogischeVerbindung {
  clientId: string;
  serverId: string;
  protokoll: 'DNS' | 'HTTP' | 'Nachricht';
}

type Ereignis =
  | { typ: 'ankunft'; paket: Paket; geraetId: string; leitungId: string; hopIp: string }
  | { typ: 'zeitablauf'; geraetId: string; anfrageId: string };

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

  constructor(netz: NetzDatei) {
    this.#netz = netz;
    this.#aktiv = aktivesNetz(netz);
  }

  get netz(): NetzDatei {
    return this.#netz;
  }

  /** Störung während des Laufs: Leitung fällt aus oder funktioniert wieder. */
  leitungAusfallen(leitungId: string, ausgefallen: boolean): void {
    this.#netz = leitungAendern(this.#netz, leitungId, { ausgefallen });
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
    const zeit = this.#warteschlange.naechsteZeit;
    if (zeit === undefined) return;
    // Erst alle ankommenden Pakete, dann abgelaufene Zeitlimits: Kommt die Antwort genau im letzten
    // erlaubten Schritt an, zählt sie noch.
    const jetzt: Ereignis[] = [];
    while (this.#warteschlange.naechsteZeit === zeit) jetzt.push(this.#warteschlange.naechstes()!.daten);
    for (const daten of jetzt) {
      if (daten.typ !== 'ankunft') continue;
      this.#unterwegs = this.#unterwegs.filter((u) => u.paket !== daten.paket);
      this.#verarbeite(daten.paket, daten.geraetId, daten.leitungId, daten.hopIp);
    }
    for (const daten of jetzt) {
      if (daten.typ === 'zeitablauf') this.#zeitAbgelaufen(daten.geraetId, daten.anfrageId);
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
    if (!eigene) return { grund: 'keine-ip' };
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
    const route = routeFuer(routenVon(this.#netz, router.id), ziel);
    if (!route) {
      this.#protokolliere({ art: 'verworfen', geraetId: router.id, paket, grund: 'keine-route' });
      return;
    }
    this.#aufLeitung(
      router.id,
      route.leitungId,
      paket,
      'weitergeleitet',
      zahlZuIp(route.gateway ?? ziel),
      route,
    );
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
    this.#unterwegs.push({ paket, leitungId, vonId, nachId, hopIp, start: zeit, ende: zeit + 1 });
    this.#warteschlange.planen(1, { typ: 'ankunft', paket, geraetId: nachId, leitungId, hopIp });
    const genutzt = route && {
      ziel: zahlZuIp(route.ziel),
      subnetzmaske: zahlZuIp(route.maske),
      gateway: route.gateway === null ? null : zahlZuIp(route.gateway),
    };
    this.#protokolliere({ art, geraetId: vonId, nachId, paket, ...(genutzt ? { route: genutzt } : {}) });
  }

  // --- Empfangen ----------------------------------------------------------------------------------

  #verarbeite(paket: Paket, geraetId: string, leitungId: string, hopIp: string) {
    const g = this.#geraet(geraetId);

    // Leitung ist ausgefallen, während das Paket unterwegs war → es kommt nie an.
    if (this.#netz.leitungen.find((l) => l.id === leitungId)?.ausgefallen) {
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'leitung-ausgefallen' });
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

    const hop = ipZuZahl(hopIp);
    if (hop === null || !besitztIp(this.#netz, g, hop)) {
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'falsche-ip' });
      return;
    }

    const ziel = ipZuZahl(paket.zielIp)!;
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
      case 'antwort':
        return;
    }
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
