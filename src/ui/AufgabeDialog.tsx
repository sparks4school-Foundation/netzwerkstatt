import { useEffect, useRef, useState } from 'react';
import { texte } from '../content/texte';
import type { Aufgabe, Pruefung } from '../model/datei';
import { useApp } from './store';
import styles from './AufgabeDialog.module.css';

const LEER: Aufgabe = {
  titel: '',
  auftrag: '',
  hilfen: [],
  aufbauGesperrt: false,
  blackbox: [],
  pruefungen: [],
};

/** Aufgabenmodus für Lehrkräfte: Aufgabe der Datei erstellen und bearbeiten. */
export function AufgabeDialog() {
  const offen = useApp((z) => z.aufgabeBearbeiten);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (offen && !dialog.current?.open) dialog.current?.showModal();
    if (!offen && dialog.current?.open) dialog.current.close();
  }, [offen]);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="aufgabe-titel"
      onClose={() => useApp.getState().setzeAufgabeBearbeiten(false)}
    >
      {offen && <Formular schliessen={() => dialog.current?.close()} />}
    </dialog>
  );
}

function Formular({ schliessen }: { schliessen: () => void }) {
  const netz = useApp((z) => z.netz);
  const [a, setzeA] = useState<Aufgabe>(netz.aufgabe ?? LEER);
  const endgeraete = netz.geraete.filter((g) => !['switch', 'access-point'].includes(g.typ));
  const hilfen = [0, 1, 2].map((i) => a.hilfen[i] ?? '');
  const setzeHilfe = (i: number, text: string) => {
    const neu = [...hilfen];
    neu[i] = text;
    setzeA({ ...a, hilfen: neu.filter((h, j) => h.trim() || neu.slice(j + 1).some((x) => x.trim())) });
  };
  const setzePruefung = (i: number, p: Pruefung) =>
    setzeA({ ...a, pruefungen: a.pruefungen.map((x, j) => (j === i ? p : x)) });
  const neuePruefung = (art: Pruefung['art'], alt?: Pruefung): Pruefung => {
    const geraetId = (alt && 'geraetId' in alt ? alt.geraetId : endgeraete[0]?.id) ?? '';
    if (art === 'webseite') return { art, geraetId, adresse: '' };
    if (art === 'nachricht') return { art, geraetId, zielIp: '' };
    if (art === 'dhcp') return { art, geraetId };
    return { art };
  };

  return (
    <form
      className={styles.inhalt}
      onSubmit={(e) => {
        e.preventDefault();
        useApp.getState().setzeAufgabe({ ...a, hilfen: a.hilfen.filter((h) => h.trim()) });
        schliessen();
      }}
    >
      <h2 id="aufgabe-titel">{texte.aufgabeBearbeiten}</h2>
      <p className={styles.leise}>{texte.aufgabeDialogEinleitung}</p>

      <label className={styles.feld}>
        <span>{texte.aufgabeTitel}</span>
        <input required value={a.titel} onChange={(e) => setzeA({ ...a, titel: e.target.value })} />
      </label>
      <label className={styles.feld}>
        <span>{texte.aufgabeAuftrag}</span>
        <textarea
          required
          rows={3}
          value={a.auftrag}
          aria-label={texte.aufgabeAuftrag}
          onChange={(e) => setzeA({ ...a, auftrag: e.target.value })}
        />
      </label>
      {hilfen.map((h, i) => (
        <label key={i} className={styles.feld}>
          <span>{texte.aufgabeHilfe(i + 1)}</span>
          <input value={h} onChange={(e) => setzeHilfe(i, e.target.value)} />
        </label>
      ))}

      <label className={styles.ankreuzen}>
        <input
          type="checkbox"
          checked={a.aufbauGesperrt}
          onChange={(e) => setzeA({ ...a, aufbauGesperrt: e.target.checked })}
        />
        <span>{texte.aufgabeAufbauGesperrt}</span>
      </label>

      <fieldset className={styles.gruppe}>
        <legend>{texte.aufgabeBlackbox}</legend>
        <p className={styles.leise}>{texte.aufgabeBlackboxHinweis}</p>
        <div className={styles.auswahl}>
          {endgeraete.map((g) => (
            <label key={g.id} className={styles.ankreuzen}>
              <input
                type="checkbox"
                checked={a.blackbox.includes(g.id)}
                onChange={(e) =>
                  setzeA({
                    ...a,
                    blackbox: e.target.checked ? [...a.blackbox, g.id] : a.blackbox.filter((x) => x !== g.id),
                  })
                }
              />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.gruppe}>
        <legend>{texte.aufgabePruefungen}</legend>
        {a.pruefungen.map((p, i) => (
          <div key={i} className={styles.pruefung}>
            <label className={styles.feld}>
              <span>{`${texte.pruefungArt} (${i + 1})`}</span>
              <select
                aria-label={`${texte.pruefungArt} (${i + 1})`}
                value={p.art}
                onChange={(e) => setzePruefung(i, neuePruefung(e.target.value as Pruefung['art'], p))}
              >
                {(Object.keys(texte.pruefungArten) as Pruefung['art'][]).map((art) => (
                  <option key={art} value={art}>
                    {texte.pruefungArten[art]}
                  </option>
                ))}
              </select>
            </label>
            {'geraetId' in p && (
              <label className={styles.feld}>
                <span>{texte.pruefungGeraet}</span>
                <select
                  aria-label={`${texte.pruefungGeraet} (${i + 1})`}
                  value={p.geraetId}
                  onChange={(e) => setzePruefung(i, { ...p, geraetId: e.target.value })}
                >
                  {endgeraete.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {p.art === 'webseite' && (
              <label className={styles.feld}>
                <span>{texte.pruefungAdresse}</span>
                <input
                  required
                  value={p.adresse}
                  placeholder={texte.domainBeispiel}
                  onChange={(e) => setzePruefung(i, { ...p, adresse: e.target.value })}
                />
              </label>
            )}
            {p.art === 'nachricht' && (
              <label className={styles.feld}>
                <span>{texte.pruefungZielIp}</span>
                <input
                  required
                  value={p.zielIp}
                  placeholder={texte.ipBeispiel}
                  inputMode="decimal"
                  onChange={(e) => setzePruefung(i, { ...p, zielIp: e.target.value })}
                />
              </label>
            )}
            <button
              type="button"
              className={styles.klein}
              onClick={() => setzeA({ ...a, pruefungen: a.pruefungen.filter((_, j) => j !== i) })}
            >
              {texte.pruefungEntfernen(i + 1)}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.klein}
          onClick={() => setzeA({ ...a, pruefungen: [...a.pruefungen, neuePruefung('webseite')] })}
        >
          + {texte.pruefungHinzufuegen}
        </button>
      </fieldset>

      <div className={styles.knoepfe}>
        {useApp.getState().netz.aufgabe && (
          <button
            type="button"
            className={styles.gefahr}
            onClick={() => {
              useApp.getState().setzeAufgabe(undefined);
              schliessen();
            }}
          >
            {texte.aufgabeLoeschen}
          </button>
        )}
        <span className={styles.abstand} />
        <button type="button" onClick={schliessen}>
          {texte.abbrechen}
        </button>
        <button type="submit" className={styles.primaer}>
          {texte.aufgabeSpeichern}
        </button>
      </div>
    </form>
  );
}
