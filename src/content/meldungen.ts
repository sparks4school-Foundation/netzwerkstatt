import type { AdressProblem } from '../model/adressen';
import type { Pruefung } from '../model/datei';
import type { DnsEintragProblem } from '../model/dienste';
import type { PruefErgebnis } from '../sim/pruefung';
import { maskeZuZahl, netzBeschreibung } from '../model/ip';
import type { RoutingEintragProblem } from '../model/routing';
import type { VerbindungsProblem } from '../model/netz';
import type { BrowserFehler, Paket, ProtokollEintrag, SendeFehler, VerwerfGrund } from '../sim/simulation';

/** Verständliche Fehlermeldungen: Was ist passiert? Woran liegt es? Was kann ich tun? (AGENTS.md 6.1) */
export function verbindungsMeldung(p: VerbindungsProblem): string {
  switch (p.grund) {
    case 'selbst':
      return 'Ein Gerät kann nicht mit sich selbst verbunden werden.';
    case 'schon-verbunden':
      return 'Diese beiden Geräte sind schon miteinander verbunden.';
    case 'kein-kabelanschluss':
      return `${p.geraet.name} hat keinen Kabelanschluss. Verbinde es per WLAN mit einem Access Point.`;
    case 'anschluss-belegt':
      return `${p.geraet.name} hat keinen freien Anschluss mehr. Tipp: Mehrere Geräte schließt du über einen Switch an.`;
    case 'wlan-nur-mit-access-point':
      return 'WLAN funktioniert nur zwischen einem Access Point und einem Computer, Smartphone oder einer Spielkonsole.';
    case 'kein-wlan':
      return `${p.geraet.name} hat kein WLAN. Verbinde es per Kabel.`;
  }
}

export const dateiMeldungen = {
  gespeichert: 'Das Netz wurde als Datei gespeichert.',
  geoeffnet: (name: string) => `„${name}“ wurde geöffnet.`,
  neuBestaetigen: 'Ein neues, leeres Netz anlegen? Nicht gespeicherte Änderungen gehen verloren.',
} as const;

/** Kurzform für das Abzeichen am Gerät (mit Symbol davor) – höchstens zwei Wörter. */
export function adressProblemKurz(p: AdressProblem): string {
  switch (p.art) {
    case 'ip-ungueltig':
      return 'IP ungültig';
    case 'maske-ungueltig':
      return 'Maske ungültig';
    case 'gateway-ungueltig':
      return 'Gateway ungültig';
    case 'dns-ungueltig':
      return 'DNS ungültig';
    case 'gateway-anderes-netz':
      return 'Gateway falsch';
    case 'ip-doppelt':
      return 'IP doppelt';
    case 'ip-reserviert':
      return 'IP reserviert';
    case 'anderes-netz':
      return 'anderes Netz';
  }
}

/** Ausführliche Erklärung im Eigenschaften-Panel. */
export function adressProblemText(p: AdressProblem): string {
  switch (p.art) {
    case 'ip-ungueltig':
      return 'Das ist keine gültige IP-Adresse. Eine IP-Adresse besteht aus vier Zahlen von 0 bis 255, getrennt durch Punkte, z. B. 192.168.0.10.';
    case 'maske-ungueltig':
      return 'Das ist keine gültige Subnetzmaske. Üblich ist 255.255.255.0.';
    case 'gateway-ungueltig':
      return 'Das Gateway ist keine gültige IP-Adresse.';
    case 'dns-ungueltig':
      return 'Beim DNS-Server muss eine gültige IP-Adresse stehen, z. B. 192.168.0.3.';
    case 'gateway-anderes-netz':
      return 'Das Gateway liegt nicht im eigenen Netz. Das Gateway ist der Router-Anschluss im selben lokalen Rechnernetz, z. B. 192.168.0.1.';
    case 'ip-doppelt':
      return `Diese IP-Adresse hat auch ${p.mit.map((g) => g.name).join(', ')}. Jede IP-Adresse darf in einem lokalen Rechnernetz nur einmal vorkommen – sonst kommen Nachrichten beim falschen Gerät an.`;
    case 'ip-reserviert':
      return p.welche === 'netzadresse'
        ? 'Adressen, die auf .0 enden, bezeichnen das ganze Netz und dürfen keinem Gerät gegeben werden.'
        : 'Adressen, die auf .255 enden, sind für Nachrichten an alle reserviert und dürfen keinem Gerät gegeben werden.';
    case 'anderes-netz':
      return `Diese IP-Adresse passt nicht zu den anderen Geräten im lokalen Rechnernetz (${netzBeschreibung(p.erwartet.ip, p.erwartet.maske)}). Bei 255.255.255.0 müssen die ersten drei Zahlen gleich sein.`;
  }
}

