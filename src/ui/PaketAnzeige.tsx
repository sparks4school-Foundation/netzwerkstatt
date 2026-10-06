import { useReactFlow, ViewportPortal } from '@xyflow/react';
import { texte } from '../content/texte';
import { useSim } from './simStore';
import styles from './PaketAnzeige.module.css';

const bewegungReduziert =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Zeichnet die Pakete, die gerade unterwegs sind, als Objekte auf den Leitungen. */
export function PaketAnzeige() {
  const sim = useSim((z) => z.sim);
  useSim((z) => z.version);
  const fortschritt = useSim((z) => z.fortschritt);
  const { getInternalNode } = useReactFlow();
  if (!sim) return null;

  const mitte = (id: string) => {
    const n = getInternalNode(id);
    if (!n) return null;
    return {
      x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
      y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
    };
  };
  // Bei reduzierter Bewegung steht das Paket ruhig in der Mitte der Leitung.
  const p = bewegungReduziert ? 0.5 : easeInOut(fortschritt);

  return (
    <ViewportPortal>
      {sim.unterwegs.map((u) => {
        const a = mitte(u.vonId);
        const b = mitte(u.nachId);
        if (!a || !b) return null;
        const antwort = u.paket.art === 'antwort';
        return (
          <div
            key={`${u.paket.id}-${u.start}`}
            className={styles.paket}
            data-art={u.paket.art}
            style={{
              transform: `translate(${a.x + (b.x - a.x) * p}px, ${a.y + (b.y - a.y) * p}px) translate(-50%, -50%)`,
            }}
            aria-hidden="true"
          >
            <span className={styles.symbol}>{antwort ? '↩' : '✉'}</span>
            {antwort ? texte.paketAntwort : texte.paketNachricht}
          </div>
        );
      })}
    </ViewportPortal>
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
