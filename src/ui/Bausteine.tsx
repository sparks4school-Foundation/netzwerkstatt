import { useReactFlow } from '@xyflow/react';
import { geraeteTexte, leitungsTexte } from '../content/geraete';
import { texte } from '../content/texte';
import type { GeraetTyp, LeitungsArt } from '../model/datei';
import { GERAET_BREITE, GERAET_HOEHE } from '../model/netz';
import { stufenKonfiguration } from '../stufen';
import { DRAG_TYP } from './Arbeitsflaeche';
import { GeraetIcon } from './GeraetIcon';
import { useApp } from './store';
import { Umschalter } from './Umschalter';
import styles from './Bausteine.module.css';

const artOptionen = (['kabel', 'wlan'] as const).map((wert) => ({ wert, text: leitungsTexte[wert].name }));

/**
 * Palette der Bausteine. Tippen/Klicken/Enter legt das Gerät in der Mitte der Arbeitsfläche ab
 * (funktioniert mit Touch, Maus und Tastatur); mit der Maus kann man es zusätzlich hineinziehen.
 */
export function Bausteine() {
  const stufe = useApp((z) => z.netz.stufe);
  const verbindungsart = useApp((z) => z.verbindungsart);
  const { geraetHinzufuegen, setzeVerbindungsart } = useApp.getState();
  const { screenToFlowPosition } = useReactFlow();
  const { endgeraete, verteiler } = stufenKonfiguration[stufe].bausteine;

  function ablegen(typ: GeraetTyp) {
    const flaeche = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!flaeche) return;
    const mitte = screenToFlowPosition({
      x: flaeche.left + flaeche.width / 2,
      y: flaeche.top + flaeche.height / 2,
    });
    geraetHinzufuegen(typ, { x: mitte.x - GERAET_BREITE / 2, y: mitte.y - GERAET_HOEHE / 2 });
  }

  const gruppe = (titel: string, typen: GeraetTyp[]) => (
    <section className={styles.gruppe} aria-label={titel}>
      <h3 className={styles.titel}>{titel}</h3>
      <ul className={styles.liste}>
        {typen.map((typ) => (
          <li key={typ}>
            <button
              type="button"
              className={styles.baustein}
              title={geraeteTexte[typ].beschreibung}
              aria-label={texte.geraetHinzufuegen(geraeteTexte[typ].name)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYP, typ);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => ablegen(typ)}
            >
              <GeraetIcon typ={typ} />
              <span>{geraeteTexte[typ].name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <aside className={styles.palette} aria-labelledby="bausteine-titel">
      <h2 id="bausteine-titel" className="visuell-versteckt">
        {texte.bausteine}
      </h2>
      {gruppe(texte.endgeraete, endgeraete)}
      {gruppe(texte.verteiler, verteiler)}
      <section className={`${styles.gruppe} ${styles.verbindung}`}>
        <h3 className={styles.titel}>{texte.verbindungsart}</h3>
        <Umschalter<LeitungsArt>
          name="verbindungsart"
          beschriftung={texte.verbindungsart}
          optionen={artOptionen}
          wert={verbindungsart}
          onChange={setzeVerbindungsart}
        />
      </section>
    </aside>
  );
}
