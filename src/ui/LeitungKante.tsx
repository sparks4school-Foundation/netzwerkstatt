import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps } from '@xyflow/react';
import { leitungsTexte } from '../content/geraete';
import { texte } from '../content/texte';
import type { LeitungsArt } from '../model/datei';
import styles from './LeitungKante.module.css';

export type LeitungKanteDaten = { art: LeitungsArt; gedimmt?: boolean; ausgefallen?: boolean };
export type LeitungKanteTyp = Edge<LeitungKanteDaten, 'leitung'>;

/**
 * Leitung als gerade Linie von Gerätemitte zu Gerätemitte (wie in einem Netzplan üblich).
 * Kabel: durchgezogen. WLAN: gepunktet + Beschriftung „WLAN“ – unterscheidbar ohne Farbe.
 */
export function LeitungKante({ id, source, target, data, selected }: EdgeProps<LeitungKanteTyp>) {
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  if (!a || !b || !data) return null;

  const mitte = (n: NonNullable<typeof a>) => ({
    x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
    y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
  });
  const p = mitte(a);
  const q = mitte(b);
  const pfad = `M ${p.x},${p.y} L ${q.x},${q.y}`;
  const wlan = data.art === 'wlan';

  return (
    <>
      <BaseEdge
        id={id}
        path={pfad}
        interactionWidth={28}
        className={styles.leitung}
        data-art={data.art}
        data-ausgewaehlt={selected || undefined}
        data-gedimmt={data.gedimmt || undefined}
        data-ausgefallen={data.ausgefallen || undefined}
      />
      {data.ausgefallen && (
        <EdgeLabelRenderer>
          <div
            className={styles.ausfall}
            style={{
              transform: `translate(-50%, -50%) translate(${(p.x + q.x) / 2}px, ${(p.y + q.y) / 2}px)`,
            }}
          >
            <span aria-hidden="true">✕ </span>
            {texte.ausgefallen}
          </div>
        </EdgeLabelRenderer>
      )}
      {wlan && !data.ausgefallen && (
        <EdgeLabelRenderer>
          <div
            className={styles.beschriftung}
            data-gedimmt={data.gedimmt || undefined}
            style={{
              transform: `translate(-50%, -50%) translate(${(p.x + q.x) / 2}px, ${(p.y + q.y) / 2}px)`,
            }}
          >
            {leitungsTexte.wlan.name}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
