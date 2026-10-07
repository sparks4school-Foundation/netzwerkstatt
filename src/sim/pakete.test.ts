import { describe, expect, it } from 'vitest';
import type { NetzDatei } from '../model/datei';
import { ipZuZahl } from '../model/ip';
import { leitungAendern } from '../model/netz';
import { gleichGuteRouten } from '../model/routing';
import { baueNetz, leitungZwischen, mitGeraet } from '../model/testnetze';
import { sequenzdiagramm } from './sequenz';
import { Simulation, type SimOptionen } from './simulation';

/**
 * Vier Router im Quadrat – zwei gleich lange Wege von A nach B:
 *
 *   pcA — r1 —— r2 —— r4 — pcB
 *          \\          /
 *           —— r3 ———     (r1–r3 ist eine lange Leitung: 3 Schritte)
 */
function quadrat() {
  const { netz: roh, id } = baueNetz(
    {
      pcA: ['computer', '192.168.1.10'],
      r1: ['router'],
      r2: ['router'],
      r3: ['router'],
      r4: ['router'],
      pcB: ['computer', '192.168.2.10'],
    },
    [
      ['pcA', 'r1'],
      ['r1', 'r2'],
      ['r1', 'r3'],
      ['r2', 'r4'],
      ['r3', 'r4'],
      ['r4', 'pcB'],
    ],
  );
  const l = (a: string, b: string) => leitungZwischen(roh, id(a), id(b));
  let netz = mitGeraet(roh, id('pcA'), { gateway: '192.168.1.1' });
  netz = mitGeraet(netz, id('pcB'), { gateway: '192.168.2.1' });
  netz = mitGeraet(netz, id('r1'), {
    anschluesse: {
      [l('pcA', 'r1')]: { ip: '192.168.1.1' },
      [l('r1', 'r2')]: { ip: '10.0.12.1' },
      [l('r1', 'r3')]: { ip: '10.0.13.1' },
    },
  });
  netz = mitGeraet(netz, id('r2'), {
    anschluesse: { [l('r1', 'r2')]: { ip: '10.0.12.2' }, [l('r2', 'r4')]: { ip: '10.0.24.2' } },
  });
  netz = mitGeraet(netz, id('r3'), {
    anschluesse: { [l('r1', 'r3')]: { ip: '10.0.13.3' }, [l('r3', 'r4')]: { ip: '10.0.34.3' } },
  });
  netz = mitGeraet(netz, id('r4'), {
    anschluesse: {
      [l('r2', 'r4')]: { ip: '10.0.24.4' },
      [l('r3', 'r4')]: { ip: '10.0.34.4' },
      [l('r4', 'pcB')]: { ip: '192.168.2.1' },
    },
  });
  netz = leitungAendern(netz, l('r1', 'r3'), { verzoegerung: 3 });
  return { netz, id, l };
}

function lauf(netz: NetzDatei, optionen: Partial<SimOptionen>, start: (s: Simulation) => void) {
  const sim = new Simulation(netz, optionen);
  start(sim);
  for (let i = 0; i < 300 && sim.aktiv; i++) sim.schritt();
  expect(sim.aktiv).toBe(false);
  return sim;
}

describe('Mehrwege-Routing', () => {
  it('kennt beide gleich langen Wege', () => {
    const { netz, id } = quadrat();
    const wege = gleichGuteRouten(netz, id('r1'), ipZuZahl('192.168.2.10')!);
    expect(wege.map((r) => r.gateway)).toEqual([ipZuZahl('10.0.12.2'), ipZuZahl('10.0.13.3')]);
  });
});

