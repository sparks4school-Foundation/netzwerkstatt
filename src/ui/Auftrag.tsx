import { pruefFehlerText, pruefungText } from '../content/meldungen';
import { texte } from '../content/texte';
import { useApp } from './store';
import styles from './Auftrag.module.css';

/**
 * Arbeitsauftrag aus der Aufgabe der Datei: Text, Hilfestufen zum Aufdecken (Differenzierung)
 * und „Lösung prüfen“ mit Rückmeldung je Bedingung.
 */
export function Auftrag() {
  const aufgabe = useApp((z) => z.netz.aufgabe);
  const geraete = useApp((z) => z.netz.geraete);
  const sichtbar = useApp((z) => z.auftragSichtbar);
  const hilfeStufe = useApp((z) => z.hilfeStufe);
  const ergebnisse = useApp((z) => z.pruefErgebnisse);
  const { setzeAuftragSichtbar, naechsteHilfe, loesungPruefen } = useApp.getState();
  if (!aufgabe) return null;
  const name = (id: string) => geraete.find((g) => g.id === id)?.name ?? id;

  if (!sichtbar) {
    return (
      <button type="button" className={styles.einblenden} onClick={() => setzeAuftragSichtbar(true)}>
        <span aria-hidden="true">📋 </span>
        {texte.auftragEinblenden}
      </button>
    );
  }

  const offen = ergebnisse?.filter((e) => !e.ok).length ?? 0;
  return (
    <section className={styles.auftrag} aria-labelledby="auftrag-titel">
      <div className={styles.text}>
        <h2 id="auftrag-titel">
          <span aria-hidden="true">📋 </span>
          {texte.arbeitsauftrag}: {aufgabe.titel}
        </h2>
        <p>{aufgabe.auftrag}</p>
        {aufgabe.aufbauGesperrt && <p className={styles.leise}>{texte.aufbauGesperrtHinweis}</p>}

        {hilfeStufe > 0 && (
          <ol className={styles.hilfen}>
            {aufgabe.hilfen.slice(0, hilfeStufe).map((h, i) => (
              <li key={i}>
                <strong>{texte.hilfe(i + 1)}:</strong> {h}
              </li>
            ))}
          </ol>
        )}

        {ergebnisse && (
          <div className={styles.ergebnis} role="status">
            <p className={styles.fazit} data-ok={offen === 0 || undefined}>
              <span aria-hidden="true">{offen === 0 ? '🎉 ' : '⚠ '}</span>
              {offen === 0 ? texte.allesGeschafft : texte.nochNichtGeschafft(offen)}
            </p>
            <ul>
              {aufgabe.pruefungen.map((p, i) => {
                const e = ergebnisse[i];
                if (!e) return null;
                return (
                  <li key={i} data-ok={e.ok || undefined}>
                    <span aria-hidden="true">{e.ok ? '✓ ' : '✗ '}</span>
                    {pruefungText(p, name)}{' '}
                    <span className="visuell-versteckt">
                      ({e.ok ? texte.pruefungBestanden : texte.pruefungNichtBestanden})
                    </span>
                    {!e.ok && (
                      <span className={styles.leise}>
                        {' '}
                        – {pruefFehlerText(e, 'geraetId' in p ? name(p.geraetId) : '')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className={styles.knoepfe}>
          {hilfeStufe < aufgabe.hilfen.length && (
            <button type="button" onClick={naechsteHilfe}>
              <span aria-hidden="true">💡 </span>
              {texte.hilfeAnzeigen(hilfeStufe + 1, aufgabe.hilfen.length)}
            </button>
          )}
          {aufgabe.pruefungen.length > 0 && (
            <button type="button" className={styles.primaer} onClick={loesungPruefen}>
              <span aria-hidden="true">✓ </span>
              {texte.loesungPruefen}
            </button>
          )}
        </div>
      </div>
      <button type="button" className={styles.ausblenden} onClick={() => setzeAuftragSichtbar(false)}>
        <span aria-hidden="true">×</span>
        <span className="visuell-versteckt">{texte.auftragAusblenden}</span>
      </button>
    </section>
  );
}
