import { describe, expect, it } from 'vitest';
import { Ereigniswarteschlange } from './ereignisse';
import { erzeugeZufall } from './zufall';

describe('Ereigniswarteschlange', () => {
  it('liefert Ereignisse nach Zeit und bei Gleichstand in Einfügereihenfolge', () => {
    const q = new Ereigniswarteschlange<string>();
    q.planen(5, 'c');
    q.planen(1, 'a');
    q.planen(5, 'd');
    q.planen(1, 'b');
    const reihenfolge: string[] = [];
    for (let e = q.naechstes(); e; e = q.naechstes()) reihenfolge.push(e.daten);
    expect(reihenfolge).toEqual(['a', 'b', 'c', 'd']);
    expect(q.zeit).toBe(5);
  });

  it('plant relativ zur aktuellen Zeit', () => {
    const q = new Ereigniswarteschlange<string>();
    q.planen(3, 'erst');
    q.naechstes();
    q.planen(2, 'dann');
    expect(q.naechstes()?.zeit).toBe(5);
  });
});

describe('Zufall', () => {
  it('ist bei gleichem Seed wiederholbar', () => {
    const a = erzeugeZufall(42);
    const b = erzeugeZufall(42);
    const folgeA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(folgeA);
    expect(folgeA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
