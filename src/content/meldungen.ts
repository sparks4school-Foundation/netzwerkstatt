import type { AdressProblem } from '../model/adressen';
import { netzBeschreibung } from '../model/ip';
import type { VerbindungsProblem } from '../model/netz';
import type { Paket, ProtokollEintrag, SendeFehler, VerwerfGrund } from '../sim/simulation';

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
    case 'anderes-netz':
      return `${zielIp} liegt nicht im Netz von ${geraet} (${f.eigenesNetz}). Nachrichten in andere Netze brauchen einen Router – das kommt später.`;
  }
}

const verwerfGrund: Record<VerwerfGrund, string> = {
  'kein-ziel': 'kein Gerät mit dieser IP-Adresse im lokalen Rechnernetz – die Nachricht geht verloren',
  'falsche-ip': 'die Nachricht ist nicht für diese IP-Adresse – sie wird verworfen',
  router: 'Router leiten zwischen Netzen weiter – das kommt später; die Nachricht geht verloren',
};

/** Ein Eintrag im Kommunikationsprotokoll als Satz. `name` übersetzt Geräte-IDs in Namen. */
export function protokollText(e: ProtokollEintrag, name: (id: string) => string): string {
  const was = (p: Paket) => (p.art === 'nachricht' ? `Nachricht „${p.inhalt}“` : 'Antwort');
  switch (e.art) {
    case 'gesendet':
      return `${was(e.paket)} an ${e.paket.zielIp} losgeschickt`;
    case 'weitergeleitet':
      return `${was(e.paket)} für ${e.paket.zielIp} weitergeleitet an ${name(e.nachId)}`;
    case 'empfangen':
      return `${was(e.paket)} von ${e.paket.quelleIp} empfangen`;
    case 'verworfen':
      return `${was(e.paket)} für ${e.paket.zielIp}: ${verwerfGrund[e.grund]}`;
    case 'nicht-gesendet':
      return `Nicht gesendet: ${sendeFehlerText(e.fehler, name(e.geraetId), e.zielIp)}`;
    case 'ip-doppelt':
      return `Achtung: ${e.paket.zielIp} ist mehrfach vergeben (${e.geraeteIds.map(name).join(', ')}).`;
    case 'falscher-empfaenger':
      return `Achtung: Die Antwort war für ${name(e.erwartetId)} gedacht, ist aber hier angekommen – die IP-Adresse ist doppelt vergeben.`;
  }
}
