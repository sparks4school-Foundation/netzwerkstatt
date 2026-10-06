import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  useNodes,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import styles from './VerbindungKante.module.css';

export type VerbindungKanteDaten = { protokoll: string; versatz: number };
export type VerbindungKanteTyp = Edge<VerbindungKanteDaten, 'verbindung'>;

/**
 * Logische Verbindung zwischen Client und Dienst (Dienste-Ansicht). Bewusst anders als eine Leitung:
 * gebogen, lang gestrichelt, mit Pfeil und Protokollname – so unterscheidet man Leitung und Verbindung
 * (Glossar „Netz – Leitungen“) auch ohne Farbe.
 */
export function VerbindungKante({ id, source, target, data, markerEnd }: EdgeProps<VerbindungKanteTyp>) {
  // useNodes() sorgt fürs Neuzeichnen, wenn Geräte verschoben werden; die Maße kommen aus den internen Knoten.
  const knoten = useNodes();
  const { getInternalNode } = useReactFlow();
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  if (!a || !b || !data) return null;
  const mitte = (n: InternalNode) => ({
    x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
    y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
  });
  const p = mitte(a);
  const q = mitte(b);
  // Kontrollpunkt senkrecht zur Verbindungslinie verschieben → Bogen; mehrere Verbindungen fächern auf.
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const laenge = Math.hypot(dx, dy) || 1;
  const bogen = Math.max(70, laenge * 0.3) + data.versatz * 40;
  // Zur Seite ausweichen, auf der die Kurvenmitte weiter von anderen Geräten entfernt ist
  // (sonst verschwindet das Etikett z. B. unter einem Switch, der zwischen den beiden Geräten steht).
  const kontrollpunkt = (seite: number) => ({
    x: (p.x + q.x) / 2 - (dy / laenge) * bogen * seite,
    y: (p.y + q.y) / 2 + (dx / laenge) * bogen * seite,
  });
  const abstandZuGeraeten = (k: { x: number; y: number }) => {
    const kurvenmitte = { x: 0.25 * p.x + 0.5 * k.x + 0.25 * q.x, y: 0.25 * p.y + 0.5 * k.y + 0.25 * q.y };
    let min = Infinity;
    for (const { id: knotenId } of knoten) {
      const n = knotenId !== source && knotenId !== target ? getInternalNode(knotenId) : undefined;
      if (!n) continue;
      const m = mitte(n);
      min = Math.min(min, Math.hypot(m.x - kurvenmitte.x, m.y - kurvenmitte.y));
    }
    return min;
  };
  const links = kontrollpunkt(1);
  const rechts = kontrollpunkt(-1);
  const c = abstandZuGeraeten(rechts) > abstandZuGeraeten(links) ? rechts : links;
  // Linie am Geräterand enden lassen (nicht in der Mitte), damit der Pfeil sichtbar ist.
  const amRand = (n: InternalNode, mittelpunkt: { x: number; y: number }, von: { x: number; y: number }) => {
    const ux = von.x - mittelpunkt.x;
    const uy = von.y - mittelpunkt.y;
    const l = Math.hypot(ux, uy) || 1;
    const halbB = (n.measured.width ?? 0) / 2 + 6;
    const halbH = (n.measured.height ?? 0) / 2 + 6;
    const t = Math.min(halbB / (Math.abs(ux / l) || 1e-9), halbH / (Math.abs(uy / l) || 1e-9));
    return { x: mittelpunkt.x + (ux / l) * t, y: mittelpunkt.y + (uy / l) * t };
  };
  const start = amRand(a, p, c);
  const ende = amRand(b, q, c);
  const pfad = `M ${start.x},${start.y} Q ${c.x},${c.y} ${ende.x},${ende.y}`;
  const etikett = {
    x: 0.25 * start.x + 0.5 * c.x + 0.25 * ende.x,
    y: 0.25 * start.y + 0.5 * c.y + 0.25 * ende.y,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={pfad}
        markerEnd={markerEnd}
        className={styles.verbindung}
        interactionWidth={0}
      />
      <EdgeLabelRenderer>
        <div
          className={styles.etikett}
          style={{ transform: `translate(-50%, -50%) translate(${etikett.x}px, ${etikett.y}px)` }}
        >
          {data.protokoll}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
