import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { geraeteTexte } from '../content/geraete';
import { texte } from '../content/texte';
import type { GeraetTyp } from '../model/datei';
import { GeraetIcon } from './GeraetIcon';
import styles from './GeraetKnoten.module.css';

export type GeraetKnotenDaten = { typ: GeraetTyp; name: string };
export type GeraetKnotenTyp = Node<GeraetKnotenDaten, 'geraet'>;

/**
 * Darstellung eines Geräts im Netzplan. Name UND Typ stehen als Text da (nicht nur das Icon).
 * Der runde Anschlusspunkt ist groß genug für Finger; Ziehen oder zweimal Tippen verbindet.
 */
export const GeraetKnoten = memo(function GeraetKnoten({ data, selected }: NodeProps<GeraetKnotenTyp>) {
  return (
    <div className={styles.knoten} data-ausgewaehlt={selected || undefined}>
      <GeraetIcon typ={data.typ} groesse={36} />
      <span className={styles.name}>{data.name}</span>
      <span className={styles.typ}>{geraeteTexte[data.typ].name}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className={styles.anschluss}
        aria-label={texte.anschlussPunkt(data.name)}
      />
    </div>
  );
});
