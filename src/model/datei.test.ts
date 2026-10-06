import { describe, expect, it } from 'vitest';
import { ladeNetz, leeresNetz, speichereNetz } from './datei';

describe('Dateiformat', () => {
  it('speichert und lädt ein Netz verlustfrei', () => {
    const netz = {
      ...leeresNetz('7-8'),
      geraete: [{ id: 'pc1', typ: 'computer' as const, name: 'PC 1', position: { x: 0, y: 0 } }],
    };
    expect(ladeNetz(speichereNetz(netz))).toEqual({ ok: true, netz });
  });

  it('meldet kaputtes JSON verständlich', () => {
    const ergebnis = ladeNetz('{kaputt');
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.meldung).toMatch(/keine gültige/);
  });

  it('erkennt fremde Dateien', () => {
    expect(ladeNetz('{"format":"filius"}')).toMatchObject({ ok: false });
  });

  it('erkennt Dateien aus neueren Versionen', () => {
    const ergebnis = ladeNetz(JSON.stringify({ ...leeresNetz('11'), version: 999 }));
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.meldung).toMatch(/neueren Version/);
  });
});
