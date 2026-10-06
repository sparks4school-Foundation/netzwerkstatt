import { useEffect, useRef } from 'react';
import { protokollText } from '../content/meldungen';
import { texte } from '../content/texte';
import type { ProtokollEintrag } from '../sim/simulation';
import { useSim } from './simStore';
import styles from './Protokoll.module.css';

const istWarnung = (e: ProtokollEintrag) =>
  e.art === 'verworfen' ||
  e.art === 'nicht-gesendet' ||
  e.art === 'ip-doppelt' ||
  e.art === 'falscher-empfaenger';

/** Kommunikationsprotokoll: Wer hat wann was an wen geschickt? */
export function Protokoll() {
  const sim = useSim((z) => z.sim);
  const offen = useSim((z) => z.protokollOffen);
  useSim((z) => z.version);
  const ende = useRef<HTMLDivElement>(null);
  const anzahl = sim?.protokoll.length ?? 0;

  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'nearest' });
  }, [anzahl]);

  if (!sim || !offen) return null;
  const name = (id: string) => sim.netz.geraete.find((g) => g.id === id)?.name ?? id;
  const letzter = sim.protokoll.at(-1);

  return (
    <section className={styles.protokoll} aria-labelledby="protokoll-titel">
      <h2 id="protokoll-titel" className={styles.titel}>
        {texte.protokoll}
      </h2>
      {/* Für Screenreader: neuester Eintrag wird vorgelesen. */}
      <p className="visuell-versteckt" aria-live="polite">
        {letzter && `${name(letzter.geraetId)}: ${protokollText(letzter, name)}`}
      </p>
      {anzahl === 0 ? (
        <p className={styles.leer}>{texte.protokollLeer}</p>
      ) : (
        <div className={styles.rolle}>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th scope="col">{texte.spalteSchritt}</th>
                <th scope="col">{texte.spalteStation}</th>
                <th scope="col">{texte.spalteAn}</th>
                <th scope="col">{texte.spalteWas}</th>
              </tr>
            </thead>
            <tbody>
              {sim.protokoll.map((e) => (
                <tr key={e.nr} data-warnung={istWarnung(e) || undefined}>
                  <td className={styles.zahl}>{e.zeit}</td>
                  <td>{name(e.geraetId)}</td>
                  <td>{'nachId' in e ? name(e.nachId) : '–'}</td>
                  <td>
                    {istWarnung(e) && <span aria-hidden="true">⚠ </span>}
                    {protokollText(e, name)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={ende} />
        </div>
      )}
    </section>
  );
}