export function sendeFehlerText(f: SendeFehler, geraet: string, zielIp: string): string {
  switch (f.grund) {
    case 'keine-ip':
      return `${geraet} hat noch keine gültige IP-Adresse. Trage im Modus „Aufbauen“ eine ein.`;
    case 'ziel-ungueltig':
      return `„${zielIp}“ ist keine gültige IP-Adresse. Beispiel: 192.168.0.11`;
    case 'eigene-ip':
      return `${zielIp} ist die eigene IP-Adresse von ${geraet}. Wähle die Adresse eines anderen Geräts.`;
    case 'nicht-verbunden':
      return `${geraet} ist mit keinem anderen Gerät verbunden.`;
    case 'leitung-ausgefallen':
      return `Die Leitung von ${geraet} ist ausgefallen.`;
    case 'anderes-netz':
      return `${zielIp} liegt nicht im Netz von ${geraet} (${f.eigenesNetz}). Nachrichten in andere Netze gehen über einen Router: Trage bei ${geraet} ein Gateway ein (in Klasse 11).`;
    case 'gateway-falsch':
      return `Das Gateway ${f.gateway} liegt nicht im Netz von ${geraet} (${f.eigenesNetz}). Das Gateway muss der Router-Anschluss im eigenen Netz sein.`;
    case 'keine-route':
      return `${geraet} kennt keinen Weg zu ${zielIp} – in der Routingtabelle fehlt ein passender Eintrag.`;
    case 'dhcp-fehlt':
      return `${geraet} bezieht seine IP-Adresse per DHCP und hat noch keine. Tippe zuerst auf „IP-Adresse per DHCP holen“.`;
  }
}

const verwerfGrund: Record<VerwerfGrund, string> = {
  'kein-ziel': 'kein Gerät mit dieser IP-Adresse im lokalen Rechnernetz – die Nachricht geht verloren',
  'falsche-ip': 'die Nachricht ist nicht für diese IP-Adresse – sie wird verworfen',
  'keine-route': 'kein passender Eintrag in der Routingtabelle – das Paket wird verworfen',
  ttl: 'Lebensdauer (TTL) abgelaufen – das Paket ist zu oft weitergeleitet worden (Routing-Schleife?) und wird verworfen',
  'leitung-ausgefallen': 'die Leitung ist ausgefallen – das Paket geht verloren',
  stoerung: 'ist auf der gestörten Leitung verloren gegangen',
  'rundsendung-ignoriert':
    'ist eine Rundsendung an alle – dieses Gerät ist nicht zuständig und ignoriert sie',
};

/** Kurzname eines Pakets für die Animation auf der Leitung. */
export function paketKurzname(p: Paket): string {
  switch (p.art) {
    case 'nachricht':
      return 'Nachricht';
    case 'antwort':
      return 'Antwort';
    case 'dns-anfrage':
      return 'DNS-Anfrage';
    case 'dns-antwort':
      return 'DNS-Antwort';
    case 'http-anfrage':
      return 'HTTP-Anfrage';
    case 'http-antwort':
      return 'HTTP-Antwort';
    case 'abgelehnt':
      return 'Abgelehnt';
    case 'teil':
      return `Teil ${p.nr}/${p.anzahl}`;
    case 'bestaetigung':
      return `Bestätigung ${p.nr}`;
    case 'dhcp-discover':
      return 'DHCP-Discover';
    case 'dhcp-offer':
      return 'DHCP-Offer';
    case 'dhcp-request':
      return 'DHCP-Request';
    case 'dhcp-ack':
      return 'DHCP-Ack';
  }
}

