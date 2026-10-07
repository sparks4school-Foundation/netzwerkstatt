import { describe, expect, it } from 'vitest';
import { adressProbleme } from '../model/adressen';
import { ipZuZahl, zahlZuIp } from '../model/ip';
import { automatischeRouten } from '../model/routing';
import { baueNetz, leitungZwischen, mitGeraet } from '../model/testnetze';
import { sequenzdiagramm } from './sequenz';
import { Simulation } from './simulation';

function lauf(sim: Simulation) {
  for (let i = 0; i < 200 && sim.aktiv; i++) sim.schritt();
  expect(sim.aktiv).toBe(false);
  return sim;
}

/** Lokales Netz: zwei DHCP-Clients, ein Gerät mit fester Adresse, DHCP-Server auf einem Server. */
function dhcpNetz() {
  const { netz: roh, id } = baueNetz(
    {
      pc1: ['computer'],
      pc2: ['computer'],
      drucker: ['computer', '192.168.0.100'],
      srv: ['server', '192.168.0.2'],
      sw: ['switch'],
    },
    [
      ['pc1', 'sw'],
      ['pc2', 'sw'],
      ['drucker', 'sw'],
      ['srv', 'sw'],
    ],
  );
  let netz = mitGeraet(roh, id('pc1'), { dhcp: true });
  netz = mitGeraet(netz, id('pc2'), { dhcp: true });
  netz = mitGeraet(netz, id('srv'), {
    dienste: [
      {
        art: 'dhcp-server',
        von: '192.168.0.100',
        bis: '192.168.0.110',
        subnetzmaske: '255.255.255.0',
        gateway: '192.168.0.1',
        dnsServer: '192.168.0.2',
      },
    ],
  });
  return { netz, id };
}

describe('DHCP', () => {
  it('Discover → Offer → Request → Ack; Client bekommt die erste freie Adresse', () => {
    const { netz, id } = dhcpNetz();
    const sim = new Simulation(netz);
    sim.dhcpAnfordern(id('pc1'));
    lauf(sim);
    expect(sim.dhcpZustand(id('pc1'))).toMatchObject({
      phase: 'fertig',
      angebot: { ip: '192.168.0.101', gateway: '192.168.0.1' },
    });
    // .100 ist schon fest vergeben (Drucker)
    expect(sim.netz.geraete.find((g) => g.id === id('pc1'))).toMatchObject({
      ip: '192.168.0.101',
      dnsServer: '192.168.0.2',
    });
    const arten = sequenzdiagramm(sim.protokoll, false).pfeile.map((p) => p.paket.art);
    expect(arten).toEqual(['dhcp-discover', 'dhcp-offer', 'dhcp-request', 'dhcp-ack']);
  });

  it('Rundsendung: Der Switch verteilt an alle, nicht zuständige Geräte ignorieren sie', () => {
    const { netz, id } = dhcpNetz();
    const sim = new Simulation(netz);
    sim.dhcpAnfordern(id('pc1'));
    lauf(sim);
    const ignoriert = sim.protokoll.filter(
      (e) => e.art === 'verworfen' && e.grund === 'rundsendung-ignoriert',
    );
    expect(ignoriert.map((e) => e.geraetId)).toContain(id('drucker'));
  });

  it('zwei Clients bekommen verschiedene Adressen und können sich dann erreichen', () => {
    const { netz, id } = dhcpNetz();
    const sim = new Simulation(netz);
    sim.dhcpAnfordern(id('pc1'));
    lauf(sim);
    sim.dhcpAnfordern(id('pc2'));
    lauf(sim);
    expect(sim.dhcpZustand(id('pc2'))).toMatchObject({ angebot: { ip: '192.168.0.102' } });
    expect(sim.senden(id('pc2'), '192.168.0.101', 'Hallo')).toEqual({ ok: true });
    lauf(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'empfangen', geraetId: id('pc2') });
  });

  it('ohne DHCP-Server: Client bekommt nach dem Zeitlimit keine Adresse', () => {
    const { netz, id } = dhcpNetz();
    const sim = new Simulation(mitGeraet(netz, id('srv'), { dienste: [] }));
    sim.dhcpAnfordern(id('pc1'));
    lauf(sim);
    expect(sim.dhcpZustand(id('pc1'))).toEqual({ phase: 'fehler' });
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'dhcp-fehlgeschlagen' });
  });

  it('DHCP-Client ohne Adresse kann nicht senden – verständlicher Fehler', () => {
    const { netz, id } = dhcpNetz();
    expect(new Simulation(netz).senden(id('pc1'), '192.168.0.2', 'x')).toMatchObject({
      ok: false,
      grund: 'dhcp-fehlt',
    });
  });

  it('DHCP-Clients werden nicht als „ohne IP“ oder doppelt gemeldet', () => {
    const { netz } = dhcpNetz();
    expect(adressProbleme(netz).size).toBe(0);
  });
});

