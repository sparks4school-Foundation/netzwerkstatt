import { useEffect, useRef } from 'react';
import { beispiele, type Beispiel } from '../content/beispiele';
import { texte } from '../content/texte';
import { ladeNetz } from '../model/datei';
import { stufenKonfiguration } from '../stufen';
import { useApp } from './store';
import styles from './BeispieleDialog.module.css';

/** Auswahl der Beispielnetze. Öffnet ein Beispiel samt Arbeitsauftrag. */
export function BeispieleDialog() {
  const offen = useApp((z) => z.beispieleOffen);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (offen && !dialog.current?.open) dialog.current?.showModal();
    if (!offen && dialog.current?.open) dialog.current.close();
  }, [offen]);

  const oeffnen = (b: Beispiel) => {
    const { netz, ersetzeNetz, melde, setzeBeispieleOffen } = useApp.getState();
    if (netz.geraete.length > 0 && !confirm(texte.beispielErsetzen)) return;
    const ergebnis = ladeNetz(JSON.stringify(b.daten));
    if (!ergebnis.ok) {
      melde(ergebnis.meldung, 'fehler');
      return;
    }
    ersetzeNetz(ergebnis.netz);
    setzeBeispieleOffen(false);
    melde(texte.beispielGeoeffnet(b.titel));
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="beispiele-titel"
      onClose={() => useApp.getState().setzeBeispieleOffen(false)}
    >
      <div className={styles.kopf}>
        <h2 id="beispiele-titel">{texte.beispieleTitel}</h2>
        <button type="button" className={styles.schliessen} onClick={() => dialog.current?.close()}>
          <span aria-hidden="true">×</span>
          <span className="visuell-versteckt">{texte.schliessen}</span>
        </button>
      </div>
      <p className={styles.einleitung}>{texte.beispieleEinleitung}</p>
      <ul className={styles.liste}>
        {beispiele.map((b) => (
          <li key={b.id} className={styles.karte}>
            <h3>{b.titel}</h3>
            <p className={styles.meta}>
              {stufenKonfiguration[b.stufe].name} · {b.bezug}
            </p>
            <p>{b.beschreibung}</p>
            <button type="button" aria-label={texte.beispielOeffnen(b.titel)} onClick={() => oeffnen(b)}>
              {texte.oeffnenKurz}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
