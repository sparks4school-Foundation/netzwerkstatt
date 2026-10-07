import { adressProblemText, maskeKurz, routingEintragTexte } from '../content/meldungen';
import { texte } from '../content/texte';
import { adressProbleme, ipVorschlag } from '../model/adressen';
import type { Geraet, NetzDatei, RoutingEintrag } from '../model/datei';
import { gegenueberName as gegenueber, leitungenVon } from '../model/netz';
import { alsEintrag, automatischeRouten, routingEintragProbleme } from '../model/routing';
import { stufenKonfiguration } from '../stufen';
import { useApp } from './store';
import { Textfeld } from './Textfeld';
import { Umschalter } from './Umschalter';
import styles from './Eigenschaften.module.css';

/** Router: IP-Adresse je Anschluss (Klasse 11) und Routingtabelle (Whitebox). */
export function RouterEinstellungen({
  router,
  netz,
  bearbeitbar,
}: {
  router: Geraet;
  netz: NetzDatei;
  bearbeitbar: boolean;
}) {
  const konfig = stufenKonfiguration[netz.stufe];
  if (!konfig.zeigeRoutingtabelle) return <p className={styles.wert}>{texte.routerSpaeter}</p>;
  return (
    <>
      <Anschluesse router={router} netz={netz} bearbeitbar={bearbeitbar} />
      <Routingtabelle router={router} netz={netz} bearbeitbar={bearbeitbar} />
    </>
  );
}

