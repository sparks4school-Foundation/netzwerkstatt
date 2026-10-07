import {
  Background,
  ConnectionMode,
  MarkerType,
  Controls,
  ReactFlow,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';
import { adressProblemKurz } from '../content/meldungen';
import { netzplanAriaTexte, texte } from '../content/texte';
import { adressProbleme, hatIpAdresse } from '../model/adressen';
import { geraetTypSchema } from '../model/datei';
import { stufenKonfiguration } from '../stufen';
import { GERAET_BREITE, GERAET_HOEHE } from '../model/netz';
import { GeraetKnoten, type GeraetKnotenTyp } from './GeraetKnoten';
import { BrowserFenster } from './BrowserFenster';
import { LeitungKante, type LeitungKanteTyp } from './LeitungKante';
import { PaketAnzeige } from './PaketAnzeige';
import { logischeVerbindungen } from './logischeVerbindungen';
import { useSim } from './simStore';
import { Simulationsleiste } from './Simulationsleiste';
import { VerbindungKante, type VerbindungKanteTyp } from './VerbindungKante';
import { useApp } from './store';
import styles from './Arbeitsflaeche.module.css';

export const DRAG_TYP = 'application/x-netzwerkstatt-geraet';

const nodeTypes = { geraet: GeraetKnoten };
const edgeTypes = { leitung: LeitungKante, verbindung: VerbindungKante };

/**
 * Netzplan. Die Wahrheit liegt im Store (Datenmodell); React Flow bekommt daraus abgeleitete
 * Knoten/Kanten und meldet Änderungen zurück („controlled flow“).
 */
export function Arbeitsflaeche() {
  const netz = useApp((z) => z.netz);
  const auswahl = useApp((z) => z.auswahl);
  const bearbeitbar = useApp((z) => z.modus === 'aufbauen');
  const dienstAnsicht = useApp((z) => z.ansicht === 'dienste');
  const zeigeRouter = useApp((z) => stufenKonfiguration[z.netz.stufe].zeigeRoutingtabelle);
  const sim = useSim((z) => z.sim);
  const simVersion = useSim((z) => z.version);
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
    // Ein Eigenschaften-Blatt über der Fläche verdeckt rechts (Tablet) oder unten (Smartphone) einen Teil.
    let { right: rechts, bottom: unten } = rahmen;
    const blatt = document.querySelector('aside[aria-labelledby="eigenschaften-titel"]');
    if (blatt && getComputedStyle(blatt).position === 'absolute') {
      const b = blatt.getBoundingClientRect();
      if (b.top <= rahmen.top + 16) rechts = Math.min(rechts, b.left);
      else unten = Math.min(unten, b.top);
    }
    const lo = flowToScreenPosition(g.position);
    const ru = flowToScreenPosition({ x: g.position.x + GERAET_BREITE, y: g.position.y + GERAET_HOEHE });
    if (lo.x < rahmen.left || lo.y < rahmen.top || ru.x > rechts || ru.y > unten) {
      // Mittelpunkt so wählen, dass das Gerät in der Mitte des freien (nicht verdeckten) Bereichs liegt.
      const zoom = getZoom();
      const versatzX = (rahmen.right - rechts) / 2 / zoom;
      const versatzY = (rahmen.bottom - unten) / 2 / zoom;
      void setCenter(
        g.position.x + GERAET_BREITE / 2 + versatzX,
        g.position.y + GERAET_HOEHE / 2 + versatzY,
        {
          zoom,
          duration: 250,
        },
      );
    }
  }, [netz.geraete, auswahl, flowToScreenPosition, setCenter, getZoom]);

  const probleme = useMemo(() => adressProbleme(netz), [netz]);

  const nodes = useMemo<GeraetKnotenTyp[]>(
    () =>
      netz.geraete.map((g) => {
        const kurz = (probleme.get(g.id) ?? []).map(adressProblemKurz);
        const ip = hatIpAdresse(g) ? (g.ip ?? '') : undefined;
        // Router (Klasse 11): Adressen der Anschlüsse anzeigen
        const routerIps =
          g.typ === 'router' && zeigeRouter
            ? Object.values(g.anschluesse ?? {})
                .map((a) => a.ip)
                .filter(Boolean)
            : undefined;
        return {
          id: g.id,
          type: 'geraet',
          position: g.position,
          data: {
            typ: g.typ,
            name: g.name,
            ip,
            routerIps,
            probleme: kurz,
            verbindbar: bearbeitbar,
            dienste: dienstAnsicht ? (g.dienste ?? []).map((d) => d.art) : undefined,
          },
          selected: auswahl?.art === 'geraet' && auswahl.id === g.id,
          ariaLabel: [g.name, ip && `IP-Adresse ${ip}`, ...kurz].filter(Boolean).join(', '),
        };
      }),
    [netz.geraete, auswahl, probleme, bearbeitbar, dienstAnsicht, zeigeRouter],
  );

  const edges = useMemo<(LeitungKanteTyp | VerbindungKanteTyp)[]>(() => {
    const leitungen: LeitungKanteTyp[] = netz.leitungen.map((l) => ({
      id: l.id,
      type: 'leitung',
      source: l.von,
      target: l.nach,
      data: {
        art: l.art,
        gedimmt: dienstAnsicht,
        ausgefallen: !!l.ausgefallen,
        verlust: l.verlust || undefined,
        verzoegerung: l.verzoegerung && l.verzoegerung > 1 ? l.verzoegerung : undefined,
      },
      selected: auswahl?.art === 'leitung' && auswahl.id === l.id,
      ariaLabel: `${l.ausgefallen ? `${texte.ausgefallen}: ` : ''}${l.art === 'wlan' ? 'WLAN' : 'Kabel'}: ${
        netz.geraete.find((g) => g.id === l.von)?.name
      } – ${netz.geraete.find((g) => g.id === l.nach)?.name}`,
    }));
    if (!dienstAnsicht) return leitungen;

    // Dienste-Ansicht: logische Verbindungen aus der Konfiguration (DNS-Server) und der Simulation.
    void simVersion;
    const zaehler = new Map<string, number>();
    const verbindungen: VerbindungKanteTyp[] = logischeVerbindungen(netz, sim).map((v) => {
      const paar = [v.clientId, v.serverId].sort().join('|');
      const versatz = zaehler.get(paar) ?? 0;
      zaehler.set(paar, versatz + 1);
      return {
        id: `v-${v.clientId}-${v.serverId}-${v.protokoll}`,
        type: 'verbindung',
        source: v.clientId,
        target: v.serverId,
        data: { protokoll: v.protokoll, versatz },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--farbe-akzent)', width: 18, height: 18 },
        selectable: false,
        focusable: false,
      };
    });
    return [...leitungen, ...verbindungen];
  }, [netz, auswahl, dienstAnsicht, sim, simVersion]);

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
    (changes: EdgeChange<LeitungKanteTyp | VerbindungKanteTyp>[]) => {
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
        colorMode="system"
      >
        <Background gap={24} />
        {/* Oben links: unten liegt im Modus „Ausprobieren“ die Simulationsleiste. */}
        <Controls showInteractive={false} position="top-left" />
        <PaketAnzeige />
      </ReactFlow>
      {netz.geraete.length === 0 && (
        <div className={styles.hinweis}>
          <p>{texte.leereArbeitsflaeche}</p>
          <p>{texte.oderBeispiel}</p>
          <button type="button" onClick={() => useApp.getState().setzeBeispieleOffen(true)}>
            {texte.beispiele}
          </button>
        </div>
      )}
      {!bearbeitbar && netz.geraete.length > 0 && !auswahl && (
        <p className={styles.hinweisOben}>{texte.ausprobierenHinweis}</p>
      )}
      {!bearbeitbar && <Simulationsleiste />}
      {!bearbeitbar && <BrowserFenster />}
    </main>
  );
}
