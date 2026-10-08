import { useEffect, useRef, useState } from 'react';
import { glossar, type GlossarEintrag } from '../content/glossar';
import { texte } from '../content/texte';
import { stufen, type StufeId } from '../model/stufe';
import { stufenKonfiguration } from '../stufen';
import { useApp } from './store';
import styles from './Glossar.module.css';

/** Glossar mit den verbindlichen Begriffen (Bildungsplan 6.1), gefiltert nach Klassenstufe. */
export function GlossarDialog({ offen, onSchliessen }: { offen: boolean; onSchliessen: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const aktuelleStufe = useApp((z) => z.netz.stufe);
  const [filter, setzeFilter] = useState<StufeId | 'alle'>(aktuelleStufe);
  useEffect(() => {
    if (offen && !dialog.current?.open) dialog.current?.showModal();
    if (!offen && dialog.current?.open) dialog.current.close();
  }, [offen]);

  const rang = (s: StufeId) => stufen.indexOf(s);
  const eintraege = (Object.values(glossar) as GlossarEintrag[])
    .filter((e) => filter === 'alle' || rang(e.abStufe) <= rang(filter))
    .sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'));

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="glossar-titel" onClose={onSchliessen}>
      <div className={styles.kopf}>
        <h2 id="glossar-titel">{texte.glossarTitel}</h2>
        <button type="button" className={styles.schliessen} onClick={() => dialog.current?.close()}>
          <span aria-hidden="true">×</span>
          <span className="visuell-versteckt">{texte.schliessen}</span>
        </button>
      </div>
      <label className={styles.filter}>
        <span>{texte.stufeWaehlen}</span>
        <select
          aria-label={texte.stufeWaehlen}
          value={filter}
          onChange={(e) => setzeFilter(e.target.value as StufeId | 'alle')}
        >
          {stufen.map((s) => (
            <option key={s} value={s}>
              {stufenKonfiguration[s].name}
            </option>
          ))}
          <option value="alle">{texte.glossarAlle}</option>
        </select>
      </label>
      <dl className={styles.liste}>
        {eintraege.map((e) => (
          <div key={e.begriff}>
            <dt>{e.begriff}</dt>
            <dd>{e.kurz}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
