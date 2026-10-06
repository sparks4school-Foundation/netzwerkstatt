/**
 * Seed-basierter Zufallsgenerator (mulberry32).
 * Gleicher Seed = gleiche Zahlenfolge → Simulationen sind wiederholbar (siehe AGENTS.md 5.2).
 */
export function erzeugeZufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