/** Was steht im Paket? Ein Satz für das Kommunikationsprotokoll. */
export function paketInhalt(p: Paket): string {
  switch (p.art) {
    case 'nachricht':
      return `Nachricht „${p.inhalt}“`;
    case 'antwort':
      return 'Antwort';
    case 'dns-anfrage':
      return `DNS-Anfrage „Welche IP-Adresse hat ${p.domain}?“`;
    case 'dns-antwort':
      return p.ip
        ? `DNS-Antwort „${p.domain} hat die IP-Adresse ${p.ip}“`
        : `DNS-Antwort „${p.domain} kenne ich nicht“`;
    case 'http-anfrage':
      return `HTTP-Anfrage „Bitte schick mir die Seite ${p.pfad} von ${p.host}“`;
    case 'http-antwort':
      return p.status === 200
        ? `HTTP-Antwort mit der Seite ${p.pfad}`
        : `HTTP-Antwort „Seite ${p.pfad} gibt es nicht (404)“`;
    case 'abgelehnt':
      return `Ablehnung „Hier läuft kein ${p.dienst === 'webserver' ? 'Webserver' : 'DNS-Server'}“`;
    case 'teil':
      return `Teil ${p.nr}/${p.anzahl} „${p.inhalt}“`;
    case 'bestaetigung':
      return `Bestätigung „Teil ${p.nr} ist angekommen“`;
    case 'dhcp-discover':
      return 'DHCP-Discover „Gibt es hier einen DHCP-Server? Ich brauche eine IP-Adresse.“';
    case 'dhcp-offer':
      return `DHCP-Offer „Du kannst ${p.ip} haben.“`;
    case 'dhcp-request':
      return `DHCP-Request „Ich nehme ${p.ip} vom Server ${p.serverIp}.“`;
    case 'dhcp-ack':
      return `DHCP-Ack „${p.ip} gehört jetzt dir${p.gateway ? ` – Gateway ${p.gateway}` : ''}${p.dnsServer ? `, DNS-Server ${p.dnsServer}` : ''}.“`;
  }
}

export function browserFehlerText(f: BrowserFehler, geraet: string): { titel: string; text: string } {
  switch (f.grund) {
    case 'kein-browser':
      return { titel: 'Kein Browser installiert', text: `Auf ${geraet} ist kein Browser installiert.` };
    case 'adresse-ungueltig':
      return {
        titel: 'Ungültige Adresse',
        text: 'Gib eine Domain wie www.schule.test oder eine IP-Adresse wie 192.168.0.2 ein.',
      };
    case 'kein-dns-server':
      return {
        titel: 'Kein DNS-Server eingetragen',
        text: `${geraet} weiß nicht, welchen DNS-Server es nach der IP-Adresse fragen soll. Trage im Modus „Aufbauen“ bei ${geraet} die IP-Adresse des DNS-Servers ein – oder gib direkt eine IP-Adresse ein.`,
      };
    case 'domain-unbekannt':
      return {
        titel: 'Domain nicht gefunden',
        text: `Der DNS-Server kennt ${f.domain} nicht. Tipp: Schau in die Tabelle des DNS-Servers – fehlt der Eintrag oder ist er falsch geschrieben?`,
      };
    case 'keine-antwort':
      return {
        titel: 'Keine Antwort',
        text: `Vom ${f.von === 'dns-server' ? 'DNS-Server' : 'Webserver'} (${f.ip}) kam keine Antwort. Ist die IP-Adresse richtig und das Gerät angeschlossen? Schau ins Protokoll, wo die Nachricht verloren ging.`,
      };
    case 'dienst-fehlt':
      return f.dienst === 'webserver'
        ? {
            titel: 'Kein Webserver',
            text: `Das Gerät mit der IP-Adresse ${f.ip} ist erreichbar, aber dort läuft kein Webserver. Installiere dort den Dienst „Webserver“.`,
          }
        : {
            titel: 'Kein DNS-Server-Dienst',
            text: `Das Gerät mit der IP-Adresse ${f.ip} ist erreichbar, aber dort läuft kein DNS-Server. Installiere dort den Dienst „DNS-Server“ oder trage einen anderen DNS-Server ein.`,
          };
    case 'senden':
      return { titel: 'Konnte nicht senden', text: sendeFehlerText(f.fehler, geraet, f.ip) };
  }
}

