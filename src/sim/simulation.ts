import { adresseVon, hatIpAdresse } from '../model/adressen';
import type { Geraet, NetzDatei } from '../model/datei';
import { gleichesNetz, ipZuZahl, netzBeschreibung } from '../model/ip';
import { findeGeraet, leitungenVon } from '../model/netz';
import { istVerteilerImSegment, segment, weg } from '../model/topologie';
import { Ereigniswarteschlange } from './ereignisse';

/**
 * Simulation des Nachrichtenaustauschs in einem lokalen Rechnernetz (Phase 2).
 *
 * Zeitmodell: Ein Schritt = jede Nachricht, die gerade auf einer Leitung ist, kommt beim nächsten
 * Gerät an und wird dort verarbeitet. Alles Weitere (Animation, Geschwindigkeit) macht die Oberfläche.
 * Die Simulation arbeitet auf einer festen Kopie des Netzes; Änderungen am Netz erfordern eine neue Simulation.
 */

export interface Paket {
  id: string;
  art: 'nachricht' | 'antwort';
  quelleIp: string;
  zielIp: string;
  inhalt: string;
  /** Gerät, das die ursprüngliche Nachricht geschickt hat (bei Antworten: wer die Antwort erwartet). */
  erwartetVon?: string;
}

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

export type ProtokollEintrag = { nr: number; zeit: number; geraetId: string } & (
  | { art: 'gesendet'; nachId: string; paket: Paket }
  | { art: 'weitergeleitet'; nachId: string; paket: Paket }
  | { art: 'empfangen'; paket: Paket }
  | { art: 'verworfen'; paket: Paket; grund: VerwerfGrund }
  | { art: 'nicht-gesendet'; zielIp: string; fehler: SendeFehler }
  | { art: 'ip-doppelt'; paket: Paket; geraeteIds: string[] }
  | { art: 'falscher-empfaenger'; paket: Paket; erwartetId: string }
);

type Ankunft = { paket: Paket; geraetId: string; leitungId: string };

export class Simulation {
  readonly netz: NetzDatei;
  #warteschlange = new Ereigniswarteschlange<Ankunft>();
  #unterwegs: Unterwegs[] = [];
  #protokoll: ProtokollEintrag[] = [];
  #paketNr = 0;

  constructor(netz: NetzDatei) {
    this.netz = netz;
  }

  get zeit(): number {
    return this.#warteschlange.zeit;
  }

  /** Ist noch etwas unterwegs? */
  get aktiv(): boolean {
    return !this.#warteschlange.leer;
  }

  get unterwegs(): readonly Unterwegs[] {
    return this.#unterwegs;
  }

  get protokoll(): readonly ProtokollEintrag[] {
    return this.#protokoll;
  }

  /** Startet eine Nachricht von einem Endgerät an eine IP-Adresse. */
  senden(vonId: string, zielIpText: string, inhalt: string): { ok: true } | ({ ok: false } & SendeFehler) {
    const von = this.#geraet(vonId);
    const fehler = this.#pruefeSenden(von, zielIpText);
    if (fehler) {
      this.#protokolliere({ art: 'nicht-gesendet', geraetId: vonId, zielIp: zielIpText.trim(), fehler });
      return { ok: false, ...fehler };
    }
    const paket: Paket = {
      id: `p${++this.#paketNr}`,
      art: 'nachricht',
      quelleIp: von.ip!.trim(),
      zielIp: zielIpText.trim(),
      inhalt,
    };
    this.#hinweisBeiDoppelterZielIp(von, paket);
    this.#abschicken(von, paket, 'gesendet');
    return { ok: true };
  }

  /** Führt einen Schritt aus: alle Nachrichten auf den Leitungen kommen an und werden verarbeitet. */
  schritt(): void {
    const zeit = this.#warteschlange.naechsteZeit;
    if (zeit === undefined) return;
    while (this.#warteschlange.naechsteZeit === zeit) {
      const ereignis = this.#warteschlange.naechstes()!;
      this.#unterwegs = this.#unterwegs.filter((u) => u.paket !== ereignis.daten.paket);
      this.#verarbeite(ereignis.daten);
    }
  }

  // ---------------------------------------------------------------------------------------------

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

  /** Schickt ein Paket von einem Endgerät über dessen (einzigen) Anschluss los. */
  #abschicken(von: Geraet, paket: Paket, art: 'gesendet' | 'weitergeleitet') {
    const leitung = leitungenVon(this.netz, von.id)[0];
    if (!leitung) return;
    this.#aufLeitung(von.id, leitung.id, paket, art);
  }

  #aufLeitung(vonId: string, leitungId: string, paket: Paket, art: 'gesendet' | 'weitergeleitet') {
    const leitung = this.netz.leitungen.find((l) => l.id === leitungId)!;
    const nachId = leitung.von === vonId ? leitung.nach : leitung.von;
    const zeit = this.zeit;
    this.#unterwegs.push({ paket, leitungId, vonId, nachId, start: zeit, ende: zeit + 1 });
    this.#warteschlange.planen(1, { paket, geraetId: nachId, leitungId });
    this.#protokolliere({ art, geraetId: vonId, nachId, paket });
  }

  #verarbeite({ paket, geraetId }: Ankunft) {
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

    if (paket.art === 'nachricht') {
      const absender = this.#absenderVon(paket);
      const antwort: Paket = {
        id: `p${++this.#paketNr}`,
        art: 'antwort',
        quelleIp: paket.zielIp,
        zielIp: paket.quelleIp,
        inhalt: paket.inhalt,
        erwartetVon: absender,
      };
      this.#abschicken(g, antwort, 'gesendet');
    }
  }

  /** Wer hat die Nachricht ursprünglich losgeschickt? (für den Hinweis „Antwort beim falschen Gerät“) */
  #absenderVon(paket: Paket): string | undefined {
    return this.#protokoll.find((e) => e.art === 'gesendet' && e.paket === paket)?.geraetId;
  }

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

  #protokolliere(eintrag: DistributiveOmit<ProtokollEintrag, 'nr' | 'zeit'>) {
    this.#protokoll.push({ ...eintrag, nr: this.#protokoll.length + 1, zeit: this.zeit } as ProtokollEintrag);
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
