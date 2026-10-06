import { adresseVon, hatIpAdresse } from '../model/adressen';
import type { Geraet, NetzDatei } from '../model/datei';
import { dienstVon, hatDienst } from '../model/dienste';
import { normalisiereDomain, normalisierePfad, zerlegeAdresse, type Adresse } from '../model/domain';
import { gleichesNetz, ipZuZahl, netzBeschreibung } from '../model/ip';
import { findeGeraet, leitungenVon } from '../model/netz';
import { istVerteilerImSegment, segment, weg } from '../model/topologie';
import { Ereigniswarteschlange } from './ereignisse';

/**
 * Simulation des Nachrichtenaustauschs (Phase 2: lokales Rechnernetz, Phase 3: DNS und HTTP).
 *
 * Zeitmodell: Ein Schritt = jedes Paket, das gerade auf einer Leitung ist, kommt beim nächsten Gerät an
 * und wird dort verarbeitet. Animation und Geschwindigkeit sind Sache der Oberfläche.
 * Die Simulation arbeitet auf einer festen Kopie des Netzes; Änderungen erfordern eine neue Simulation.
 */

/** Nach so vielen Schritten ohne Antwort gibt der Browser auf. */
export const ZEITLIMIT = 8;

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
  start: number;
  ende: number;
}

export type SendeFehler =
  | { grund: 'keine-ip' }
  | { grund: 'ziel-ungueltig' }
  | { grund: 'eigene-ip' }
  | { grund: 'nicht-verbunden' }
  | { grund: 'anderes-netz'; eigenesNetz: string };

export type VerwerfGrund = 'kein-ziel' | 'falsche-ip' | 'router';

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
  | { art: 'weitergeleitet'; nachId: string; paket: Paket }
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
  | { typ: 'ankunft'; paket: Paket; geraetId: string; leitungId: string }
  | { typ: 'zeitablauf'; geraetId: string; anfrageId: string };

type OhneKopf<T> = T extends unknown ? Omit<T, 'nr' | 'zeit'> : never;

export class Simulation {
  readonly netz: NetzDatei;
  #warteschlange = new Ereigniswarteschlange<Ereignis>();
  #unterwegs: Unterwegs[] = [];
  #protokoll: ProtokollEintrag[] = [];
  #browser = new Map<string, BrowserZustand>();
  #paketNr = 0;

  constructor(netz: NetzDatei) {
    this.netz = netz;
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
    while (this.#warteschlange.naechsteZeit === zeit) {
      const { daten } = this.#warteschlange.naechstes()!;
      if (daten.typ === 'ankunft') {
        this.#unterwegs = this.#unterwegs.filter((u) => u.paket !== daten.paket);
        this.#verarbeite(daten.paket, daten.geraetId);
      } else {
        this.#zeitAbgelaufen(daten.geraetId, daten.anfrageId);
      }
    }
  }

  // --- Senden -------------------------------------------------------------------------------------

