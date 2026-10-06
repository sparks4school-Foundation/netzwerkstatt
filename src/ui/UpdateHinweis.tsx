import { useRegisterSW } from 'virtual:pwa-register/react';
import { texte } from '../content/texte';
import styles from './UpdateHinweis.module.css';

/** Meldet, wenn die App offline bereit ist oder eine neue Version vorliegt. Aktualisiert nie ungefragt. */
export function UpdateHinweis() {
  const {
    offlineReady: [offlineBereit, setzeOfflineBereit],
    needRefresh: [updateDa, setzeUpdateDa],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineBereit && !updateDa) return null;

  return (
    <div className={styles.hinweis} role="status">
      <span>{updateDa ? texte.updateVerfuegbar : texte.offlineBereit}</span>
      {updateDa && <button onClick={() => updateServiceWorker(true)}>{texte.neuLaden}</button>}
      <button
        onClick={() => {
          setzeOfflineBereit(false);
          setzeUpdateDa(false);
        }}
      >
        {texte.schliessen}
      </button>
    </div>
  );
}
