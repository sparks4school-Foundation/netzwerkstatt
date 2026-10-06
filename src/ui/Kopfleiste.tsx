import { useRef } from 'react';
import { dateiMeldungen } from '../content/meldungen';
import { texte } from '../content/texte';
import { leeresNetz } from '../model/datei';
import { stufen, type StufeId } from '../model/stufe';
import { stufenKonfiguration } from '../stufen';
import { netzAusDatei, netzHerunterladen } from './dateiAktionen';
import { useApp, type Modus } from './store';
import { Umschalter } from './Umschalter';
import styles from './Kopfleiste.module.css';

const stufenOptionen = stufen.map((id) => ({ wert: id, text: stufenKonfiguration[id].name }));
const modusOptionen = [
  { wert: 'aufbauen', text: texte.modusAufbauen },
  { wert: 'ausprobieren', text: texte.modusAusprobieren },
] as const satisfies readonly { wert: Modus; text: string }[];

export function Kopfleiste() {
  const stufe = useApp((z) => z.netz.stufe);
  const modus = useApp((z) => z.modus);
  const kannZurueck = useApp((z) => z.vergangenheit.length > 0);
  const kannVor = useApp((z) => z.zukunft.length > 0);
  const { setzeStufe, setzeModus, rueckgaengig, wiederholen, ersetzeNetz, melde } = useApp.getState();
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