  #neuesPaket(von: Geraet, zielIp: string, daten: PaketDaten, bezug?: Paket): Paket {
    return {
      ...daten,
      id: `p${++this.#paketNr}`,
      quelleIp: von.ip?.trim() ?? '',
      zielIp: zielIp.trim(),
      absenderId: von.id,
      ...(bezug ? { bezug: bezug.id, erwartetVon: bezug.absenderId } : {}),
    };
  }

  /** Prüft, baut und verschickt ein Paket; Fehler werden protokolliert und zurückgegeben. */
  #sende(von: Geraet, zielIp: string, daten: PaketDaten, bezug?: Paket): SendeFehler | null {
    return this.#sendePaket(von, this.#neuesPaket(von, zielIp, daten, bezug));
  }

  #sendePaket(von: Geraet, paket: Paket): SendeFehler | null {
    const fehler = this.#pruefeSenden(von, paket.zielIp);
    if (fehler) {
      this.#protokolliere({ art: 'nicht-gesendet', geraetId: von.id, zielIp: paket.zielIp, fehler });
      return fehler;
    }
    if (istAnfrage(paket)) this.#hinweisBeiDoppelterZielIp(von, paket);
    const leitung = leitungenVon(this.netz, von.id)[0]!;
    this.#aufLeitung(von.id, leitung.id, paket, 'gesendet');
    return null;
  }

  #pruefeSenden(von: Geraet, zielIpText: string): SendeFehler | null {
    const eigene = adresseVon(von);
    if (!eigene) return { grund: 'keine-ip' };
    const ziel = ipZuZahl(zielIpText);
    if (ziel === null) return { grund: 'ziel-ungueltig' };
    if (ziel === eigene.ip) return { grund: 'eigene-ip' };
    if (leitungenVon(this.netz, von.id).length === 0) return { grund: 'nicht-verbunden' };
    if (!gleichesNetz(ziel, eigene.ip, eigene.maske)) {
      return { grund: 'anderes-netz', eigenesNetz: netzBeschreibung(eigene.ip, eigene.maske) };
    }
    return null;
  }

  #aufLeitung(vonId: string, leitungId: string, paket: Paket, art: 'gesendet' | 'weitergeleitet') {
    const leitung = this.netz.leitungen.find((l) => l.id === leitungId)!;
    const nachId = leitung.von === vonId ? leitung.nach : leitung.von;
    const zeit = this.zeit;
    this.#unterwegs.push({ paket, leitungId, vonId, nachId, start: zeit, ende: zeit + 1 });
    this.#warteschlange.planen(1, { typ: 'ankunft', paket, geraetId: nachId, leitungId });
    this.#protokolliere({ art, geraetId: vonId, nachId, paket });
  }

  // --- Empfangen ----------------------------------------------------------------------------------

  #verarbeite(paket: Paket, geraetId: string) {
    const g = this.#geraet(geraetId);

    if (istVerteilerImSegment(g)) {
      // Switch/Access Point: zum nächstgelegenen Gerät mit der Ziel-IP weiterleiten.
      const ziel = this.#naechstesGeraetMitIp(g.id, paket.zielIp);
      const pfad = ziel && weg(this.netz, g.id, ziel.id);
      if (!pfad?.[0]) {
        this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'kein-ziel' });
        return;
      }
      this.#aufLeitung(g.id, pfad[0].id, paket, 'weitergeleitet');
      return;
    }

    if (g.typ === 'router') {
      // Weiterleiten zwischen Netzen (Routing) folgt in Phase 4.
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'router' });
      return;
    }

    const eigene = adresseVon(g);
    if (!eigene || eigene.ip !== ipZuZahl(paket.zielIp)) {
      this.#protokolliere({ art: 'verworfen', geraetId, paket, grund: 'falsche-ip' });
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
      this.#warteschlange.planen(ZEITLIMIT, { typ: 'zeitablauf', geraetId, anfrageId: zustand.anfrageId });
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

  /** Nächstgelegenes Endgerät im Segment, dessen IP-Adresse passt (Breitensuche, deterministisch). */
  #naechstesGeraetMitIp(vonId: string, zielIpText: string): Geraet | undefined {
    const ziel = ipZuZahl(zielIpText);
    let bestes: { g: Geraet; laenge: number } | undefined;
    for (const id of segment(this.netz, vonId)) {
      const g = findeGeraet(this.netz, id);
      if (!g || !hatIpAdresse(g) || adresseVon(g)?.ip !== ziel) continue;
      const laenge = weg(this.netz, vonId, id)?.length;
      if (laenge !== undefined && (!bestes || laenge < bestes.laenge)) bestes = { g, laenge };
    }
    return bestes?.g;
  }

  #hinweisBeiDoppelterZielIp(von: Geraet, paket: Paket) {
    const ziel = ipZuZahl(paket.zielIp);
    const gleiche = [...segment(this.netz, von.id)].filter((id) => {
      const g = findeGeraet(this.netz, id);
      return id !== von.id && g && adresseVon(g)?.ip === ziel;
    });
    if (gleiche.length > 1) {
      this.#protokolliere({ art: 'ip-doppelt', geraetId: von.id, paket, geraeteIds: gleiche });
    }
  }

  #geraet(id: string): Geraet {
    const g = findeGeraet(this.netz, id);
    if (!g) throw new Error(`Unbekanntes Gerät ${id}`);
    return g;
  }

  #protokolliere(eintrag: OhneKopf<ProtokollEintrag>) {
    this.#protokoll.push({ ...eintrag, nr: this.#protokoll.length + 1, zeit: this.zeit } as ProtokollEintrag);
  }
}
