import { describe, expect, it } from 'vitest';
import { adressProbleme, gatewayVorschlag, ipVorschlag } from '../model/adressen';
import type { NetzDatei } from '../model/datei';
import { ipZuZahl, zahlZuIp } from '../model/ip';
import { leitungAendern } from '../model/netz';
import { alsEintrag, automatischeRouten, routeFuer } from '../model/routing';
import { baueNetz, leitungZwischen, mitGeraet } from '../model/testnetze';
import { Simulation } from './simulation';

/**
 * Vermaschtes Netz: drei Router im Dreieck, an R1 hängt LAN A, an R3 hängt LAN B.
 *
 *   pcA — swA — R1 ——— R3 — swB — pcB
 *                 \\   /
 *                  R2
 */
function dreieck() {
  const { netz: roh, id } = baueNetz(
    {
      pcA: ['computer', '192.168.1.10'],
      swA: ['switch'],
      r1: ['router'],
      r2: ['router'],
      r3: ['router'],
      swB: ['switch'],
      pcB: ['computer', '192.168.2.10'],
    },
    [
      ['pcA', 'swA'],
      ['swA', 'r1'],
      ['r1', 'r2'],
      ['r2', 'r3'],
      ['r1', 'r3'],
      ['r3', 'swB'],
      ['pcB', 'swB'],
    ],
  );
  const l = (a: string, b: string) => leitungZwischen(roh, id(a), id(b));
  let netz = mitGeraet(roh, id('pcA'), { gateway: '192.168.1.1' });
  netz = mitGeraet(netz, id('pcB'), { gateway: '192.168.2.1' });
  netz = mitGeraet(netz, id('r1'), {
    anschluesse: {
      [l('swA', 'r1')]: { ip: '192.168.1.1' },
      [l('r1', 'r2')]: { ip: '10.0.12.1' },
      [l('r1', 'r3')]: { ip: '10.0.13.1' },
    },
  });
  netz = mitGeraet(netz, id('r2'), {
    anschluesse: { [l('r1', 'r2')]: { ip: '10.0.12.2' }, [l('r2', 'r3')]: { ip: '10.0.23.2' } },
  });
  netz = mitGeraet(netz, id('r3'), {
    anschluesse: {
      [l('r1', 'r3')]: { ip: '10.0.13.3' },
      [l('r2', 'r3')]: { ip: '10.0.23.3' },
      [l('r3', 'swB')]: { ip: '192.168.2.1' },
    },
  });
  return { netz, id, l };
}

function bisZumEnde(sim: Simulation) {
  for (let i = 0; i < 100 && sim.aktiv; i++) sim.schritt();
  expect(sim.aktiv).toBe(false);
}

const namen = (netz: NetzDatei) => (id: string) => netz.geraete.find((g) => g.id === id)?.name ?? id;

/** Welche Router hat die Nachricht (ohne Antwort) passiert? */
function routerWeg(sim: Simulation, netz: NetzDatei): string[] {
  return sim.protokoll
    .filter((e) => e.art === 'weitergeleitet' && e.paket.art === 'nachricht')
    .map((e) => namen(netz)(e.geraetId))
    .filter((n) => n.startsWith('r'));
}

describe('Automatische Routingtabelle', () => {
  it('kennt direkte Netze und wählt den kürzesten Weg', () => {
    const { netz, id, l } = dreieck();
    const routen = automatischeRouten(netz, id('r1'));
    const tabelle = Object.fromEntries(routen.map((r) => [`${zahlZuIp(r.ziel)}`, alsEintrag(r)]));
    expect(tabelle['192.168.1.0']).toMatchObject({ gateway: '', leitungId: l('swA', 'r1') });
    expect(tabelle['192.168.2.0']).toMatchObject({ gateway: '10.0.13.3', leitungId: l('r1', 'r3') });
    expect(tabelle['10.0.23.0']).toBeDefined();
    expect(routen.find((r) => zahlZuIp(r.ziel) === '192.168.2.0')?.metrik).toBe(1);
  });

  it('nimmt einen Umweg, wenn eine Leitung ausfällt', () => {
    const { netz, id, l } = dreieck();
    const gestoert = leitungAendern(netz, l('r1', 'r3'), { ausgefallen: true });
    const route = routeFuer(automatischeRouten(gestoert, id('r1')), ipZuZahl('192.168.2.10')!);
    expect(route).toMatchObject({ gateway: ipZuZahl('10.0.12.2'), leitungId: l('r1', 'r2'), metrik: 2 });
  });
});