function Anschluesse({
  router,
  netz,
  bearbeitbar,
}: {
  router: Geraet;
  netz: NetzDatei;
  bearbeitbar: boolean;
}) {
  const setzeAnschluss = useApp((z) => z.setzeAnschluss);
  const leitungen = leitungenVon(netz, router.id);
  const probleme = adressProbleme(netz).get(router.id) ?? [];

  return (
    <section className={styles.feld} aria-labelledby={`anschluesse-${router.id}`}>
      <span id={`anschluesse-${router.id}`}>{texte.anschluesse}</span>
      {leitungen.length === 0 && <p className={styles.wert}>{texte.keineAnschluesse}</p>}
      <ul className={styles.dienstliste}>
        {leitungen.map((l) => {
          const a = router.anschluesse?.[l.id];
          const name = gegenueber(netz, router.id, l.id);
          const eigene = probleme.filter((p) => p.anschluss === l.id);
          return (
            <li key={l.id} className={styles.dienst}>
              <strong>{texte.anschlussZu(name)}</strong>
              {bearbeitbar ? (
                <>
                  <div className={styles.zeile}>
                    <Textfeld
                      key={`ip-${l.id}-${a?.ip}`}
                      klasse={`${styles.feld} ${styles.wachsen}`}
                      beschriftung={texte.ipAdresse}
                      wert={a?.ip ?? ''}
                      placeholder="192.168.0.1"
                      inputMode="decimal"
                      spellCheck={false}
                      aria-invalid={eigene.some((p) => p.art === 'ip-ungueltig') || undefined}
                      onUebernehmen={(ip) => setzeAnschluss(router.id, l.id, { ...a, ip })}
                    />
                    <button
                      type="button"
                      className={styles.vorschlag}
                      title={texte.anschlussVorschlag(name)}
                      aria-label={texte.anschlussVorschlag(name)}
                      onClick={() =>
                        setzeAnschluss(router.id, l.id, { ...a, ip: ipVorschlag(netz, router.id, l.id) })
                      }
                    >
                      {texte.ipVorschlag}
                    </button>
                  </div>
                  <Textfeld
                    key={`maske-${l.id}-${a?.subnetzmaske}`}
                    klasse={styles.feld}
                    beschriftung={texte.subnetzmaske}
                    wert={a?.subnetzmaske ?? ''}
                    placeholder="255.255.255.0"
                    inputMode="decimal"
                    spellCheck={false}
                    onUebernehmen={(subnetzmaske) =>
                      setzeAnschluss(router.id, l.id, { ip: a?.ip ?? '', subnetzmaske })
                    }
                  />
                </>
              ) : (
                <p className={styles.wert}>
                  <code>{a?.ip || '–'}</code>
                  {a?.ip && ` / ${maskeKurz(a.subnetzmaske || '255.255.255.0')}`}
                </p>
              )}
              {eigene.length > 0 && (
                <ul className={styles.probleme}>
                  {eigene.map((p, i) => (
                    <li key={i}>
                      <span aria-hidden="true">⚠ </span>
                      {adressProblemText(p)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Routingtabelle({
  router,
  netz,
  bearbeitbar,
}: {
  router: Geraet;
  netz: NetzDatei;
  bearbeitbar: boolean;
}) {
  const setzeRouting = useApp((z) => z.setzeRouting);
  const modus = router.routing?.modus ?? 'automatisch';
  const leitungen = leitungenVon(netz, router.id);
  const automatisch = automatischeRouten(netz, router.id);
  const tabelle = router.routing?.tabelle ?? [];
  const probleme = routingEintragProbleme(netz, router);

  const aendere = (neu: RoutingEintrag[]) => setzeRouting(router.id, { modus: 'manuell', tabelle: neu });
  const aendereZeile = (i: number, feld: keyof RoutingEintrag, wert: string) => {
    if (tabelle[i]?.[feld] === wert) return;
    aendere(tabelle.map((e, j) => (j === i ? { ...e, [feld]: wert } : e)));
  };

  return (
    <section className={styles.feld} aria-labelledby={`routing-${router.id}`}>
      <span id={`routing-${router.id}`}>{texte.routingtabelle}</span>
      {bearbeitbar && (
        <Umschalter<'automatisch' | 'manuell'>
          name={`routing-modus-${router.id}`}
          beschriftung={texte.routingModus}
          optionen={[
            { wert: 'automatisch', text: texte.routingAutomatisch },
            { wert: 'manuell', text: texte.routingManuell },
          ]}
          wert={modus}
          onChange={(m) =>
            setzeRouting(router.id, {
              modus: m,
              // Beim ersten Wechsel zu „von Hand“ mit der automatischen Tabelle starten.
              tabelle: m === 'manuell' && tabelle.length === 0 ? automatisch.map(alsEintrag) : tabelle,
            })
          }
        />
      )}
      <p className={styles.hinweisKlein}>
        {modus === 'automatisch' ? texte.routingAutomatischHinweis : texte.routingManuellHinweis}
      </p>

      {modus === 'automatisch' || !bearbeitbar ? (
        <table className={styles.dnsTabelle}>
          <thead>
            <tr>
              <th scope="col">{texte.zielnetz}</th>
              <th scope="col">{texte.ueber}</th>
              <th scope="col">{texte.anschluss}</th>
            </tr>
          </thead>
          <tbody>
            {(modus === 'automatisch' ? automatisch.map(alsEintrag) : tabelle).map((e, i) => (
              <tr key={i}>
                <td>
                  <code>
                    {e.ziel}/{maskeKurz(e.subnetzmaske)}
                  </code>
                </td>
                <td>{e.gateway ? <code>{e.gateway}</code> : texte.direkt}</td>
                <td>{gegenueber(netz, router.id, e.leitungId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {tabelle.length === 0 && <p className={styles.wert}>{texte.routingLeer}</p>}
          {tabelle.map((e, i) => (
            <fieldset key={i} className={styles.dienst}>
              <legend className="visuell-versteckt">{`Route ${i + 1}`}</legend>
              <div className={styles.zeile}>
                <Textfeld
                  key={`z-${i}-${e.ziel}`}
                  klasse={`${styles.feld} ${styles.wachsen}`}
                  beschriftung={`${texte.zielnetz} ${i + 1}`}
                  wert={e.ziel}
                  inputMode="decimal"
                  spellCheck={false}
                  onUebernehmen={(w) => aendereZeile(i, 'ziel', w)}
                />
                <Textfeld
                  key={`m-${i}-${e.subnetzmaske}`}
                  klasse={`${styles.feld} ${styles.wachsen}`}
                  beschriftung={`${texte.maskeKurz} ${i + 1}`}
                  wert={e.subnetzmaske}
                  inputMode="decimal"
                  spellCheck={false}
                  onUebernehmen={(w) => aendereZeile(i, 'subnetzmaske', w)}
                />
              </div>
              <div className={styles.zeile}>
                <Textfeld
                  key={`g-${i}-${e.gateway}`}
                  klasse={`${styles.feld} ${styles.wachsen}`}
                  beschriftung={`${texte.ueber} ${i + 1}`}
                  wert={e.gateway}
                  placeholder={texte.direkt}
                  inputMode="decimal"
                  spellCheck={false}
                  onUebernehmen={(w) => aendereZeile(i, 'gateway', w)}
                />
                <label className={`${styles.feld} ${styles.wachsen}`}>
                  <span>{`${texte.anschluss} ${i + 1}`}</span>
                  <select
                    value={e.leitungId}
                    onChange={(ev) => aendereZeile(i, 'leitungId', ev.target.value)}
                  >
                    {leitungen.map((l) => (
                      <option key={l.id} value={l.id}>
                        {gegenueber(netz, router.id, l.id)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {probleme[i]!.length > 0 && (
                <p className={styles.hinweisKlein}>
                  <span aria-hidden="true">⚠ </span>
                  {probleme[i]!.map((p) => routingEintragTexte[p]).join(', ')}
                </p>
              )}
              <button
                type="button"
                className={styles.klein}
                onClick={() => aendere(tabelle.filter((_, j) => j !== i))}
              >
                {texte.routeEntfernen(i + 1)}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className={styles.installieren}
            onClick={() =>
              aendere([
                ...tabelle,
                { ziel: '', subnetzmaske: '255.255.255.0', gateway: '', leitungId: leitungen[0]?.id ?? '' },
              ])
            }
          >
            + {texte.routeHinzufuegen}
          </button>
          <button
            type="button"
            className={styles.installieren}
            onClick={() => aendere(automatisch.map(alsEintrag))}
          >
            ↺ {texte.routingUebernehmen}
          </button>
        </>
      )}
    </section>
  );
}
