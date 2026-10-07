import type { StufeId } from '../../model/stufe';
import erstesNetz from './erstes-netz.json';
import fehlersucheWebseite from './fehlersuche-webseite.json';
import heimnetzWlan from './heimnetz-wlan.json';
import paketvermittlung from './paketvermittlung.json';
import schulnetzWebDns from './schulnetz-web-dns.json';
import vermaschtesNetz from './vermaschtes-netz.json';
import zweiNetzeRouter from './zwei-netze-router.json';

/**
 * Beispielnetze zum Sofort-Loslegen (Inhalte unter CC BY-SA 4.0).
 * Jede Datei ist eine normale Netzwerkstatt-Datei; ein Unit-Test prüft, dass alle gültig sind.
 * Neue Beispiele: JSON-Datei in diesen Ordner legen und hier eintragen.
 */
export interface Beispiel {
  id: string;
  titel: string;
  stufe: StufeId;
  /** Bezug zum Bildungsplan, z. B. „TK 4, TK 5“ */
  bezug: string;
  beschreibung: string;
  /** Arbeitsauftrag für Schüler:innen – erscheint nach dem Öffnen. */
  auftrag: string;
  daten: unknown;
}

export const beispiele: Beispiel[] = [
  {
    id: 'erstes-netz',
    titel: 'Erstes lokales Rechnernetz',
    stufe: '7-8',
    bezug: 'TK 2, TK 3',
    beschreibung: 'Drei Computer an einem Switch. Einem Computer fehlt noch die IP-Adresse.',
    auftrag:
      'Gib Computer C eine passende IP-Adresse. Wechsle dann zu „Ausprobieren“ und schicke von Computer A eine Nachricht an Computer C.',
    daten: erstesNetz,
  },
  {
    id: 'heimnetz-wlan',
    titel: 'Heimnetz mit WLAN',
    stufe: '7-8',
    bezug: 'TK 2, TK 3',
    beschreibung: 'Laptop und PC per Kabel, Smartphone und Spielkonsole per WLAN über einen Access Point.',
    auftrag:
      'Verfolge Schritt für Schritt, welchen Weg eine Nachricht vom Smartphone zum PC im Arbeitszimmer nimmt. Über welche Geräte läuft sie?',
    daten: heimnetzWlan,
  },
  {
    id: 'schulnetz-web-dns',
    titel: 'Schulnetz mit Webserver und DNS',
    stufe: '7-8',
    bezug: 'TK 1, TK 4, TK 5',
    beschreibung:
      'Ein fertiges Netz mit Webserver und DNS-Server. Die Schul-Website ist unter www.schule.test erreichbar.',
    auftrag:
      'Öffne auf Computer 1 den Browser und rufe www.schule.test auf. Beobachte im Protokoll: Wen fragt der Computer zuerst – und warum? Schalte danach auf die Ansicht „Dienste“.',
    daten: schulnetzWebDns,
  },
  {
    id: 'fehlersuche-webseite',
    titel: 'Fehlersuche: Warum lädt die Seite nicht?',
    stufe: '7-8',
    bezug: 'TK 3, TK 4 · Fehlersuche',
    beschreibung: 'Diagnoseaufgabe: In diesem Netz sind drei Fehler versteckt.',
    auftrag:
      'Auf Computer 1 soll www.schule.test angezeigt werden – das klappt aber nicht. Finde und behebe die drei Fehler. Tipp: Lies die Fehlermeldungen im Browser und im Protokoll genau.',
    daten: fehlersucheWebseite,
  },
  {
    id: 'zwei-netze-router',
    titel: 'Zwei Netze mit Router',
    stufe: '11',
    bezug: 'TK 2, TK 3',
    beschreibung:
      'Zwei lokale Rechnernetze, verbunden über einen Router. Webserver und DNS-Server stehen in Netz B.',
    auftrag:
      'Rufe auf Computer A1 die Seite www.netz-b.test auf. Verfolge im Protokoll, welche Rolle der Router spielt. Sieh dir dann seine Routingtabelle an: Woher weiß er, wohin er die Pakete schicken muss? Was passiert, wenn du bei Computer A1 das Gateway löschst?',
    daten: zweiNetzeRouter,
  },
  {
    id: 'vermaschtes-netz',
    titel: 'Vermaschtes Netz: Umweg bei Ausfall',
    stufe: '11',
    bezug: 'TK 3 · Routing',
    beschreibung: 'Drei Router im Dreieck. Zwischen PC A und PC B gibt es zwei Wege.',
    auftrag:
      'Schicke von PC A eine Nachricht an 192.168.2.10 und notiere, über welche Router sie läuft. Lass dann die Leitung zwischen Router 1 und Router 3 ausfallen und sende erneut. Stelle anschließend die Routingtabelle von Router 1 auf „von Hand“ und wiederhole den Versuch. Erkläre den Unterschied.',
    daten: vermaschtesNetz,
  },
  {
    id: 'paketvermittlung',
    titel: 'Paketvermittlung: Teile auf verschiedenen Wegen',
    stufe: '11',
    bezug: 'TK 4 · paketorientierte Datenübertragung',
    beschreibung: 'Zwei gleich lange Wege vom Sender zum Empfänger – einer davon über eine lange Leitung.',
    auftrag:
      'Wähle „Ausprobieren“ und schalte unter „Einstellungen“ „verschiedene Wege“ ein. Sende vom Sender einen Text „in Paketen“ an 192.168.2.10. In welcher Reihenfolge kommen die Teile an? Stelle dann die Leitung zum Empfänger auf 25 % Verlust und beobachte, was mit und ohne Bestätigungen passiert.',
    daten: paketvermittlung,
  },
];
