import { useState } from 'react';
import { geraeteTexte, leitungsTexte } from '../content/geraete';
import { texte } from '../content/texte';
import type { Geraet, LeitungsArt, NetzDatei } from '../model/datei';
import { geraeteKatalog } from '../model/geraete';
import { findeGeraet, leitungenVon } from '../model/netz';
import { useApp } from './store';
import styles from './Eigenschaften.module.css';

/** Seitenleiste mit Details zur Auswahl. Bietet auch das Verbinden per Tastatur an (ohne Ziehen). */
export function Eigenschaften() {
  const netz = useApp((z) => z.netz);
  const auswahl = useApp((z) => z.auswahl);
  const bearbeitbar = useApp((z) => z.modus === 'aufbauen');
  if (!auswahl) {
    // Auf breiten Bildschirmen bleibt das Panel stehen (kein Springen des Layouts), sonst per CSS ausgeblendet.
    return (
      <aside className={styles.panel} data-leer aria-labelledby="eigenschaften-titel">
        <h2 id="eigenschaften-titel" className={styles.titel}>
          {texte.eigenschaften}
        </h2>
        <p className={styles.wert}>{texte.nichtsAusgewaehlt}</p>
      </aside>
    );
  }

  const inhalt =
    auswahl.art === 'geraet' ? (
      (() => {
        const g = findeGeraet(netz, auswahl.id);
        // key: Formular beim Wechsel des Geräts zurücksetzen.
        return g && <GeraetDetails key={g.id} geraet={g} netz={netz} bearbeitbar={bearbeitbar} />;
      })()
    ) : (
      <LeitungDetails id={auswahl.id} netz={netz} bearbeitbar={bearbeitbar} />
    );

  return (
    <aside className={styles.panel} aria-labelledby="eigenschaften-titel">
      <div className={styles.kopf}>
        <h2 id="eigenschaften-titel" className={styles.titel}>
          {texte.eigenschaften}
        </h2>
        <button type="button" className={styles.schliessen} onClick={() => useApp.getState().waehle(null)}>
          <span aria-hidden="true">×</span>
          <span className="visuell-versteckt">{texte.auswahlAufheben}</span>
        </button>
      </div>
      {inhalt}
    </aside>
  );
}

function GeraetDetails({
  geraet,
  netz,
  bearbeitbar,
}: {
  geraet: Geraet;
  netz: NetzDatei;
  bearbeitbar: boolean;
}) {
  const { umbenennen, entferne, verbinde, waehle } = useApp.getState();
  const verbindungsart = useApp((z) => z.verbindungsart);
  const [name, setzeName] = useState(geraet.name);
  const [ziel, setzeZiel] = useState('');
  // Geräte ohne Kabelanschluss (Smartphone) starten direkt mit WLAN.
  const [art, setzeArt] = useState<LeitungsArt>(
    geraeteKatalog[geraet.typ].maxKabel === 0 ? 'wlan' : verbindungsart,
  );

  const namePruefen = () => {
    const neu = name.trim();
    if (neu && neu !== geraet.name) umbenennen(geraet.id, neu);
    else setzeName(geraet.name);
  };

  const leitungen = leitungenVon(netz, geraet.id);
  const andere = netz.geraete.filter((g) => g.id !== geraet.id);

  return (
    <div className={styles.inhalt}>
      <label className={styles.feld}>
        <span>{texte.name}</span>
        <input
          value={name}
          disabled={!bearbeitbar}
          maxLength={40}
          onChange={(e) => setzeName(e.target.value)}
          onBlur={namePruefen}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>

      <div className={styles.feld}>
        <span>{texte.geraetetyp}</span>
        <p className={styles.wert}>
          <strong>{geraeteTexte[geraet.typ].name}</strong> – {geraeteTexte[geraet.typ].beschreibung}
        </p>
      </div>

      <section className={styles.feld} aria-label={texte.leitungen}>
        <span>{texte.leitungen}</span>
        {leitungen.length === 0 ? (
          <p className={styles.wert}>{texte.keineLeitungen}</p>
        ) : (
          <ul className={styles.leitungsliste}>
            {leitungen.map((l) => {
              const gegenueber = findeGeraet(netz, l.von === geraet.id ? l.nach : l.von);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => waehle({ art: 'leitung', id: l.id })}
                  >
                    {leitungsTexte[l.art].name} → {gegenueber?.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {bearbeitbar && andere.length > 0 && (
        <form
          className={styles.feld}
          onSubmit={(e) => {
            e.preventDefault();
            if (ziel && verbinde(geraet.id, ziel, art)) setzeZiel('');
          }}
        >
          <span id="verbinden-titel">{texte.verbindenMit}</span>
          <div className={styles.zeile}>
            <select
              aria-labelledby="verbinden-titel"
              value={ziel}
              onChange={(e) => setzeZiel(e.target.value)}
            >
              <option value="">{texte.bitteWaehlen}</option>
              {andere.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              aria-label={texte.verbindenPer}
              value={art}
              onChange={(e) => setzeArt(e.target.value as LeitungsArt)}
            >
              <option value="kabel">{leitungsTexte.kabel.name}</option>
              <option value="wlan">{leitungsTexte.wlan.name}</option>
            </select>
          </div>
          <button type="submit" disabled={!ziel}>
            {texte.verbinden}
          </button>
        </form>
      )}

      {bearbeitbar && (
        <button
          type="button"
          className={styles.entfernen}
          onClick={() => entferne({ art: 'geraet', id: geraet.id })}
        >
          {texte.geraetEntfernen}
        </button>
      )}
    </div>
  );
}

function LeitungDetails({ id, netz, bearbeitbar }: { id: string; netz: NetzDatei; bearbeitbar: boolean }) {
  const leitung = netz.leitungen.find((l) => l.id === id);
  if (!leitung) return null;
  const a = findeGeraet(netz, leitung.von);
  const b = findeGeraet(netz, leitung.nach);
  return (
    <div className={styles.inhalt}>
      <div className={styles.feld}>
        <span>{leitungsTexte[leitung.art].name}</span>
        <p className={styles.wert}>
          <strong>{texte.leitungZwischen(a?.name ?? '?', b?.name ?? '?')}</strong>
        </p>
        <p className={styles.wert}>{leitungsTexte[leitung.art].beschreibung}</p>
      </div>
      {bearbeitbar && (
        <button
          type="button"
          className={styles.entfernen}
          onClick={() => useApp.getState().entferne({ art: 'leitung', id })}
        >
          {texte.leitungEntfernen}
        </button>
      )}
    </div>
  );
}
