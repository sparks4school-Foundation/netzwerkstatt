import { describe, expect, it } from 'vitest';
import { baueNetz, leitungZwischen, mitGeraet } from '../model/testnetze';
import { macAdresse, schichtenVon, zweiSchichten } from './schichten';
import { Simulation } from './simulation';

function zweiNetze() {
  const { netz: roh, id } = baueNetz(
    { pc: ['computer', '192.168.1.10'], sw: ['switch'], r: ['router'], web: ['server', '192.168.2.2'] },
    [
      ['pc', 'sw'],
      ['sw', 'r'],
      ['r', 'web'],
    ],
  );
  let netz = mitGeraet(roh, id('pc'), { gateway: '192.168.1.1' });
  netz = mitGeraet(netz, id('web'), {
    gateway: '192.168.2.1',
    dienste: [{ art: 'webserver', seiten: [{ pfad: '/', html: '<h1>x</h1>' }] }],
  });
  netz = mitGeraet(netz, id('r'), {
    anschluesse: {
      [leitungZwischen(roh, id('sw'), id('r'))]: { ip: '192.168.1.1' },
      [leitungZwischen(roh, id('r'), id('web'))]: { ip: '192.168.2.1' },
    },
  });
  return { netz, id };
}

describe('Schichtenmodell', () => {
  it('zeigt HTTP über TCP, IP-Adressen Ende-zu-Ende und den Router als Empfänger auf der Netzzugangsschicht', () => {
    const { netz, id } = zweiNetze();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), '192.168.2.2');
    const e = sim.protokoll.find((x) => x.art === 'gesendet');
    if (e?.art !== 'gesendet') throw new Error('kein gesendet');
    const s = schichtenVon(netz, e.paket, e.geraetId, e.leitungId, e.hopIp);
    expect(s.anwendung).toMatchObject({
      protokoll: 'HTTP',
      felder: [{ wert: 'GET /' }, { wert: '192.168.2.2' }],
    });
    expect(s.transport.protokoll).toBe('TCP');
    expect(s.transport.felder[1]).toEqual({ name: 'Zielport', wert: '80' });
    expect(s.vermittlung.felder).toEqual([
      { name: 'Quell-IP', wert: '192.168.1.10' },
      { name: 'Ziel-IP', wert: '192.168.2.2' },
      { name: 'TTL', wert: '16' },
    ]);
    expect(s.netzzugang.felder[1]!.wert).toMatch(/^r \(02:00:/);
  });

  it('Antwort tauscht die Ports, TTL sinkt hinter dem Router', () => {
    const { netz, id } = zweiNetze();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), '192.168.2.2');
    for (let i = 0; i < 30 && sim.aktiv; i++) sim.schritt();
    const anfrage = sim.protokoll.find((x) => x.art === 'empfangen' && x.paket.art === 'http-anfrage');
    const antwort = sim.protokoll.find((x) => x.art === 'gesendet' && x.paket.art === 'http-antwort');
    if (anfrage?.art !== 'empfangen' || antwort?.art !== 'gesendet') throw new Error('Ablauf fehlt');
    expect(anfrage.paket.ttl).toBe(15);
    const s = schichtenVon(netz, antwort.paket, antwort.geraetId, antwort.leitungId, antwort.hopIp);
    const port = (n: string) => s.transport.felder.find((f) => f.name === n)!.wert;
    expect(port('Quellport')).toBe('80');
    expect(Number(port('Zielport'))).toBeGreaterThanOrEqual(49152);
  });

  it('DNS läuft über UDP Port 53', () => {
    const { netz, id } = zweiNetze();
    const sim = new Simulation(mitGeraet(netz, id('pc'), { dnsServer: '192.168.2.2' }));
    sim.aufrufen(id('pc'), 'www.x.test');
    const e = sim.protokoll.find((x) => x.art === 'gesendet');
    if (e?.art !== 'gesendet') throw new Error();
    const s = schichtenVon(sim.netz, e.paket, e.geraetId, e.leitungId, e.hopIp);
    expect(s.transport).toMatchObject({ protokoll: 'UDP', felder: [{}, { wert: '53' }] });
  });

  it('MAC-Adressen sind stabil und lokal verwaltet', () => {
    expect(macAdresse('g1', 'l1')).toBe(macAdresse('g1', 'l1'));
    expect(macAdresse('g1', 'l1')).not.toBe(macAdresse('g1', 'l2'));
    expect(macAdresse('g1', 'l1')).toMatch(/^02:00(:[0-9a-f]{2}){4}$/);
  });

  it('vereinfachte 2-Schichten-Sicht für Klasse 7/8', () => {
    const { netz, id } = zweiNetze();
    const sim = new Simulation(netz);
    sim.senden(id('pc'), '192.168.2.2', 'Hallo');
    const e = sim.protokoll.find((x) => x.art === 'gesendet');
    if (e?.art !== 'gesendet') throw new Error();
    expect(zweiSchichten(netz, e.paket)).toEqual({
      dienst: [
        { name: 'Dienst', wert: 'Nachricht (Echo)' },
        { name: 'Inhalt', wert: 'Hallo' },
      ],
      infrastruktur: [
        { name: 'Von', wert: 'pc (192.168.1.10)' },
        { name: 'An', wert: 'web (192.168.2.2)' },
      ],
    });
  });
});
