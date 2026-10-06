import { useEffect, useRef, useState } from 'react';
import { texte } from '../content/texte';
import { normalisierePfad } from '../model/domain';
import { seitenDokument } from './seitenDokument';
import styles from './HtmlEditor.module.css';

interface Props {
  titel: string;
  pfad: string;
  html: string;
  /** Darf der Pfad geändert werden? (Die Startseite „/“ nicht.) */
  pfadAenderbar: boolean;
  belegtePfade: string[];
  onUebernehmen: (pfad: string, html: string) => void;
  onSchliessen: () => void;
}

/** Dialog zum Schreiben einer Webseite: HTML links, Live-Vorschau rechts (auf schmalen Geräten untereinander). */
export function HtmlEditor({
  titel,
  pfad,
  html,
  pfadAenderbar,
  belegtePfade,
  onUebernehmen,
  onSchliessen,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [quelltext, setzeQuelltext] = useState(html);
  const [neuerPfad, setzeNeuerPfad] = useState(pfad);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const pfadNorm = normalisierePfad(neuerPfad);
  const pfadOk =
    !/\s/.test(neuerPfad.trim()) &&
    neuerPfad.trim().startsWith('/') &&
    (pfadNorm === pfad || !belegtePfade.includes(pfadNorm));

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="html-editor-titel" onClose={onSchliessen}>
      <form
        method="dialog"
        className={styles.inhalt}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pfadOk) return;
          onUebernehmen(pfadNorm, quelltext);
          dialog.current?.close();
        }}
      >
        <h2 id="html-editor-titel" className={styles.titel}>
          {titel}
        </h2>
        {pfadAenderbar && (
          <label className={styles.feld}>
            <span>{texte.pfad}</span>
            <input
              value={neuerPfad}
              onChange={(e) => setzeNeuerPfad(e.target.value)}
              aria-invalid={!pfadOk || undefined}
              aria-describedby="pfad-hinweis"
              spellCheck={false}
              autoCapitalize="off"
            />
            <small id="pfad-hinweis">{pfadOk ? texte.pfadHinweis : texte.pfadUngueltig}</small>
          </label>
        )}
        <div className={styles.spalten}>
          <label className={styles.feld}>
            <span>{texte.htmlQuelltext}</span>
            <textarea
              className={styles.quelltext}
              value={quelltext}
              onChange={(e) => setzeQuelltext(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>
          <div className={styles.feld}>
            <span id="vorschau-titel">{texte.vorschau}</span>
            <iframe
              className={styles.vorschau}
              title={texte.vorschau}
              aria-labelledby="vorschau-titel"
              sandbox=""
              srcDoc={seitenDokument(quelltext)}
            />
          </div>
        </div>
        <div className={styles.knoepfe}>
          <button type="button" onClick={() => dialog.current?.close()}>
            {texte.abbrechen}
          </button>
          <button type="submit" className={styles.primaer} disabled={!pfadOk}>
            {texte.uebernehmen}
          </button>
        </div>
      </form>
    </dialog>
  );
}
