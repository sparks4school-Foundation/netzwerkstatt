import type { VerbindungsProblem } from '../model/netz';

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
