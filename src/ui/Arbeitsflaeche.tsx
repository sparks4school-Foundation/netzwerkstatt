import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';
import { netzplanAriaTexte, texte } from '../content/texte';
import { geraetTypSchema } from '../model/datei';
import { GERAET_BREITE, GERAET_HOEHE } from '../model/netz';
import { GeraetKnoten, type GeraetKnotenTyp } from './GeraetKnoten';
import { LeitungKante, type LeitungKanteTyp } from './LeitungKante';
import { useApp } from './store';
import styles from './Arbeitsflaeche.module.css';

export const DRAG_TYP = 'application/x-netzwerkstatt-geraet';

const nodeTypes = { geraet: GeraetKnoten };
const edgeTypes = { leitung: LeitungKante };

/**
 * Netzplan. Die Wahrheit liegt im Store (Datenmodell); React Flow bekommt daraus abgeleitete
 * Knoten/Kanten und meldet Änderungen zurück („controlled flow“).
 */
export function Arbeitsflaeche() {
  const netz = useApp((z) => z.netz);
  const auswahl = useApp((z) => z.auswahl);
  const bearbeitbar = useApp((z) => z.modus === 'aufbauen');
  const { verschieben, merkeZustand, waehle, verbinde, geraetHinzufuegen } = useApp.getState();
  const { screenToFlowPosition, flowToScreenPosition, setCenter, getZoom } = useReactFlow();
  const ziehtGerade = useRef(false);
  const flaecheRef = useRef<HTMLElement>(null);
  const anzahlVorher = useRef(netz.geraete.length);

  // Neues Gerät außerhalb des sichtbaren Bereichs (Mitte war belegt, Panel hat die Fläche verkleinert)?
  // Dann dorthin schwenken. Läuft nach dem Rendern, wenn das Eigenschaften-Panel schon Platz einnimmt.
  useEffect(() => {
    const neuHinzugefuegt = netz.geraete.length > anzahlVorher.current;
    anzahlVorher.current = netz.geraete.length;
    if (!neuHinzugefuegt || auswahl?.art !== 'geraet' || !flaecheRef.current) return;
    const g = netz.geraete.find((x) => x.id === auswahl.id);
    if (!g) return;
    const rahmen = flaecheRef.current.getBoundingClientRect();
    // Ein Eigenschaften-Blatt von unten verdeckt den unteren Teil der Fläche.
    const blatt = document.querySelector('aside[aria-labelledby="eigenschaften-titel"]');
    const unten =
      blatt && getComputedStyle(blatt).position === 'fixed'
        ? Math.min(rahmen.bottom, blatt.getBoundingClientRect().top)
        : rahmen.bottom;
    const lo = flowToScreenPosition(g.position);
    const ru = flowToScreenPosition({ x: g.position.x + GERAET_BREITE, y: g.position.y + GERAET_HOEHE });
    if (lo.x < rahmen.left || lo.y < rahmen.top || ru.x > rahmen.right || ru.y > unten) {
      // Mittelpunkt so wählen, dass das Gerät in der Mitte des freien (nicht verdeckten) Bereichs liegt.
      const zoom = getZoom();
      const versatzY = (rahmen.bottom - unten) / 2 / zoom;
      void setCenter(g.position.x + GERAET_BREITE / 2, g.position.y + GERAET_HOEHE / 2 + versatzY, {
        zoom,
        duration: 250,
      });
    }
  }, [netz.geraete, auswahl, flowToScreenPosition, setCenter, getZoom]);

  const nodes = useMemo<GeraetKnotenTyp[]>(
    () =>
      netz.geraete.map((g) => ({
        id: g.id,
        type: 'geraet',
        position: g.position,
        data: { typ: g.typ, name: g.name },
        selected: auswahl?.art === 'geraet' && auswahl.id === g.id,
        ariaLabel: g.name,
      })),
    [netz.geraete, auswahl],
  );

  const edges = useMemo<LeitungKanteTyp[]>(
    () =>
      netz.leitungen.map((l) => ({
        id: l.id,
        type: 'leitung',
        source: l.von,
        target: l.nach,
        data: { art: l.art },
        selected: auswahl?.art === 'leitung' && auswahl.id === l.id,
        ariaLabel: `${l.art === 'wlan' ? 'WLAN' : 'Kabel'}: ${
          netz.geraete.find((g) => g.id === l.von)?.name
        } – ${netz.geraete.find((g) => g.id === l.nach)?.name}`,
      })),
    [netz.leitungen, netz.geraete, auswahl],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<GeraetKnotenTyp>[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          // Verschieben per Pfeiltaste (kein Ziehen) bekommt einen eigenen Rückgängig-Schritt.
          if (!ziehtGerade.current && !c.dragging) merkeZustand();
          verschieben(c.id, c.position);
        } else if (c.type === 'select') {
          if (c.selected) waehle({ art: 'geraet', id: c.id });
          else if (useApp.getState().auswahl?.id === c.id) waehle(null);
        }
      }
    },
    [verschieben, merkeZustand, waehle],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<LeitungKanteTyp>[]) => {
      for (const c of changes) {
        if (c.type !== 'select') continue;
        if (c.selected) waehle({ art: 'leitung', id: c.id });
        else if (useApp.getState().auswahl?.id === c.id) waehle(null);
      }
    },
    [waehle],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      const typ = geraetTypSchema.safeParse(e.dataTransfer.getData(DRAG_TYP));
      if (!typ.success) return;
      e.preventDefault();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      geraetHinzufuegen(typ.data, { x: p.x - GERAET_BREITE / 2, y: p.y - GERAET_HOEHE / 2 });
    },
    [screenToFlowPosition, geraetHinzufuegen],
  );

  return (
    <main ref={flaecheRef} className={styles.flaeche} aria-label={texte.arbeitsflaeche}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={() => {
          ziehtGerade.current = true;
          merkeZustand();
        }}
        onNodeDragStop={() => {
          ziehtGerade.current = false;
        }}
        onConnect={(c) => verbinde(c.source, c.target)}
        onConnectEnd={(e, zustand) => {
          // Losgelassen auf dem Gerät statt genau auf dessen Anschlusspunkt? Dann trotzdem verbinden.
          if (zustand.isValid || !zustand.fromNode) return;
          const punkt = 'changedTouches' in e ? e.changedTouches[0] : e;
          if (!punkt) return;
          const ziel = document
            .elementFromPoint(punkt.clientX, punkt.clientY)
            ?.closest<HTMLElement>('.react-flow__node')?.dataset.id;
          if (ziel && ziel !== zustand.fromNode.id) verbinde(zustand.fromNode.id, ziel);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_TYP)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={onDrop}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={36}
        nodesDraggable={bearbeitbar}
        nodesConnectable={bearbeitbar}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        minZoom={0.3}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ maxZoom: 1.2 }}
        ariaLabelConfig={netzplanAriaTexte}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {netz.geraete.length === 0 && <p className={styles.hinweis}>{texte.leereArbeitsflaeche}</p>}
    </main>
  );
}
