import { useEffect, useRef, type ReactNode } from 'react';
import { glossar } from '../content/glossar';
import { paketKurzname } from '../content/meldungen';
import { texte } from '../content/texte';
import { hopEintrag, schichtenVon, zweiSchichten, type Feld, type HopEintrag } from '../sim/schichten';
import { stufenKonfiguration } from '../stufen';
import { useSim } from './simStore';
import styles from './PaketInspektor.module.css';

/**
 * Schichten-Inspektor: zeigt ein Paket als ineinander verschachtelte Schichten (Kapselung).
 * Klasse 11: 4-Schichten-Modell. Klasse 7/8: 2-Schichten-Modell (Infrastruktur / Dienst).
 */
export function PaketInspektor() {
  const nr = useSim((z) => z.paketDetails);
  const sim = useSim((z) => z.sim);
  const dialog = useRef<HTMLDialogElement>(null);
  const e = sim && nr !== null ? hopEintrag(sim.protokoll, nr) : undefined;

  useEffect(() => {
    if (e && !dialog.current?.open) dialog.current?.showModal();
    if (!e && dialog.current?.open) dialog.current.close();
  }, [e]);

  if (!sim) return null;
  const name = (id: string) => sim.netz.geraete.find((g) => g.id === id)?.name ?? id;
  const vierSchichten = stufenKonfiguration[sim.netz.stufe].schichtenmodell === 'vier-schichten';

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="inspektor-titel"
      onClose={() => useSim.getState().zeigePaket(null)}
    >
      {e && (
        <>
          <div className={styles.kopf}>
            <h2 id="inspektor-titel">
              {texte.paketInspektorTitel(paketKurzname(e.paket), name(e.geraetId), name(e.nachId))}
            </h2>
            <button type="button" className={styles.schliessen} onClick={() => dialog.current?.close()}>
              <span aria-hidden="true">×</span>
              <span className="visuell-versteckt">{texte.schliessen}</span>
            </button>
          </div>
          <p className={styles.hinweis} title={glossar.schichtenmodell.kurz}>
            {vierSchichten ? texte.schichtenHinweis11 : texte.schichtenHinweis78}
          </p>
          {vierSchichten ? <VierSchichten e={e} /> : <ZweiSchichten e={e} />}
        </>
      )}
    </dialog>
  );
}

function VierSchichten({ e }: { e: HopEintrag }) {
  const netz = useSim((z) => z.sim!.netz);
  const s = schichtenVon(netz, e.paket, e.geraetId, e.leitungId, e.hopIp);
  return (
    <Schicht
      stufe={1}
      name={texte.schichtNamen.netzzugang}
      aufgabe={texte.schichtAufgabe.netzzugang}
      protokoll={s.netzzugang.protokoll}
      felder={s.netzzugang.felder}
      offen
    >
      <Schicht
        stufe={2}
        name={texte.schichtNamen.vermittlung}
        aufgabe={texte.schichtAufgabe.vermittlung}
        protokoll={s.vermittlung.protokoll}
        felder={s.vermittlung.felder}
      >
        <Schicht
          stufe={3}
          name={texte.schichtNamen.transport}
          aufgabe={texte.schichtAufgabe.transport}
          protokoll={s.transport.protokoll}
          felder={s.transport.felder}
        >
          <Schicht
            stufe={4}
            name={texte.schichtNamen.anwendung}
            aufgabe={texte.schichtAufgabe.anwendung}
            protokoll={s.anwendung.protokoll}
            felder={s.anwendung.felder}
          />
        </Schicht>
      </Schicht>
    </Schicht>
  );
}

function ZweiSchichten({ e }: { e: HopEintrag }) {
  const netz = useSim((z) => z.sim!.netz);
  const s = zweiSchichten(netz, e.paket);
  return (
    <Schicht stufe={1} name={texte.schichtNamen.infrastruktur} felder={s.infrastruktur} offen>
      <Schicht stufe={4} name={texte.schichtNamen.dienst} felder={s.dienst} />
    </Schicht>
  );
}

function Schicht({
  stufe,
  name,
  aufgabe,
  protokoll,
  felder,
  offen,
  children,
}: {
  stufe: 1 | 2 | 3 | 4;
  name: string;
  aufgabe?: string;
  protokoll?: string;
  felder: Feld[];
  offen?: boolean;
  children?: ReactNode;
}) {
  return (
    <details className={styles.schicht} data-stufe={stufe} open={offen}>
      <summary>
        <span className={styles.schichtName}>{name}</span>
        {protokoll && <span className={styles.protokoll}>{protokoll}</span>}
      </summary>
      {aufgabe && <p className={styles.aufgabe}>{aufgabe}</p>}
      <dl className={styles.felder}>
        {felder.map((f) => (
          <div key={f.name}>
            <dt>{f.name}</dt>
            <dd>{f.wert}</dd>
          </div>
        ))}
      </dl>
      {children}
    </details>
  );
}
