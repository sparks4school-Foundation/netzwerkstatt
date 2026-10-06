import { describe, expect, it } from 'vitest';
import { baueNetz } from '../model/testnetze';
import { Simulation, type ProtokollEintrag } from './simulation';

function bisZumEnde(sim: Simulation, max = 50) {
  for (let i = 0; i < max && sim.aktiv; i++) sim.schritt();
  expect(sim.aktiv).toBe(false);
}

/** Kurzform des Protokolls: „Gerät:art“ – macht Abläufe in Tests gut lesbar. */
function ablauf(sim: Simulation, name: (id: string) => string): string[] {
  return sim.protokoll.map((e: ProtokollEintrag) => `${name(e.geraetId)}:${e.art}`);
}

function namen(netz: { geraete: { id: string; name: string }[] }) {
  return (id: string) => netz.geraete.find((g) => g.id === id)?.name ?? id;
}

const lan = () =>
  baueNetz(
    {
      pc1: ['computer', '192.168.0.10'],
      pc2: ['computer', '192.168.0.11'],
      sw: ['switch'],
      ap: ['access-point'],
      handy: ['smartphone', '192.168.0.20'],
    },
    [
      ['pc1', 'sw'],
      ['pc2', 'sw'],
      ['ap', 'sw'],
      ['handy', 'ap', 'wlan'],
    ],
  );