describe('Paketorientierte Datenübertragung (TK 4)', () => {
  it('zerlegt, schickt nacheinander und setzt beim Empfänger wieder zusammen', () => {
    const { netz, id } = quadrat();
    const sim = lauf(netz, {}, (s) => {
      expect(s.inPaketenSenden(id('pcA'), '192.168.2.10', 'Hallo Welt!', 4)).toMatchObject({
        ok: true,
        anzahl: 3,
      });
    });
    const [puffer] = sim.empfangspuffer(id('pcB'));
    expect(puffer).toMatchObject({
      anzahl: 3,
      teile: ['Hall', 'o We', 'lt!'],
      ankunft: [1, 2, 3],
      text: 'Hallo Welt!',
    });
    expect(sim.protokoll.find((e) => e.art === 'zusammengesetzt')).toMatchObject({ inReihenfolge: true });
    expect(sim.sendungenVon(id('pcA'))[0]!.bestaetigt.sort()).toEqual([1, 2, 3]);
  });

  it('verschiedene Wege + lange Leitung: Teile kommen durcheinander an und werden richtig einsortiert', () => {
    const { netz, id } = quadrat();
    const sim = lauf(netz, { mehrwege: true }, (s) =>
      s.inPaketenSenden(id('pcA'), '192.168.2.10', 'ABCDEF', 1),
    );
    const [puffer] = sim.empfangspuffer(id('pcB'));
    expect(puffer!.text).toBe('ABCDEF');
    expect(puffer!.ankunft).not.toEqual([1, 2, 3, 4, 5, 6]);
    expect(sim.protokoll.find((e) => e.art === 'zusammengesetzt')).toMatchObject({ inReihenfolge: false });
    // Beide Wege wurden benutzt
    const ueberR2 = sim.protokoll.some((e) => e.art === 'weitergeleitet' && e.geraetId === id('r2'));
    const ueberR3 = sim.protokoll.some((e) => e.art === 'weitergeleitet' && e.geraetId === id('r3'));
    expect(ueberR2 && ueberR3).toBe(true);
  });

  it('lange Leitung braucht mehrere Schritte', () => {
    const { netz, id, l } = quadrat();
    const sim = new Simulation(netz, { mehrwege: true });
    sim.inPaketenSenden(id('pcA'), '192.168.2.10', 'AB', 1);
    for (let i = 0; i < 3; i++) sim.schritt();
    const lang = sim.unterwegs.find((u) => u.leitungId === l('r1', 'r3'));
    expect(lang && lang.ende - lang.start).toBe(3);
  });

  it('Verlust auf gestörter Leitung: fehlende Teile werden erneut gesendet', () => {
    const basis = quadrat();
    const netz = leitungAendern(basis.netz, basis.l('r4', 'pcB'), { verlust: 40 });
    const sim = lauf(netz, { startwert: 7 }, (s) =>
      s.inPaketenSenden(basis.id('pcA'), '192.168.2.10', 'Paketvermittlung', 2),
    );
    expect(sim.protokoll.some((e) => e.art === 'verworfen' && e.grund === 'stoerung')).toBe(true);
    expect(sim.protokoll.some((e) => e.art === 'erneut-gesendet')).toBe(true);
    expect(sim.empfangspuffer(basis.id('pcB'))[0]!.text).toBe('Paketvermittlung');
  });

  it('ohne Bestätigungen bleiben verlorene Teile Lücken', () => {
    const basis = quadrat();
    const netz = leitungAendern(basis.netz, basis.l('r4', 'pcB'), { verlust: 40 });
    const sim = lauf(netz, { startwert: 7, bestaetigen: false }, (s) =>
      s.inPaketenSenden(basis.id('pcA'), '192.168.2.10', 'Paketvermittlung', 2),
    );
    const [puffer] = sim.empfangspuffer(basis.id('pcB'));
    expect(puffer!.text).toBeNull();
    expect(puffer!.teile.some((t) => t === null)).toBe(true);
    expect(sim.protokoll.some((e) => e.art === 'erneut-gesendet')).toBe(false);
  });

  it('gibt nach mehreren Versuchen auf, wenn eine Leitung alles verliert', () => {
    const basis = quadrat();
    const netz = leitungAendern(basis.netz, basis.l('r4', 'pcB'), { verlust: 100 });
    const sim = lauf(netz, {}, (s) => s.inPaketenSenden(basis.id('pcA'), '192.168.2.10', 'AB', 1));
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'aufgegeben' });
  });

  it('gleicher Startwert = gleicher Ablauf (wiederholbar)', () => {
    const basis = quadrat();
    const netz = leitungAendern(basis.netz, basis.l('r4', 'pcB'), { verlust: 30 });
    const ablauf = () =>
      JSON.stringify(
        lauf(netz, { startwert: 3, mehrwege: true }, (s) =>
          s.inPaketenSenden(basis.id('pcA'), '192.168.2.10', 'abcdefgh', 1),
        ).protokoll,
      );
    expect(ablauf()).toBe(ablauf());
  });

  it('Sequenzdiagramm zeigt Teile und Bestätigungen', () => {
    const { netz, id } = quadrat();
    const sim = lauf(netz, {}, (s) => s.inPaketenSenden(id('pcA'), '192.168.2.10', 'abc', 1));
    const arten = sequenzdiagramm(sim.protokoll, false).pfeile.map((p) => p.paket.art);
    expect(arten.filter((a) => a === 'teil')).toHaveLength(3);
    expect(arten.filter((a) => a === 'bestaetigung')).toHaveLength(3);
  });
});
