import type { DienstArt, GeraetTyp, LeitungsArt } from '../model/datei';
import type { GlossarId } from './glossar';

/** Bezeichnungen der Bausteine in der Oberfläche (Bildungsplan 7/8, TK 2). */
export const geraeteTexte: Record<GeraetTyp, { name: string; beschreibung: string }> = {
  computer: { name: 'Computer', beschreibung: 'Endgerät mit einem Netzanschluss (Kabel oder WLAN).' },
  smartphone: { name: 'Smartphone', beschreibung: 'Endgerät, das sich nur per WLAN verbindet.' },
  spielkonsole: { name: 'Spielkonsole', beschreibung: 'Endgerät mit einem Netzanschluss (Kabel oder WLAN).' },
  server: {
    name: 'Server',
    beschreibung:
      'Rechner (Hardware), auf dem Dienste wie ein Webserver laufen. Wird per Kabel angeschlossen.',
  },
  switch: {
    name: 'Switch',
    beschreibung: 'Verteiler, der Geräte in einem lokalen Rechnernetz per Kabel verbindet.',
  },
  router: { name: 'Router', beschreibung: 'Verteiler, der verschiedene Netze miteinander verbindet.' },
  'access-point': {
    name: 'Access Point',
    beschreibung: 'Verteiler, der Geräte per WLAN mit dem kabelgebundenen Netz verbindet.',
  },
};

export const leitungsTexte: Record<LeitungsArt, { name: string; beschreibung: string }> = {
  kabel: { name: 'Kabel', beschreibung: 'Physische Leitung per Netzwerkkabel.' },
  wlan: { name: 'WLAN', beschreibung: 'Funkverbindung zwischen einem Access Point und einem Endgerät.' },
};

/** Dienste: Name, Rolle und passender Glossarbegriff (für Tooltips). */
export const dienstTexte: Record<
  DienstArt,
  { name: string; rolle: 'Client' | 'Server-Dienst'; beschreibung: string; glossar: GlossarId }
> = {
  browser: {
    name: 'Browser',
    rolle: 'Client',
    beschreibung: 'Ruft Webseiten von Webservern ab und zeigt sie an.',
    glossar: 'client',
  },
  webserver: {
    name: 'Webserver',
    rolle: 'Server-Dienst',
    beschreibung: 'Liefert Webseiten an Browser aus. Die Seiten schreibst du selbst in HTML.',
    glossar: 'webserver',
  },
  'dns-server': {
    name: 'DNS-Server',
    rolle: 'Server-Dienst',
    beschreibung: 'Beantwortet die Frage „Welche IP-Adresse gehört zu dieser Domain?“ anhand seiner Tabelle.',
    glossar: 'dns',
  },
  'dhcp-server': {
    name: 'DHCP-Server',
    rolle: 'Server-Dienst',
    beschreibung:
      'Vergibt IP-Adressen automatisch an Geräte, die danach fragen (z. B. im Heimnetz der Router).',
    glossar: 'adressierung',
  },
};