describe('Simulation im lokalen Rechnernetz', () => {
  it('schickt eine Nachricht über den Switch und bekommt eine Antwort', () => {
    const { netz, id } = lan();
    const sim = new Simulation(netz);
    expect(sim.senden(id('pc1'), '192.168.0.11', 'Hallo')).toEqual({ ok: true });
    expect(sim.unterwegs).toHaveLength(1);
    bisZumEnde(sim);
    expect(ablauf(sim, namen(netz))).toEqual([
      'pc1:gesendet',
      'sw:weitergeleitet',
      'pc2:empfangen',
      'pc2:gesendet',
      'sw:weitergeleitet',
      'pc1:empfangen',
    ]);
    expect(sim.zeit).toBe(4);
  });

  it('erreicht ein Smartphone über Access Point und WLAN', () => {
    const { netz, id } = lan();
    const sim = new Simulation(netz);
    sim.senden(id('pc1'), '192.168.0.20', 'Hi');
    bisZumEnde(sim);
    expect(sim.protokoll.filter((e) => e.art === 'empfangen').map((e) => namen(netz)(e.geraetId))).toEqual([
      'handy',
      'pc1',
    ]);
  });

  it('zeigt Pakete schrittweise auf den Leitungen', () => {
    const { netz, id } = lan();
    const sim = new Simulation(netz);
    sim.senden(id('pc1'), '192.168.0.11', 'x');
    expect(sim.unterwegs.map((u) => [namen(netz)(u.vonId), namen(netz)(u.nachId)])).toEqual([['pc1', 'sw']]);
    sim.schritt();
    expect(sim.unterwegs.map((u) => [namen(netz)(u.vonId), namen(netz)(u.nachId)])).toEqual([['sw', 'pc2']]);
  });

  it('verwirft Nachrichten an unbekannte IP-Adressen am Switch', () => {
    const { netz, id } = lan();
    const sim = new Simulation(netz);
    sim.senden(id('pc1'), '192.168.0.99', 'x');
    bisZumEnde(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'verworfen', grund: 'kein-ziel', geraetId: id('sw') });
  });

  it('weist Sendefehler sofort zurück und protokolliert sie', () => {
    const { netz, id } = baueNetz(
      {
        a: ['computer', '192.168.0.10'],
        ohne: ['computer'],
        einsam: ['computer', '192.168.0.12'],
        s: ['switch'],
      },
      [
        ['a', 's'],
        ['ohne', 's'],
      ],
    );
    const sim = new Simulation(netz);
    expect(sim.senden(id('ohne'), '192.168.0.10', 'x')).toMatchObject({ ok: false, grund: 'keine-ip' });
    expect(sim.senden(id('a'), '192.168.0.300', 'x')).toMatchObject({ ok: false, grund: 'ziel-ungueltig' });
    expect(sim.senden(id('a'), '192.168.0.10', 'x')).toMatchObject({ ok: false, grund: 'eigene-ip' });
    expect(sim.senden(id('einsam'), '192.168.0.10', 'x')).toMatchObject({
      ok: false,
      grund: 'nicht-verbunden',
    });
    expect(sim.senden(id('a'), '10.0.0.1', 'x')).toMatchObject({
      ok: false,
      grund: 'anderes-netz',
      eigenesNetz: '192.168.0.x',
    });
    expect(sim.protokoll.every((e) => e.art === 'nicht-gesendet')).toBe(true);
    expect(sim.aktiv).toBe(false);
  });

  it('macht doppelte IP-Adressen sichtbar: Antwort landet beim falschen Gerät', () => {
    // pc1 und pc3 haben dieselbe Adresse; pc3 hängt näher am Switch des Servers.
    const { netz, id } = baueNetz(
      {
        pc1: ['computer', '192.168.0.10'],
        pc3: ['computer', '192.168.0.10'],
        server: ['server', '192.168.0.2'],
        sw1: ['switch'],
        sw2: ['switch'],
      },
      [
        ['pc1', 'sw1'],
        ['sw1', 'sw2'],
        ['server', 'sw2'],
        ['pc3', 'sw2'],
      ],
    );
    const sim = new Simulation(netz);
    sim.senden(id('pc1'), '192.168.0.2', 'Hallo');
    bisZumEnde(sim);
    const empfaenger = sim.protokoll.filter((e) => e.art === 'empfangen').map((e) => namen(netz)(e.geraetId));
    expect(empfaenger).toEqual(['server', 'pc3']);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'falscher-empfaenger', erwartetId: id('pc1') });
  });

  it('meldet beim Senden, wenn die Ziel-IP mehrfach vergeben ist', () => {
    const { netz, id } = baueNetz(
      {
        a: ['computer', '192.168.0.10'],
        b: ['computer', '192.168.0.20'],
        c: ['computer', '192.168.0.20'],
        s: ['switch'],
      },
      [
        ['a', 's'],
        ['b', 's'],
        ['c', 's'],
      ],
    );
    const sim = new Simulation(netz);
    sim.senden(id('a'), '192.168.0.20', 'x');
    expect(sim.protokoll[0]).toMatchObject({ art: 'ip-doppelt', geraeteIds: [id('b'), id('c')] });
  });

  it('verbindet zwei Computer auch direkt per Kabel', () => {
    const { netz, id } = baueNetz({ a: ['computer', '10.0.0.1'], b: ['computer', '10.0.0.2'] }, [['a', 'b']]);
    const sim = new Simulation(netz);
    sim.senden(id('a'), '10.0.0.2', 'x');
    bisZumEnde(sim);
    expect(ablauf(sim, namen(netz))).toEqual(['a:gesendet', 'b:empfangen', 'b:gesendet', 'a:empfangen']);
  });

  it('verwirft am Endgerät, wenn die Ziel-IP nicht passt', () => {
    const { netz, id } = baueNetz({ a: ['computer', '10.0.0.1'], b: ['computer', '10.0.0.2'] }, [['a', 'b']]);
    const sim = new Simulation(netz);
    sim.senden(id('a'), '10.0.0.3', 'x');
    bisZumEnde(sim);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'verworfen', grund: 'falsche-ip', geraetId: id('b') });
  });

  it('ist deterministisch', () => {
    const lauf = () => {
      const { netz, id } = lan();
      const sim = new Simulation(netz);
      sim.senden(id('pc1'), '192.168.0.20', 'a');
      sim.senden(id('pc2'), '192.168.0.10', 'b');
      bisZumEnde(sim);
      return JSON.stringify(sim.protokoll);
    };
    expect(lauf()).toBe(lauf());
  });
});
