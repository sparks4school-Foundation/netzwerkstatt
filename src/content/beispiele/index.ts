import type { StufeId } from '../../model/stufe';
import erstesNetz from './erstes-netz.json';
import fehlersucheWebseite from './fehlersuche-webseite.json';
import heimnetzWlan from './heimnetz-wlan.json';
import heimnetzeInternet from './heimnetze-internet.json';
import paketvermittlung from './paketvermittlung.json';
import schulnetzWebDns from './schulnetz-web-dns.json';
import vermaschtesNetz from './vermaschtes-netz.json';
import zweiNetzeRouter from './zwei-netze-router.json';

/**
 * Beispielnetze zum Sofort-Loslegen (Inhalte unter CC BY-SA 4.0).
 * Jede Datei ist eine normale Netzwerkstatt-Datei mit Aufgabe (Auftrag, Hilfen, Prüfungen);
 * ein Unit-Test prüft, dass alle gültig sind.
 * Neue Beispiele: JSON-Datei in diesen Ordner legen und hier eintragen.
 */
export interface Beispiel {
  id: string;
  titel: string;
  stufe: StufeId;
  /** Bezug zum Bildungsplan, z. B. „TK 4, TK 5“ */
  bezug: string;
  beschreibung: string;
  daten: unknown;
}

export const beispiele: Beispiel[] = [
  {
    id: 'erstes-netz',
    titel: 'Erstes lokales Rechnernetz',
    stufe: '7-8',
    bezug: 'TK 2, TK 3',
    beschreibung: 'Drei Computer an einem Switch. Einem Computer fehlt noch die IP-Adresse.',
    daten: erstesNetz,
  },
  {
    id: 'heimnetz-wlan',
    titel: 'Heimnetz mit WLAN',
    stufe: '7-8',
    bezug: 'TK 2, TK 3',
    beschreibung: 'Laptop und PC per Kabel, Smartphone und Spielkonsole per WLAN über einen Access Point.',
    daten: heimnetzWlan,
  },
  {
    id: 'schulnetz-web-dns',
    titel: 'Schulnetz mit Webserver und DNS',
    stufe: '7-8',
    bezug: 'TK 1, TK 4, TK 5',
    beschreibung:
      'Ein fertiges Netz mit Webserver und DNS-Server. Die Schul-Website ist unter www.schule.test erreichbar.',
    daten: schulnetzWebDns,
  },
  {
    id: 'fehlersuche-webseite',
    titel: 'Fehlersuche: Warum lädt die Seite nicht?',
    stufe: '7-8',
    bezug: 'TK 3, TK 4 · Fehlersuche',
    beschreibung: 'Diagnoseaufgabe: In diesem Netz sind drei Fehler versteckt.',
    daten: fehlersucheWebseite,
  },
  {
    id: 'zwei-netze-router',
    titel: 'Zwei Netze mit Router',
    stufe: '11',
    bezug: 'TK 2, TK 3',
    beschreibung:
      'Zwei lokale Rechnernetze, verbunden über einen Router. Webserver und DNS-Server stehen in Netz B.',
    daten: zweiNetzeRouter,
  },
  {
    id: 'vermaschtes-netz',
    titel: 'Vermaschtes Netz: Umweg bei Ausfall',
    stufe: '11',
    bezug: 'TK 3 · Routing',
    beschreibung: 'Drei Router im Dreieck. Zwischen PC A und PC B gibt es zwei Wege.',
    daten: vermaschtesNetz,
  },
  {
    id: 'paketvermittlung',
    titel: 'Paketvermittlung: Teile auf verschiedenen Wegen',
    stufe: '11',
    bezug: 'TK 4 · paketorientierte Datenübertragung',
    beschreibung: 'Zwei gleich lange Wege vom Sender zum Empfänger – einer davon über eine lange Leitung.',
    daten: paketvermittlung,
  },
  {
    id: 'heimnetze-internet',
    titel: 'Heimnetze und Internet (DHCP und NAT)',
    stufe: '11',
    bezug: 'TK 2, TK 5, TK 6',
    beschreibung:
      'Zwei Familien nutzen dieselben privaten Adressen (192.168.178.x). Ihre Heimrouter verbinden sie mit dem Internet.',
    daten: heimnetzeInternet,
  },
];