/** Ein Eintrag im Kommunikationsprotokoll als Satz. `name` übersetzt Geräte-IDs in Namen. */
export function protokollText(e: ProtokollEintrag, name: (id: string) => string): string {
  switch (e.art) {
    case 'gesendet':
      return `${paketInhalt(e.paket)} an ${e.paket.zielIp} losgeschickt`;
    case 'weitergeleitet':
      return e.route
        ? `${paketKurzname(e.paket)} für ${e.paket.zielIp} weitergeleitet an ${name(e.nachId)} – laut Routingtabelle: ${e.route.ziel}/${maskeKurz(e.route.subnetzmaske)} ${e.route.gateway ? `über ${e.route.gateway}` : 'direkt angeschlossen'}`
        : `${paketKurzname(e.paket)} für ${e.paket.zielIp} weitergeleitet an ${name(e.nachId)}`;
    case 'empfangen':
      return `${paketInhalt(e.paket)} von ${e.paket.quelleIp} empfangen`;
    case 'verworfen':
      return e.grund === 'stoerung' && e.vonId
        ? `${paketKurzname(e.paket)} von ${name(e.vonId)} ${verwerfGrund.stoerung}`
        : `${paketKurzname(e.paket)} für ${e.paket.zielIp}: ${verwerfGrund[e.grund]}`;
    case 'nicht-gesendet':
      return `Nicht gesendet: ${sendeFehlerText(e.fehler, name(e.geraetId), e.zielIp)}`;
    case 'ip-doppelt':
      return `Achtung: ${e.paket.zielIp} ist mehrfach vergeben (${e.geraeteIds.map(name).join(', ')}).`;
    case 'falscher-empfaenger':
      return `Achtung: Die Antwort war für ${name(e.erwartetId)} gedacht, ist aber hier angekommen – die IP-Adresse ist doppelt vergeben.`;
    case 'aufruf':
      return `Browser ruft „${e.eingabe}“ auf`;
    case 'browser-fehler':
      return `Browser zeigt Fehler: ${browserFehlerText(e.fehler, name(e.geraetId)).titel}`;
    case 'dhcp-start':
      return 'Fragt per DHCP nach einer IP-Adresse';
    case 'dhcp-erhalten':
      return `Hat per DHCP die IP-Adresse ${e.angebot.ip} vom Server ${e.serverIp} bekommen`;
    case 'dhcp-fehlgeschlagen':
      return 'Keine IP-Adresse erhalten – kein DHCP-Server hat geantwortet. Ist ein DHCP-Server im lokalen Rechnernetz installiert?';
    case 'dhcp-voll':
      return 'DHCP-Server hat keine freie Adresse mehr im eingestellten Bereich';
    case 'nat':
      return e.richtung === 'aus'
        ? `NAT: Absender ${e.innenIp} wird zu ${e.aussenIp} (Port ${e.port}) – private Adressen bleiben im Heimnetz`
        : `NAT: Antwort an ${e.aussenIp} (Port ${e.port}) wird zurückübersetzt an ${e.innenIp}`;
    case 'zerlegt':
      return `Nachricht für ${e.zielIp} in ${e.anzahl} Teile zerlegt`;
    case 'einsortiert':
      return `Teil ${e.teilNr}/${e.anzahl} als ${e.alsWievielter}. angekommen und an Platz ${e.teilNr} einsortiert`;
    case 'teil-doppelt':
      return `Teil ${e.teilNr} kam doppelt an – wird nur noch einmal bestätigt`;
    case 'zusammengesetzt':
      return `Alle ${e.anzahl} Teile da – Nachricht zusammengesetzt: „${e.text}“${e.inReihenfolge ? '' : ' (Teile kamen in anderer Reihenfolge an)'}`;
    case 'erneut-gesendet':
      return `Keine Bestätigung für Teil ${e.teilNr} – wird erneut gesendet (Versuch ${e.versuch})`;
    case 'aufgegeben':
      return `Aufgegeben: Teil ${e.fehlende.join(', ')} kam nach mehreren Versuchen nicht an`;
    case 'seite-angezeigt':
      return e.status === 200
        ? `Browser zeigt die Seite ${e.adresse.host}${e.adresse.pfad}`
        : `Browser zeigt „Seite nicht gefunden“ (${e.adresse.host}${e.adresse.pfad})`;
  }
}

