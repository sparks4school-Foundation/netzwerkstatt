import { Background, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { texte } from '../content/texte';
import styles from './Arbeitsflaeche.module.css';

/** Netzplan-Arbeitsfläche. Phase 0: leere Fläche mit Zoom/Pan, damit Touch-Bedienung früh getestet werden kann. */
export function Arbeitsflaeche() {
  return (
    <main className={styles.flaeche} aria-label="Arbeitsfläche">
      <ReactFlow nodes={[]} edges={[]} fitView proOptions={{ hideAttribution: false }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <p className={styles.hinweis}>{texte.platzhalterArbeitsflaeche}</p>
    </main>
  );
}