describe('Routing in der Simulation', () => {
  it('schickt eine Nachricht über das Gateway in das andere Netz und zurück', () => {
    const { netz, id } = dreieck();
    const sim = new Simulation(netz);
    expect(sim.senden(id('pcA'), '192.168.2.10', 'Hallo')).toEqual({ ok: true });
    bisZumEnde(sim);
    expect(routerWeg(sim, netz)).toEqual(['r1', 'r3']);
    expect(sim.protokoll.filter((e) => e.art === 'empfangen').map((e) => namen(netz)(e.geraetId))).toEqual([
      'pcB',
      'pcA',
    ]);
  });

  it('protokolliert die genutzte Route', () => {
    const { netz, id } = dreieck();
    const sim = new Simulation(netz);
    sim.senden(id('pcA'), '192.168.2.10', 'x');
    bisZumEnde(sim);
    const r1 = sim.protokoll.find((e) => e.art === 'weitergeleitet' && e.geraetId === id('r1'));
    expect(r1).toMatchObject({
      route: { ziel: '192.168.2.0', subnetzmaske: '255.255.255.0', gateway: '10.0.13.3' },
    });
  });

  it('findet automatisch einen Umweg, wenn während des Laufs eine Leitung ausfällt', () => {
    const { netz, id, l } = dreieck();
    const sim = new Simulation(netz);
    sim.leitungAusfallen(l('r1', 'r3'), true);
    sim.senden(id('pcA'), '192.168.2.10', 'x');
    bisZumEnde(sim);
    expect(routerWeg(sim, netz)).toEqual(['r1', 'r2', 'r3']);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'empfangen', geraetId: id('pcA') });
  });

  it('manuelle Tabelle passt sich nicht an: Paket geht an der ausgefallenen Leitung verloren', () => {
    const basis = dreieck();
    const { id, l } = basis;
    const tabelle = automatischeRouten(basis.netz, id('r1')).map(alsEintrag);
    let netz = mitGeraet(basis.netz, id('r1'), { routing: { modus: 'manuell', tabelle } });
    netz = leitungAendern(netz, l('r1', 'r3'), { ausgefallen: true });
    const sim = new Simulation(netz);
    sim.senden(id('pcA'), '192.168.2.10', 'x');
    bisZumEnde(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({
      art: 'verworfen',
      grund: 'leitung-ausgefallen',
      geraetId: id('r1'),
    });
  });

  it('verwirft Pakete ohne passende Route', () => {
    const basis = dreieck();
    const netz = mitGeraet(basis.netz, basis.id('r1'), { routing: { modus: 'manuell', tabelle: [] } });
    const sim = new Simulation(netz);
    sim.senden(basis.id('pcA'), '192.168.2.10', 'x');
    bisZumEnde(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'verworfen', grund: 'keine-route' });
  });

  it('verwirft Pakete in einer Routing-Schleife, wenn die TTL abläuft', () => {
    const basis = dreieck();
    const { id, l } = basis;
    // R1 schickt 192.168.2.0 zu R2, R2 schickt es zurück zu R1 → Schleife
    let netz = mitGeraet(basis.netz, id('r1'), {
      routing: {
        modus: 'manuell',
        tabelle: [
          { ziel: '192.168.1.0', subnetzmaske: '255.255.255.0', gateway: '', leitungId: l('swA', 'r1') },
          {
            ziel: '192.168.2.0',
            subnetzmaske: '255.255.255.0',
            gateway: '10.0.12.2',
            leitungId: l('r1', 'r2'),
          },
        ],
      },
    });
    netz = mitGeraet(netz, id('r2'), {
      routing: {
        modus: 'manuell',
        tabelle: [
          {
            ziel: '192.168.2.0',
            subnetzmaske: '255.255.255.0',
            gateway: '10.0.12.1',
            leitungId: l('r1', 'r2'),
          },
        ],
      },
    });
    const sim = new Simulation(netz);
    sim.senden(id('pcA'), '192.168.2.10', 'x');
    bisZumEnde(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'verworfen', grund: 'ttl' });
  });

  it('ohne Gateway: verständlicher Sendefehler', () => {
    const basis = dreieck();
    const netz = mitGeraet(basis.netz, basis.id('pcA'), { gateway: '' });
    const sim = new Simulation(netz);
    expect(sim.senden(basis.id('pcA'), '192.168.2.10', 'x')).toMatchObject({
      ok: false,
      grund: 'anderes-netz',
    });
  });

  it('Gateway außerhalb des eigenen Netzes: verständlicher Sendefehler', () => {
    const basis = dreieck();
    const netz = mitGeraet(basis.netz, basis.id('pcA'), { gateway: '10.0.12.1' });
    const sim = new Simulation(netz);
    expect(sim.senden(basis.id('pcA'), '192.168.2.10', 'x')).toMatchObject({
      ok: false,
      grund: 'gateway-falsch',
    });
  });

  it('Router beantwortet Nachrichten an seine eigene Adresse', () => {
    const { netz, id } = dreieck();
    const sim = new Simulation(netz);
    sim.senden(id('pcA'), '10.0.23.3', 'Hallo Router');
    bisZumEnde(sim);
    expect(sim.protokoll.filter((e) => e.art === 'empfangen').map((e) => namen(netz)(e.geraetId))).toEqual([
      'r3',
      'pcA',
    ]);
  });
});

describe('Adressen mit Routern', () => {
  it('Vorschläge: Router-Anschluss .1, Gateway = Router im eigenen Netz', () => {
    const { netz, id, l } = dreieck();
    const ohne = mitGeraet(netz, id('r1'), { anschluesse: {} });
    expect(ipVorschlag(ohne, id('r1'), l('swA', 'r1'))).toBe('192.168.1.1');
    expect(gatewayVorschlag(netz, id('pcA'))).toBe('192.168.1.1');
  });

  it('erkennt doppelte Adressen zwischen Router-Anschluss und Endgerät', () => {
    const { netz, id } = dreieck();
    const doppelt = mitGeraet(netz, id('pcA'), { ip: '192.168.1.1' });
    const p = adressProbleme(doppelt);
    expect(p.get(id('pcA'))).toMatchObject([{ art: 'ip-doppelt' }]);
    expect(p.get(id('r1'))).toMatchObject([{ art: 'ip-doppelt' }]);
  });

  it('meldet ein Gateway außerhalb des eigenen Netzes', () => {
    const { netz, id } = dreieck();
    expect(adressProbleme(mitGeraet(netz, id('pcA'), { gateway: '10.0.12.1' })).get(id('pcA'))).toMatchObject(
      [{ art: 'gateway-anderes-netz' }],
    );
  });

  it('hat im korrekt eingerichteten Dreieck keine Adressprobleme', () => {
    expect(adressProbleme(dreieck().netz).size).toBe(0);
  });
});