/**
 * Zwei Heimnetze mit DENSELBEN privaten Adressen hinter je einem NAT-Router, dazwischen das Internet.
 *
 *   pcA(192.168.178.10) — swA — homeA ═══ inet ═══ homeB — swB — pcB(192.168.178.10)
 *                                         ║
 *                                        web (198.51.100.10)
 */
function internet() {
  const { netz: roh, id } = baueNetz(
    {
      pcA: ['computer', '192.168.178.10'],
      swA: ['switch'],
      homeA: ['router'],
      inet: ['router'],
      homeB: ['router'],
      swB: ['switch'],
      pcB: ['computer', '192.168.178.10'],
      web: ['server', '198.51.100.10'],
    },
    [
      ['pcA', 'swA'],
      ['swA', 'homeA'],
      ['homeA', 'inet'],
      ['inet', 'homeB'],
      ['homeB', 'swB'],
      ['pcB', 'swB'],
      ['inet', 'web'],
    ],
  );
  const l = (a: string, b: string) => leitungZwischen(roh, id(a), id(b));
  let netz = mitGeraet(roh, id('pcA'), { gateway: '192.168.178.1' });
  netz = mitGeraet(netz, id('pcB'), { gateway: '192.168.178.1' });
  netz = mitGeraet(netz, id('web'), {
    gateway: '198.51.100.1',
    dienste: [{ art: 'webserver', seiten: [{ pfad: '/', html: '<h1>Internet</h1>' }] }],
  });
  netz = mitGeraet(netz, id('homeA'), {
    anschluesse: {
      [l('swA', 'homeA')]: { ip: '192.168.178.1' },
      [l('homeA', 'inet')]: { ip: '203.0.113.2' },
    },
    nat: { aussenLeitungId: l('homeA', 'inet') },
  });
  netz = mitGeraet(netz, id('homeB'), {
    anschluesse: {
      [l('homeB', 'swB')]: { ip: '192.168.178.1' },
      [l('inet', 'homeB')]: { ip: '203.0.114.2' },
    },
    nat: { aussenLeitungId: l('inet', 'homeB') },
  });
  netz = mitGeraet(netz, id('inet'), {
    anschluesse: {
      [l('homeA', 'inet')]: { ip: '203.0.113.1' },
      [l('inet', 'homeB')]: { ip: '203.0.114.1' },
      [l('inet', 'web')]: { ip: '198.51.100.1' },
    },
  });
  return { netz, id };
}

describe('NAT (vereinfacht)', () => {
  it('Internet-Router kennt die privaten Heimnetze nicht', () => {
    const { netz, id } = internet();
    const ziele = automatischeRouten(netz, id('inet')).map((r) => zahlZuIp(r.ziel));
    expect(ziele).not.toContain('192.168.178.0');
    expect(ziele).toContain('203.0.113.0');
  });

  it('beide Heimnetze dürfen dieselben privaten Adressen haben', () => {
    expect(adressProbleme(internet().netz).size).toBe(0);
  });

  it('Seite aus dem Internet laden: Absender wird übersetzt, Antwort zurückübersetzt', () => {
    const { netz, id } = internet();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pcA'), '198.51.100.10');
    lauf(sim);
    expect(sim.browser(id('pcA'))).toMatchObject({ phase: 'fertig', status: 200 });
    // Der Webserver sieht nur die öffentliche Adresse des Heimrouters
    const amServer = sim.protokoll.find((e) => e.art === 'empfangen' && e.geraetId === id('web'));
    expect(amServer && 'paket' in amServer && amServer.paket.quelleIp).toBe('203.0.113.2');
    expect(sim.natTabelle(id('homeA'))).toMatchObject([
      { innenIp: '192.168.178.10', aussenIp: '203.0.113.2', zielIp: '198.51.100.10' },
    ]);
    expect(sim.protokoll.filter((e) => e.art === 'nat').map((e) => e.art === 'nat' && e.richtung)).toEqual([
      'aus',
      'ein',
    ]);
  });

  it('beide Heimnetze erreichen gleichzeitig den Webserver – trotz gleicher privater Adressen', () => {
    const { netz, id } = internet();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pcA'), '198.51.100.10');
    sim.aufrufen(id('pcB'), '198.51.100.10');
    lauf(sim);
    expect(sim.browser(id('pcA'))).toMatchObject({ phase: 'fertig' });
    expect(sim.browser(id('pcB'))).toMatchObject({ phase: 'fertig' });
  });

  it('von außen ist ein Gerät im Heimnetz nicht direkt erreichbar', () => {
    const { netz, id } = internet();
    const sim = new Simulation(netz);
    // Der Webserver versucht, eine private Adresse zu erreichen
    sim.senden(id('web'), '192.168.178.10', 'Hallo?');
    lauf(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({
      art: 'verworfen',
      grund: 'keine-route',
      geraetId: id('inet'),
    });
    expect(ipZuZahl('192.168.178.10')).not.toBeNull();
  });
});
