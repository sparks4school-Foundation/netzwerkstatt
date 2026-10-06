import { describe, expect, it } from 'vitest';
import { leeresNetz, type GeraetTyp, type NetzDatei } from './datei';
import { freiePosition, geraetEntfernen, geraetHinzufuegen, naechsteId, verbinden } from './netz';

function netzMit(...typen: GeraetTyp[]): NetzDatei {
  let netz = leeresNetz('7-8');
  for (const typ of typen) netz = geraetHinzufuegen(netz, typ, typ, { x: 0, y: 0 }).netz;
  return netz;
}

function verbinde(netz: NetzDatei, von: string, nach: string, art: 'kabel' | 'wlan' = 'kabel'): NetzDatei {
  const r = verbinden(netz, von, nach, art);
  if (!r.ok) throw new Error(r.grund);
  return r.netz;
}

describe('IDs', () => {
  it('vergibt lesbare, fortlaufende IDs ohne Lücken zu füllen', () => {
    expect(naechsteId([], 'g')).toBe('g1');
    expect(naechsteId([{ id: 'g1' }, { id: 'g7' }, { id: 'l3' }], 'g')).toBe('g8');
  });
});

describe('Kabel', () => {
  it('verbindet Computer und Switch', () => {
    const netz = verbinde(netzMit('computer', 'switch'), 'g1', 'g2');
    expect(netz.leitungen).toEqual([{ id: 'l1', art: 'kabel', von: 'g1', nach: 'g2' }]);
  });

  it('erlaubt einem Switch beliebig viele Kabel', () => {
    let netz = netzMit('switch', 'computer', 'computer', 'server');
    for (const id of ['g2', 'g3', 'g4']) netz = verbinde(netz, 'g1', id);
    expect(netz.leitungen).toHaveLength(3);
  });

  it('lehnt ein zweites Kabel am Computer ab', () => {
    const netz = verbinde(netzMit('computer', 'switch', 'switch'), 'g1', 'g2');
    expect(verbinden(netz, 'g1', 'g3', 'kabel')).toMatchObject({ ok: false, grund: 'anschluss-belegt' });
  });

  it('lehnt Kabel am Smartphone ab', () => {
    expect(verbinden(netzMit('smartphone', 'switch'), 'g1', 'g2', 'kabel')).toMatchObject({
      ok: false,
      grund: 'kein-kabelanschluss',
    });
  });

  it('lehnt doppelte Verbindungen und Selbstverbindungen ab', () => {
    const netz = verbinde(netzMit('switch', 'router'), 'g1', 'g2');
    expect(verbinden(netz, 'g2', 'g1', 'kabel')).toMatchObject({ ok: false, grund: 'schon-verbunden' });
    expect(verbinden(netz, 'g1', 'g1', 'kabel')).toMatchObject({ ok: false, grund: 'selbst' });
  });

  it('erlaubt dem Access Point genau ein Kabel', () => {
    const netz = verbinde(netzMit('access-point', 'switch', 'router'), 'g1', 'g2');
    expect(verbinden(netz, 'g1', 'g3', 'kabel')).toMatchObject({ ok: false, grund: 'anschluss-belegt' });
  });
});

describe('WLAN', () => {
  it('verbindet mehrere Smartphones mit einem Access Point', () => {
    let netz = netzMit('access-point', 'smartphone', 'smartphone', 'spielkonsole');
    for (const id of ['g2', 'g3', 'g4']) netz = verbinde(netz, id, 'g1', 'wlan');
    expect(netz.leitungen.every((l) => l.art === 'wlan')).toBe(true);
  });

  it('geht nur mit einem Access Point', () => {
    expect(verbinden(netzMit('smartphone', 'switch'), 'g1', 'g2', 'wlan')).toMatchObject({
      ok: false,
      grund: 'wlan-nur-mit-access-point',
    });
  });

  it('lehnt WLAN am Server ab', () => {
    expect(verbinden(netzMit('server', 'access-point'), 'g1', 'g2', 'wlan')).toMatchObject({
      ok: false,
      grund: 'kein-wlan',
    });
  });

  it('erlaubt einem Computer nur einen Anschluss insgesamt', () => {
    const netz = verbinde(netzMit('computer', 'switch', 'access-point'), 'g1', 'g2');
    expect(verbinden(netz, 'g1', 'g3', 'wlan')).toMatchObject({ ok: false, grund: 'anschluss-belegt' });
  });
});

describe('Entfernen', () => {
  it('entfernt ein Gerät samt seinen Leitungen', () => {
    let netz = netzMit('switch', 'computer', 'computer');
    netz = verbinde(verbinde(netz, 'g1', 'g2'), 'g1', 'g3');
    netz = geraetEntfernen(netz, 'g1');
    expect(netz.geraete.map((g) => g.id)).toEqual(['g2', 'g3']);
    expect(netz.leitungen).toEqual([]);
  });
});

describe('freiePosition', () => {
  it('nimmt die Wunschposition, wenn sie frei ist', () => {
    expect(freiePosition(leeresNetz('7-8'), { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });

  it('weicht aus, wenn dort schon ein Gerät liegt', () => {
    const netz = geraetHinzufuegen(leeresNetz('7-8'), 'computer', 'PC', { x: 0, y: 0 }).netz;
    const p = freiePosition(netz, { x: 10, y: 10 });
    expect(p).not.toEqual({ x: 10, y: 10 });
    expect(
      freiePosition(
        { ...netz, geraete: [...netz.geraete, { ...netz.geraete[0]!, id: 'x', position: p }] },
        p,
      ),
    ).not.toEqual(p);
  });
});
