import { texte } from '../content/texte';
import { useApp } from './store';
import styles from './Auftrag.module.css';

/** Arbeitsauftrag eines geöffneten Beispiels – ausblendbar, damit er nicht im Weg ist. */
export function Auftrag() {
  const auftrag = useApp((z) => z.auftrag);
  const setzeSichtbar = useApp((z) => z.setzeAuftragSichtbar);
  if (!auftrag) return null;
  if (!auftrag.sichtbar) {
    return (
      <button type="button" className={styles.einblenden} onClick={() => setzeSichtbar(true)}>
        <span aria-hidden="true">📋 </span>
        {texte.auftragEinblenden}
      </button>
    );
  }
  return (
    <section className={styles.auftrag} aria-labelledby="auftrag-titel">
      <div className={styles.text}>
        <h2 id="auftrag-titel">
          <span aria-hidden="true">📋 </span>
          {texte.arbeitsauftrag}: {auftrag.titel}
        </h2>
        <p>{auftrag.text}</p>
      </div>
      <button type="button" className={styles.ausblenden} onClick={() => setzeSichtbar(false)}>
        <span aria-hidden="true">×</span>
        <span className="visuell-versteckt">{texte.auftragAusblenden}</span>
      </button>
    </section>
  );
}
