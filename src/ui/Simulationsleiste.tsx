import { texte } from '../content/texte';
import { TEMPI, useSim } from './simStore';
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
  const { abspielen, pause, schritt, setzeTempo, starte, setzeProtokollOffen } = useSim.getState();
  if (!sim) return null;
  const aktiv = sim.aktiv;

  return (
    <div className={styles.leiste} role="toolbar" aria-label={texte.simulation}>
      {laeuft ? (
        <button type="button" onClick={pause}>
          <span aria-hidden="true">⏸</span> {texte.pause}
        </button>
      ) : (
        <button type="button" onClick={abspielen} disabled={!aktiv && !angehalten}>
          <span aria-hidden="true">▶</span> {texte.abspielen}
        </button>
      )}
      <button type="button" onClick={schritt}>
        <span aria-hidden="true">⏭</span> {texte.einzelschritt}
      </button>
      <label className={styles.tempo}>
        <span>{texte.tempo}</span>
        <input
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
        <span aria-hidden="true">↺</span> {texte.zuruecksetzen}
      </button>
      <button
        type="button"
        aria-expanded={protokollOffen}
        onClick={() => setzeProtokollOffen(!protokollOffen)}
      >
        {protokollOffen ? texte.protokollVerbergen : texte.protokollZeigen}
      </button>
    </div>
  );
}
