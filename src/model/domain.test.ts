import { describe, expect, it } from 'vitest';
import { istGueltigeDomain, linkZiel, zerlegeAdresse } from './domain';

describe('Domains und Adressen', () => {
  it('prüft Domains', () => {
    for (const d of ['www.schule.test', 'schule', 'meine-seite.test', 'Bäckerei.test'])
      expect(istGueltigeDomain(d)).toBe(true);
    for (const d of ['', 'www schule.test', '-x.test', 'a..b', '192.168.0.2'])
      expect(istGueltigeDomain(d)).toBe(false);
  });

  it('zerlegt Eingaben in der Adresszeile', () => {
    expect(zerlegeAdresse('www.schule.test')).toEqual({ host: 'www.schule.test', pfad: '/', istIp: false });
    expect(zerlegeAdresse('http://WWW.Schule.test/kontakt.html')).toEqual({
      host: 'www.schule.test',
      pfad: '/kontakt.html',
      istIp: false,
    });
    expect(zerlegeAdresse('192.168.0.2/index.html')).toEqual({ host: '192.168.0.2', pfad: '/', istIp: true });
    expect(zerlegeAdresse('?!')).toBeNull();
  });
});

describe('Links', () => {
  const hier = { host: 'www.schule.test', pfad: '/infos/start.html', istIp: false };
  it('löst Links relativ zur aktuellen Seite auf', () => {
    expect(linkZiel('/kontakt.html', hier)).toBe('www.schule.test/kontakt.html');
    expect(linkZiel('mehr.html', hier)).toBe('www.schule.test/infos/mehr.html');
    expect(linkZiel('http://www.andere.test/', hier)).toBe('http://www.andere.test/');
  });
});
