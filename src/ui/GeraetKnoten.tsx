import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { geraeteTexte } from '../content/geraete';
import { texte } from '../content/texte';
import type { GeraetTyp } from '../model/datei';
import { GeraetIcon } from './GeraetIcon';
import styles from './GeraetKnoten.module.css';

export type GeraetKnotenDaten = {
  typ: GeraetTyp;
  name: string;
  /** IP-Adresse wie eingegeben; `undefined` = Gerät hat keine (Switch, AP), '' = noch nicht vergeben. */
  ip?: string;
  /** Kurzbeschreibungen von Adressproblemen, z. B. „IP doppelt“. */
  probleme: string[];
  verbindbar: boolean;
};
export type GeraetKnotenTyp = Node<GeraetKnotenDaten, 'geraet'>;

/**
 * Darstellung eines Geräts im Netzplan. Name, Typ und IP-Adresse stehen als Text da.
 * Probleme: Warnsymbol + Text + gestrichelter Rahmen (nicht nur Farbe).
 */
export const GeraetKnoten = memo(function GeraetKnoten({ data, selected }: NodeProps<GeraetKnotenTyp>) {
  const problem = data.probleme.length > 0;
  return (
    <div
      className={styles.knoten}
      data-ausgewaehlt={selected || undefined}
      data-problem={problem || undefined}
    >
      <GeraetIcon typ={data.typ} groesse={36} />
      <span className={styles.name}>{data.name}</span>
      <span className={styles.typ}>{geraeteTexte[data.typ].name}</span>
      {data.ip !== undefined && (
        <span className={styles.ip} data-leer={!data.ip || undefined}>
          {data.ip || texte.keineIp}
        </span>
      )}
      {problem && (
        <span className={styles.problem}>
          <span aria-hidden="true">⚠ </span>
          {data.probleme.join(', ')}
        </span>
      )}
      {/* Der Anschluss muss immer existieren (Leitungen hängen daran), ist aber nur beim Aufbauen bedienbar. */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={data.verbindbar ? styles.anschluss : styles.versteckt}
        aria-label={data.verbindbar ? texte.anschlussPunkt(data.name) : undefined}
        aria-hidden={!data.verbindbar || undefined}
      />
    </div>
  );
});
