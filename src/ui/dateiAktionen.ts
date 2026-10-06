import { ladeNetz, speichereNetz, type LadeErgebnis, type NetzDatei } from '../model/datei';

const DATEI_ENDUNG = '.netzwerkstatt.json';
const AUTOSAVE_SCHLUESSEL = 'netzwerkstatt:aktuelles-netz';

/** Bietet das Netz als Datei zum Herunterladen an – ohne Server, direkt im Browser. */
export function netzHerunterladen(netz: NetzDatei): void {
  const blob = new Blob([speichereNetz(netz)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (netz.titel.trim() || 'netz').replace(/[^\p{L}\p{N}_-]+/gu, '-') + DATEI_ENDUNG;
  a.click();
  URL.revokeObjectURL(url);
}

export async function netzAusDatei(datei: File): Promise<LadeErgebnis> {
  return ladeNetz(await datei.text());
}

/**
 * Zwischenspeicher im Browser, damit nach einem versehentlichen Neuladen nichts verloren geht.
 * Enthält nur das Netz, keine personenbezogenen Daten (AGENTS.md 6.3). Fehler werden bewusst ignoriert
 * (z. B. privater Modus oder gesperrter Speicher).
 */
export function zwischenspeichern(netz: NetzDatei): void {
  try {
    localStorage.setItem(AUTOSAVE_SCHLUESSEL, speichereNetz(netz));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

export function zwischenspeicherLaden(): NetzDatei | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_SCHLUESSEL);
    if (!text) return null;
    const ergebnis = ladeNetz(text);
    return ergebnis.ok ? ergebnis.netz : null;
  } catch {
    return null;
  }
}