export const dnsEintragTexte: Record<DnsEintragProblem, string> = {
  'domain-ungueltig': 'Domain ungültig (Beispiel: www.schule.test)',
  'ip-ungueltig': 'IP-Adresse ungültig',
  'domain-doppelt': 'Domain kommt doppelt vor',
};

/** Subnetzmaske in Kurzform, z. B. 255.255.255.0 → 24 (Anzahl der Einsen). */
export function maskeKurz(maske: string): string {
  const zahl = maskeZuZahl(maske);
  if (zahl === null) return maske;
  let n = 0;
  for (let b = zahl; b; b = (b << 1) >>> 0) n++;
  return String(n);
}

export const routingEintragTexte: Record<RoutingEintragProblem, string> = {
  'ziel-ungueltig': 'Zielnetz ist keine gültige Adresse',
  'maske-ungueltig': 'Subnetzmaske ungültig',
  'gateway-ungueltig': 'Gateway ist keine gültige IP-Adresse',
  'anschluss-fehlt': 'Anschluss gibt es nicht (mehr)',
};

/** Was eine automatische Prüfung testet – als Satz für Schüler:innen. */
export function pruefungText(p: Pruefung, name: (id: string) => string): string {
  switch (p.art) {
    case 'webseite':
      return `Der Browser auf ${name(p.geraetId)} zeigt ${p.adresse} an.`;
    case 'nachricht':
      return `Eine Nachricht von ${name(p.geraetId)} an ${p.zielIp} kommt an und wird beantwortet.`;
    case 'adressen-ok':
      return 'Im Netz gibt es keine Adressprobleme (kein ⚠).';
    case 'dhcp':
      return `${name(p.geraetId)} bekommt per DHCP eine IP-Adresse.`;
  }
}

/** Warum eine Prüfung nicht bestanden ist – mit Hinweis, ohne die Lösung zu verraten. */
export function pruefFehlerText(e: Exclude<PruefErgebnis, { ok: true }>, geraet: string): string {
  switch (e.grund) {
    case 'geraet-fehlt':
      return 'Das Gerät aus der Aufgabe gibt es nicht mehr.';
    case 'browser':
      return e.fehler.grund === 'status-404'
        ? 'Der Webserver ist erreichbar, aber die Seite gibt es dort nicht.'
        : browserFehlerText(e.fehler, geraet).titel + '.';
    case 'senden':
      return sendeFehlerText(e.fehler, geraet, '');
    case 'keine-antwort':
      return 'Die Nachricht kam nicht an oder es kam keine Antwort zurück. Probiere es im Modus „Ausprobieren“ aus.';
    case 'adressprobleme':
      return `${e.anzahl} ${e.anzahl === 1 ? 'Gerät hat' : 'Geräte haben'} noch ein Adressproblem – achte auf ⚠ im Netzplan.`;
    case 'dhcp':
      return 'Es wurde keine Adresse per DHCP vergeben. Gibt es einen DHCP-Server im lokalen Rechnernetz?';
  }
}
