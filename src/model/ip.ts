/**
 * IPv4-Adressen als 32-Bit-Zahlen. Bewusst nur IPv4 – das ist die Tiefe des Bildungsplans.
 */
export const STANDARD_SUBNETZMASKE = '255.255.255.0';

/** Wandelt „192.168.0.10“ in eine Zahl um; `null` bei ungültiger Eingabe. */
export function ipZuZahl(text: string): number | null {
  const teile = text.trim().split('.');
  if (teile.length !== 4) return null;
  let zahl = 0;
  for (const teil of teile) {
    if (!/^\d{1,3}$/.test(teil)) return null;
    const n = Number(teil);
    if (n > 255) return null;
    zahl = zahl * 256 + n;
  }
  return zahl;
}

export function zahlZuIp(zahl: number): string {
  return [24, 16, 8, 0].map((s) => Math.floor(zahl / 2 ** s) % 256).join('.');
}

/** Gültige Subnetzmaske: von links durchgehend Einsen, dann nur Nullen (z. B. 255.255.255.0). */
export function maskeZuZahl(text: string): number | null {
  const zahl = ipZuZahl(text);
  if (zahl === null) return null;
  const invertiert = 2 ** 32 - 1 - zahl;
  // invertiert + 1 muss eine Zweierpotenz sein (0…01…1).
  return ((invertiert + 1) & invertiert) === 0 ? zahl : null;
}

/** Netzanteil einer Adresse (bitweises UND mit der Maske, vorzeichenlos). */
export function netzanteil(ip: number, maske: number): number {
  return (ip & maske) >>> 0;
}

export function gleichesNetz(a: number, b: number, maske: number): boolean {
  return netzanteil(a, maske) === netzanteil(b, maske);
}

/** Ist die Adresse die Netzadresse (Geräteanteil nur Nullen) oder Broadcast (nur Einsen)? */
export function istReserviert(ip: number, maske: number): 'netzadresse' | 'broadcast' | null {
  const geraeteanteil = (ip & ~maske) >>> 0;
  if (geraeteanteil === 0) return 'netzadresse';
  if (geraeteanteil === ~maske >>> 0) return 'broadcast';
  return null;
}

/** Private Adressbereiche nach RFC 1918 (für Klasse 11: lokale vs. globale Adressen). */
export function istPrivat(ip: number): boolean {
  const a = Math.floor(ip / 2 ** 24);
  const b = Math.floor(ip / 2 ** 16) % 256;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Schreibweise für den Netzanteil, z. B. „192.168.0.x“ bei /24 – für verständliche Meldungen. */
export function netzBeschreibung(ip: number, maske: number): string {
  const teile = zahlZuIp(netzanteil(ip, maske)).split('.');
  const maskenTeile = zahlZuIp(maske).split('.');
  return teile.map((t, i) => (maskenTeile[i] === '255' ? t : 'x')).join('.');
}
