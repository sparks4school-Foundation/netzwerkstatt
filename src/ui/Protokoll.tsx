import { useEffect, useRef } from 'react';
import { paketKurzname, protokollText } from '../content/meldungen';
import { texte } from '../content/texte';
import { hopEintrag } from '../sim/schichten';
import type { ProtokollEintrag } from '../sim/simulation';
import { stufenKonfiguration } from '../stufen';
import { Sequenzdiagramm } from './Sequenzdiagramm';
import { Umschalter } from './Umschalter';
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
  const ansicht = useSim((z) => z.untenAnsicht);
  const mitSequenz = useSim((z) =>
    z.sim ? stufenKonfiguration[z.sim.netz.stufe].zeigeSequenzdiagramm : false,
  );
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
      <div className={styles.kopf}>
        <h2 id="protokoll-titel" className={styles.titel}>
          {mitSequenz && ansicht === 'sequenz' ? texte.sequenzdiagramm : texte.protokoll}
        </h2>
        {mitSequenz && (
          <Umschalter<'protokoll' | 'sequenz'>
            name="unten-ansicht"
            beschriftung={texte.untenAnsicht}
            optionen={[
              { wert: 'protokoll', text: texte.protokoll },
              { wert: 'sequenz', text: texte.sequenzdiagramm },
            ]}
            wert={ansicht}
            onChange={(a) => useSim.getState().setzeUntenAnsicht(a)}
          />
        )}
      </div>
      {/* Für Screenreader: neuester Eintrag wird vorgelesen. */}
      <p className="visuell-versteckt" aria-live="polite">
        {letzter && `${name(letzter.geraetId)}: ${protokollText(letzter, name)}`}
      </p>
      {mitSequenz && ansicht === 'sequenz' ? (
        <Sequenzdiagramm />
      ) : anzahl === 0 ? (
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
                <th scope="col">
                  <span className="visuell-versteckt">{texte.paketDetails}</span>
                </th>
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
                  <td>
                    {'paket' in e && hopEintrag(sim.protokoll, e.nr) && (
                      <button
                        type="button"
                        className={styles.details}
                        aria-label={texte.paketDetailsZu(
                          `${texte.spalteSchritt} ${e.zeit}: ${paketKurzname(e.paket)}`,
                        )}
                        onClick={() => useSim.getState().zeigePaket(e.nr)}
                      >
                        {texte.paketDetails}
                      </button>
                    )}
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
