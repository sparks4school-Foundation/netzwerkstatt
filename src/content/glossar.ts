import type { StufeId } from '../model/stufe';

/**
 * Verbindliche Begriffe laut Bildungsplan BW, Abschnitt 6.1 (siehe AGENTS.md 3.4).
 * Die Oberfläche bezieht Begriffe und Tooltips ausschließlich von hier.
 *
 * TODO: Kurzdefinitionen sind vorläufig formuliert und müssen mit dem offiziellen Glossar abgeglichen werden.
 */
export interface GlossarEintrag {
  begriff: string;
  kurz: string;
  /** Ab dieser Stufe wird der Begriff in der Oberfläche verwendet. */
  abStufe: StufeId;
}

export const glossar = {
  vermaschtesNetz: {
    begriff: 'vermaschtes Netz',
    kurz: 'Netz, in dem es zwischen zwei Stationen mehrere mögliche Wege gibt.',
    abStufe: '7-8',
  },
  client: {
    begriff: 'Client',
    kurz: 'Programm, das einen Dienst bei einem Server anfragt, z. B. ein Browser.',
    abStufe: '7-8',
  },
  server: {
    begriff: 'Server',
    kurz: 'Programm (Dienst), das Anfragen von Clients beantwortet. Auch der Rechner, auf dem solche Dienste laufen, wird Server genannt.',
    abStufe: '7-8',
  },
  cloud: {
    begriff: 'Cloud',
    kurz: 'Speicherplatz oder Dienste, die über das Internet auf fremden Servern bereitgestellt werden.',
    abStufe: '7-8',
  },
  speichermedien: {
    begriff: 'interne/portable Speichermedien',
    kurz: 'Fest eingebaute (z. B. SSD) oder tragbare Datenspeicher (z. B. USB-Stick).',
    abStufe: '7-8',
  },
  adressierung: {
    begriff: 'Adressierung',
    kurz: 'Jede Station erhält eine eindeutige Adresse, damit Nachrichten ihr Ziel finden.',
    abStufe: '7-8',
  },
  ipAdresse: {
    begriff: 'IP-Adresse',
    kurz: 'Zahlenadresse eines Geräts im Netz, z. B. 192.168.0.10.',
    abStufe: '7-8',
  },
  domain: {
    begriff: 'Domain',
    kurz: 'Für Menschen lesbarer Name, z. B. www.schule.test, der für eine IP-Adresse steht.',
    abStufe: '7-8',
  },
  namensaufloesung: {
    begriff: 'Namensauflösung',
    kurz: 'Übersetzen einer Domain in die zugehörige IP-Adresse.',
    abStufe: '7-8',
  },
  dns: {
    begriff: 'DNS',
    kurz: 'Domain Name System: Dienst, der Domains in IP-Adressen auflöst.',
    abStufe: '7-8',
  },
  lokalesRechnernetz: {
    begriff: 'lokales Rechnernetz',
    kurz: 'Netz aus Geräten an einem Ort, z. B. in der Schule oder zu Hause.',
    abStufe: '7-8',
  },
  webserver: {
    begriff: 'Webserver',
    kurz: 'Server-Dienst, der Webseiten an Browser ausliefert.',
    abStufe: '7-8',
  },
  schichtenmodell: {
    begriff: 'Schichtenmodell',
    kurz: 'Aufteilung der Kommunikation in Schichten, die jeweils eine Aufgabe übernehmen.',
    abStufe: '7-8',
  },
  adressen: {
    begriff: 'Adressen',
    kurz: 'Angaben, über die Absender und Empfänger einer Nachricht auf einer Schicht bestimmt werden.',
    abStufe: '11',
  },
  routing: {
    begriff: 'Routing',
    kurz: 'Wegewahl: Router entscheiden anhand ihrer Routingtabelle, wohin ein Paket weitergeschickt wird.',
    abStufe: '11',
  },
  paketorientierteUebertragung: {
    begriff: 'paketorientierte Datenübertragung',
    kurz: 'Nachrichten werden in einzelne Pakete zerlegt, getrennt verschickt und beim Empfänger wieder zusammengesetzt.',
    abStufe: '11',
  },
  kommunikationsprotokoll: {
    begriff: 'Kommunikationsprotokoll',
    kurz: 'Festgelegte Regeln, wie Stationen Nachrichten austauschen, z. B. HTTP oder DNS.',
    abStufe: '11',
  },
  protokoll: {
    begriff: 'Protokoll',
    kurz: 'Aufzeichnung, wer wann was an wen geschickt hat.',
    abStufe: '7-8',
  },
  sequenzdiagramm: {
    begriff: 'Sequenzdiagramm',
    kurz: 'Diagramm, das den zeitlichen Ablauf von Nachrichten zwischen Stationen zeigt.',
    abStufe: '11',
  },
} as const satisfies Record<string, GlossarEintrag>;

export type GlossarId = keyof typeof glossar;
