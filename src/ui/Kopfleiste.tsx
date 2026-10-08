import { useReactFlow } from '@xyflow/react';
import { useRef, useState } from 'react';
import { dateiMeldungen } from '../content/meldungen';
import { texte } from '../content/texte';
import { leeresNetz } from '../model/datei';
import { stufen, type StufeId } from '../model/stufe';
import { stufenKonfiguration } from '../stufen';
import { netzAusDatei, netzHerunterladen } from './dateiAktionen';
import { netzplanAlsPng } from './exportieren';
import { GlossarDialog } from './Glossar';
import { useApp, type Ansicht, type Modus } from './store';
import { Umschalter } from './Umschalter';
import styles from './Kopfleiste.module.css';

const stufenOptionen = stufen.map((id) => ({ wert: id, text: stufenKonfiguration[id].name }));
const ansichtOptionen = [
  { wert: 'infrastruktur', text: texte.ansichtInfrastruktur },
  { wert: 'dienste', text: texte.ansichtDienste },
] as const satisfies readonly { wert: Ansicht; text: string }[];
const modusOptionen = [
  { wert: 'aufbauen', text: texte.modusAufbauen },
  { wert: 'ausprobieren', text: texte.modusAusprobieren },
] as const satisfies readonly { wert: Modus; text: string }[];

export function Kopfleiste() {
  const stufe = useApp((z) => z.netz.stufe);
  const modus = useApp((z) => z.modus);
  const ansicht = useApp((z) => z.ansicht);
  const kannZurueck = useApp((z) => z.vergangenheit.length > 0);
  const kannVor = useApp((z) => z.zukunft.length > 0);
  const { setzeStufe, setzeModus, setzeAnsicht, rueckgaengig, wiederholen, ersetzeNetz, melde } =
    useApp.getState();
  const dateiEingabe = useRef<HTMLInputElement>(null);

  return (
    <header className={styles.kopf}>
      <h1 className={styles.titel}>{texte.appName}</h1>

      <nav className={styles.aktionen} aria-label={texte.datei}>
        <button
          type="button"
          onClick={() => {
            if (useApp.getState().netz.geraete.length === 0 || confirm(dateiMeldungen.neuBestaetigen)) {
              ersetzeNetz(leeresNetz(stufe));
            }
          }}
        >
          {texte.neu}
        </button>
        <button type="button" onClick={() => dateiEingabe.current?.click()}>
          {texte.oeffnen}
        </button>
        <button type="button" onClick={() => useApp.getState().setzeBeispieleOffen(true)}>
          {texte.beispiele}
        </button>
        <input
          ref={dateiEingabe}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const datei = e.target.files?.[0];
            e.target.value = '';
            if (!datei) return;
            const ergebnis = await netzAusDatei(datei);
            if (ergebnis.ok) {
              ersetzeNetz(ergebnis.netz);
              melde(dateiMeldungen.geoeffnet(datei.name));
            } else {
              melde(ergebnis.meldung, 'fehler');
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            netzHerunterladen(useApp.getState().netz);
            melde(dateiMeldungen.gespeichert);
          }}
        >
          {texte.speichern}
        </button>
        <MehrMenue />
        <span className={styles.trenner} aria-hidden="true" />
        <button
          type="button"
          onClick={rueckgaengig}
          disabled={!kannZurueck}
          aria-keyshortcuts="Control+Z Meta+Z"
        >
          <span aria-hidden="true">↶</span>
          <span className={styles.langtext}>{texte.rueckgaengig}</span>
        </button>
        <button
          type="button"
          onClick={wiederholen}
          disabled={!kannVor}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        >
          <span aria-hidden="true">↷</span>
          <span className={styles.langtext}>{texte.wiederholen}</span>
        </button>
      </nav>

      <div className={styles.steuerung}>
        <Umschalter<StufeId>
          name="stufe"
          beschriftung={texte.stufeWaehlen}
          optionen={stufenOptionen}
          wert={stufe}
          onChange={setzeStufe}
        />
        <Umschalter<Ansicht>
          name="ansicht"
          beschriftung={texte.ansicht}
          optionen={ansichtOptionen}
          wert={ansicht}
          onChange={setzeAnsicht}
        />
        <Umschalter<Modus>
          name="modus"
          beschriftung={texte.modusWaehlen}
          optionen={modusOptionen}
          wert={modus}
          onChange={setzeModus}
        />
      </div>
    </header>
  );
}

/** Weniger häufige Aktionen: Aufgabe (Lehrkräfte), Export, Druck, Glossar. */
function MehrMenue() {
  const hatAufgabe = useApp((z) => !!z.netz.aufgabe);
  const [glossarOffen, setzeGlossarOffen] = useState(false);
  const menue = useRef<HTMLDetailsElement>(null);
  const { getNodes, fitView } = useReactFlow();
  const zu = () => menue.current?.removeAttribute('open');

  return (
    <>
      <details ref={menue} className={styles.mehr}>
        <summary>
          {texte.mehr} <span aria-hidden="true">▾</span>
        </summary>
        <div className={styles.mehrInhalt}>
          <button
            type="button"
            onClick={() => {
              zu();
              useApp.getState().setzeAufgabeBearbeiten(true);
            }}
          >
            📋 {hatAufgabe ? texte.aufgabeBearbeiten : texte.aufgabeErstellen}
          </button>
          <button
            type="button"
            onClick={() => {
              zu();
              const titel = useApp.getState().netz.titel.trim() || 'netzplan';
              void netzplanAlsPng(getNodes(), `${titel.replace(/[^\p{L}\p{N}_-]+/gu, '-')}.png`);
            }}
          >
            🖼 {texte.netzplanAlsBild}
          </button>
          <button
            type="button"
            onClick={() => {
              zu();
              void fitView({ padding: 0.1 }).then(() => setTimeout(() => window.print(), 50));
            }}
          >
            🖨 {texte.drucken}
          </button>
          <button
            type="button"
            onClick={() => {
              zu();
              setzeGlossarOffen(true);
            }}
          >
            📖 {texte.glossar}
          </button>
        </div>
      </details>
      <GlossarDialog offen={glossarOffen} onSchliessen={() => setzeGlossarOffen(false)} />
    </>
  );
}
