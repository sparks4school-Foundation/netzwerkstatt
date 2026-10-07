import { useReactFlow, ViewportPortal } from '@xyflow/react';
import { paketKurzname } from '../content/meldungen';
import { texte } from '../content/texte';
import { istAnfrage } from '../sim/simulation';
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
        const antwort = !istAnfrage(u.paket);
        return (
          <button
            type="button"
            key={`${u.paket.id}-${u.start}`}
            // nopan/nodrag: Klick öffnet Details, statt die Ansicht zu verschieben
            className={`${styles.paket} nopan nodrag`}
            data-art={antwort ? 'antwort' : 'anfrage'}
            style={{
              transform: `translate(${a.x + (b.x - a.x) * p}px, ${a.y + (b.y - a.y) * p}px) translate(-50%, -50%)`,
            }}
            aria-label={texte.paketDetailsZu(paketKurzname(u.paket))}
            onClick={() => {
              const e = sim.protokoll.findLast(
                (x) =>
                  (x.art === 'gesendet' || x.art === 'weitergeleitet') &&
                  x.paket.id === u.paket.id &&
                  x.geraetId === u.vonId,
              );
              if (e) useSim.getState().zeigePaket(e.nr);
            }}
          >
            <span className={styles.symbol} aria-hidden="true">
              {antwort ? '↩' : '✉'}
            </span>
            {paketKurzname(u.paket)}
          </button>
        );
      })}
    </ViewportPortal>
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
