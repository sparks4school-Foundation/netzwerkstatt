import { texte } from '../content/texte';
import { TEMPI, useSim } from './simStore';
import { stufenKonfiguration } from '../stufen';
import { useApp } from './store';
import styles from './Simulationsleiste.module.css';

/** Steuerung der Simulation: Abspielen/Pause, Einzelschritt, Tempo, Zurücksetzen, Protokoll. */
export function Simulationsleiste() {
  const sim = useSim((z) => z.sim);
  useSim((z) => z.version);
  const laeuft = useSim((z) => z.laeuft);
  const angehalten = useSim((z) => z.angehalten);
  const tempo = useSim((z) => z.tempo);
  const protokollOffen = useSim((z) => z.protokollOffen);
  const optionen = useSim((z) => z.optionen);
  const mitOptionen = useSim((z) =>
    z.sim ? stufenKonfiguration[z.sim.netz.stufe].zeigeRoutingtabelle : false,
  );
  const { abspielen, pause, schritt, setzeTempo, starte, setzeProtokollOffen } = useSim.getState();
  if (!sim) return null;
  const aktiv = sim.aktiv;

  return (
    <div className={styles.leiste} role="toolbar" aria-label={texte.simulation}>
      {laeuft ? (
        <button type="button" onClick={pause}>
          <span aria-hidden="true">⏸</span> <span className={styles.langtext}>{texte.pause}</span>
        </button>
      ) : (
        <button type="button" onClick={abspielen} disabled={!aktiv && !angehalten}>
          <span aria-hidden="true">▶</span> <span className={styles.langtext}>{texte.abspielen}</span>
        </button>
      )}
      <button type="button" onClick={schritt}>
        <span aria-hidden="true">⏭</span> <span className={styles.langtext}>{texte.einzelschritt}</span>
      </button>
      <label className={styles.tempo}>
        <span className={styles.langtext}>{texte.tempo}</span>
        <input
          aria-label={texte.tempo}
          type="range"
          min={0}
          max={TEMPI.length - 1}
          step={1}
          value={tempo}
          aria-valuetext={TEMPI[tempo]!.name}
          onChange={(e) => setzeTempo(Number(e.target.value))}
        />
        <span className={styles.tempoName}>{TEMPI[tempo]!.name}</span>
      </label>
      <span className={styles.schritt} aria-live="off">
        {texte.schrittNr(sim.zeit)}
        {angehalten && !laeuft && <span className={styles.angehalten}> · {texte.angehalten}</span>}
      </span>
      <button type="button" onClick={() => starte(useApp.getState().netz)}>
        <span aria-hidden="true">↺</span> <span className={styles.langtext}>{texte.zuruecksetzen}</span>
      </button>
      {mitOptionen && (
        <details className={styles.optionen}>
          <summary>
            <span aria-hidden="true">⚙</span> <span className={styles.langtext}>{texte.einstellungen}</span>
          </summary>
          <div className={styles.optionenInhalt}>
            <label>
              <input
                type="checkbox"
                checked={optionen.mehrwege}
                onChange={(e) => useSim.getState().setzeOptionen({ mehrwege: e.target.checked })}
              />
              {texte.mehrwege}
            </label>
            <label>
              <input
                type="checkbox"
                checked={optionen.bestaetigen}
                onChange={(e) => useSim.getState().setzeOptionen({ bestaetigen: e.target.checked })}
              />
              {texte.bestaetigen}
            </label>
            <button
              type="button"
              onClick={() => useSim.getState().setzeOptionen({ startwert: optionen.startwert + 1 })}
            >
              <span aria-hidden="true">🎲 </span>
              {texte.neuWuerfeln(optionen.startwert)}
            </button>
          </div>
        </details>
      )}
      <button
        type="button"
        aria-expanded={protokollOffen}
        onClick={() => setzeProtokollOffen(!protokollOffen)}
      >
        <span aria-hidden="true">📋</span>{' '}
        <span className={styles.langtext}>
          {protokollOffen ? texte.protokollVerbergen : texte.protokollZeigen}
        </span>
      </button>
    </div>
  );
}
