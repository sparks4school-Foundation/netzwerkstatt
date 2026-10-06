import { describe, expect, it } from 'vitest';
import { adressProbleme, ipVorschlag } from './adressen';
import {
  gleichesNetz,
  ipZuZahl,
  istPrivat,
  istReserviert,
  maskeZuZahl,
  netzBeschreibung,
  zahlZuIp,
} from './ip';
import { baueNetz } from './testnetze';
import { segment, weg } from './topologie';

const ip = (t: string) => ipZuZahl(t)!;

describe('IPv4', () => {
  it('liest gültige Adressen und lehnt ungültige ab', () => {
    expect(zahlZuIp(ip('192.168.0.10'))).toBe('192.168.0.10');
    for (const falsch of [
      '192.168.0',
      '192.168.0.256',
      '1.2.3.4.5',
      'a.b.c.d',
      '',
      '192.168.0.-1',
      '1..2.3',
    ]) {
      expect(ipZuZahl(falsch)).toBeNull();
    }
  });

  it('erkennt gültige Subnetzmasken', () => {
    expect(maskeZuZahl('255.255.255.0')).not.toBeNull();
    expect(maskeZuZahl('255.255.0.0')).not.toBeNull();
    expect(maskeZuZahl('255.0.255.0')).toBeNull();
  });

  it('vergleicht Netzanteile', () => {
    const m = maskeZuZahl('255.255.255.0')!;
    expect(gleichesNetz(ip('192.168.0.10'), ip('192.168.0.200'), m)).toBe(true);
    expect(gleichesNetz(ip('192.168.0.10'), ip('192.168.1.10'), m)).toBe(false);
    expect(netzBeschreibung(ip('192.168.0.10'), m)).toBe('192.168.0.x');
  });

  it('erkennt reservierte und private Adressen', () => {
    const m = maskeZuZahl('255.255.255.0')!;
    expect(istReserviert(ip('192.168.0.0'), m)).toBe('netzadresse');
    expect(istReserviert(ip('192.168.0.255'), m)).toBe('broadcast');
    expect(istReserviert(ip('192.168.0.1'), m)).toBeNull();
    expect(istPrivat(ip('10.1.2.3'))).toBe(true);
    expect(istPrivat(ip('172.20.0.1'))).toBe(true);
    expect(istPrivat(ip('8.8.8.8'))).toBe(false);
  });
});

describe('Topologie', () => {
  const { netz, id } = baueNetz(
    {
      pc1: ['computer'],
      pc2: ['computer'],
      sw1: ['switch'],
      sw2: ['switch'],
      ap: ['access-point'],
      handy: ['smartphone'],
      r: ['router'],
      pc3: ['computer'],
    },
    [
      ['pc1', 'sw1'],
      ['sw1', 'sw2'],
      ['pc2', 'sw2'],
      ['ap', 'sw2'],
      ['handy', 'ap', 'wlan'],
      ['sw2', 'r'],
      ['r', 'pc3'],
    ],
  );

  it('fasst Geräte hinter Switches und Access Points zu einem Segment zusammen', () => {
    const s = segment(netz, id('pc1'));
    for (const n of ['pc1', 'pc2', 'sw1', 'sw2', 'ap', 'handy', 'r']) expect(s.has(id(n))).toBe(true);
    expect(s.has(id('pc3'))).toBe(false); // hinter dem Router
  });

  it('findet den kürzesten Weg durch Switches, aber nicht durch Router', () => {
    expect(weg(netz, id('pc1'), id('handy'))?.length).toBe(4);
    expect(weg(netz, id('pc1'), id('pc3'))).toBeNull();
  });
});

describe('Adressprobleme', () => {
  it('meldet ungültige Eingaben', () => {
    const { netz, id } = baueNetz({ pc: ['computer', '192.168.0.300'] });
    expect(adressProbleme(netz).get(id('pc'))).toEqual([{ art: 'ip-ungueltig' }]);
  });

  it('meldet doppelte IP-Adressen im selben lokalen Rechnernetz', () => {
    const { netz, id } = baueNetz(
      { a: ['computer', '192.168.0.10'], b: ['computer', '192.168.0.10'], s: ['switch'] },
      [
        ['a', 's'],
        ['b', 's'],
      ],
    );
    const p = adressProbleme(netz);
    expect(p.get(id('a'))).toMatchObject([{ art: 'ip-doppelt', mit: [{ name: 'b' }] }]);
    expect(p.get(id('b'))).toMatchObject([{ art: 'ip-doppelt', mit: [{ name: 'a' }] }]);
  });

  it('meldet gleiche IP-Adressen in getrennten Netzen nicht', () => {
    const { netz } = baueNetz({ a: ['computer', '192.168.0.10'], b: ['computer', '192.168.0.10'] });
    expect(adressProbleme(netz).size).toBe(0);
  });

  it('meldet ein Gerät, das nicht zum Netz der anderen passt', () => {
    const { netz, id } = baueNetz(
      {
        a: ['computer', '192.168.0.10'],
        b: ['computer', '192.168.0.11'],
        c: ['computer', '192.168.1.12'],
        s: ['switch'],
      },
      [
        ['a', 's'],
        ['b', 's'],
        ['c', 's'],
      ],
    );
    const p = adressProbleme(netz);
    expect(p.get(id('c'))).toMatchObject([{ art: 'anderes-netz' }]);
    expect(p.has(id('a'))).toBe(false);
  });

  it('meldet reservierte Adressen', () => {
    const { netz, id } = baueNetz({ a: ['computer', '192.168.0.255'] });
    expect(adressProbleme(netz).get(id('a'))).toEqual([{ art: 'ip-reserviert', welche: 'broadcast' }]);
  });
});

describe('IP-Vorschlag', () => {
  it('schlägt die nächste freie Adresse im Netz der Nachbarn vor', () => {
    const { netz, id } = baueNetz({ a: ['computer', '10.0.0.10'], b: ['computer'], s: ['switch'] }, [
      ['a', 's'],
      ['b', 's'],
    ]);
    expect(ipVorschlag(netz, id('b'))).toBe('10.0.0.11');
  });

  it('nimmt ohne Nachbarn 192.168.0.10', () => {
    const { netz, id } = baueNetz({ a: ['computer'] });
    expect(ipVorschlag(netz, id('a'))).toBe('192.168.0.10');
  });
});
