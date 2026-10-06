import { useEffect } from 'react';
import { texte } from '../content/texte';
import { useApp } from './store';
import styles from './Meldung.module.css';

/** Kurze Rückmeldung (z. B. warum eine Verbindung nicht geht). Fehler: role="alert", sonst role="status". */
export function Meldung() {
  const meldung = useApp((z) => z.meldung);
  const schliessen = useApp((z) => z.meldungSchliessen);

  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(schliessen, meldung.art === 'fehler' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [meldung, schliessen]);

  if (!meldung) return null;
  return (
    <div
      key={meldung.nr}
      className={styles.meldung}
      data-art={meldung.art}
      role={meldung.art === 'fehler' ? 'alert' : 'status'}
    >
      <span aria-hidden="true" className={styles.symbol}>
        {meldung.art === 'fehler' ? '!' : 'i'}
      </span>
      <span className={styles.text}>{meldung.text}</span>
      <button type="button" onClick={schliessen}>
        {texte.schliessen}
      </button>
    </div>
  );
}
