import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng } from 'html-to-image';

/**
 * Netzplan als PNG speichern (Unplugged-Phasen, Arbeitsblätter). Rendert nur das Netz selbst –
 * ohne Bedienelemente –, passend eingepasst. Läuft komplett im Browser, nichts verlässt das Gerät.
 */
export async function netzplanAlsPng(nodes: Node[], dateiname: string): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || nodes.length === 0) return;
  const breite = 1600;
  const hoehe = 1000;
  const rahmen = getNodesBounds(nodes);
  const ansicht = getViewportForBounds(rahmen, breite, hoehe, 0.2, 2, 0.08);
  const hintergrund = getComputedStyle(document.body).backgroundColor || '#ffffff';
  const url = await toPng(viewport, {
    backgroundColor: hintergrund,
    width: breite,
    height: hoehe,
    style: {
      width: `${breite}px`,
      height: `${hoehe}px`,
      transform: `translate(${ansicht.x}px, ${ansicht.y}px) scale(${ansicht.zoom})`,
    },
  });
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
}
