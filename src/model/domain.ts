import { ipZuZahl } from './ip';

/**
 * Domains und Adressen, wie man sie in die Adresszeile tippt.
 * Beispiele verwenden die reservierte Endung „.test“, damit keine echten Domains vorkommen.
 */

/** Kleinbuchstaben, ohne Leerzeichen und ohne abschließenden Punkt. */
export function normalisiereDomain(text: string): string {
  return text.trim().toLowerCase().replace(/\.$/, '');
}

/** Gültig: Teile aus Buchstaben, Ziffern und Bindestrich, durch Punkte getrennt (z. B. www.schule.test). */
export function istGueltigeDomain(text: string): boolean {
  const domain = normalisiereDomain(text);
  if (!domain || domain.length > 253 || ipZuZahl(domain) !== null) return false;
  return domain.split('.').every((teil) => /^[a-z0-9äöüß]([a-z0-9äöüß-]{0,61}[a-z0-9äöüß])?$/.test(teil));
}

export interface Adresse {
  /** Domain oder IP-Adresse */
  host: string;
  /** Pfad der Seite, immer mit „/“ am Anfang */
  pfad: string;
  istIp: boolean;
}

/**
 * Zerlegt eine Eingabe in der Adresszeile: „http://www.schule.test/kontakt.html“, „www.schule.test“,
 * „192.168.0.2“. Liefert `null`, wenn der Host weder Domain noch IP-Adresse ist.
 */
export function zerlegeAdresse(eingabe: string): Adresse | null {
  const ohneSchema = eingabe.trim().replace(/^[a-z]+:\/\//i, '');
  const schraegstrich = ohneSchema.indexOf('/');
  const host = normalisiereDomain(schraegstrich === -1 ? ohneSchema : ohneSchema.slice(0, schraegstrich));
  let pfad = schraegstrich === -1 ? '/' : ohneSchema.slice(schraegstrich);
  pfad = normalisierePfad(pfad);
  if (ipZuZahl(host) !== null) return { host, pfad, istIp: true };
  if (istGueltigeDomain(host)) return { host, pfad, istIp: false };
  return null;
}

/** „/index.html“ ist dasselbe wie „/“; Pfade ohne führenden „/“ bekommen einen. */
export function normalisierePfad(pfad: string): string {
  let p = pfad.trim().split(/[?#]/)[0] ?? '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p === '/index.html' || p === '/index.htm') p = '/';
  return p;
}

export function adresseAlsText(a: Adresse): string {
  return `http://${a.host}${a.pfad === '/' ? '/' : a.pfad}`;
}

/** Löst einen Link relativ zur aktuellen Seite auf: „/kontakt.html“, „kontakt.html“ oder „http://…“. */
export function linkZiel(href: string, aktuell: Adresse): string {
  if (/^[a-z]+:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `${aktuell.host}${href}`;
  const ordner = aktuell.pfad.slice(0, aktuell.pfad.lastIndexOf('/') + 1);
  return `${aktuell.host}${ordner}${href}`;
}
