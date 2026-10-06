import { useState } from 'react';
import { dienstTexte } from '../content/geraete';
import { glossar } from '../content/glossar';
import { dnsEintragTexte } from '../content/meldungen';
import { texte } from '../content/texte';
import type { Dienst, DienstArt, Geraet } from '../model/datei';
import {
  STARTSEITE,
  dienstEntfernen,
  dienstErsetzen,
  dienstInstallieren,
  dnsEintragProbleme,
  installierbareDienste,
} from '../model/dienste';
import { HtmlEditor } from './HtmlEditor';
import { useApp } from './store';
import styles from './Eigenschaften.module.css';

/** Dienste eines Geräts installieren, entfernen und einrichten (Webseiten, DNS-Tabelle). */
export function DiensteAbschnitt({ geraet }: { geraet: Geraet }) {
  const setzeDienste = useApp((z) => z.setzeDienste);
  const installierbar = installierbareDienste(geraet.typ);
  if (installierbar.length === 0) return null;
  const installiert = geraet.dienste ?? [];
  const fehlend = installierbar.filter((art) => !installiert.some((d) => d.art === art));
  const ersetzen = (d: Dienst) => setzeDienste(geraet.id, dienstErsetzen(geraet, d));

  return (
    <section className={styles.feld} aria-labelledby={`dienste-${geraet.id}`}>
      <span id={`dienste-${geraet.id}`}>{texte.dienste}</span>
      {installiert.length === 0 && <p className={styles.wert}>{texte.keineDienste}</p>}
      <ul className={styles.dienstliste}>
        {installiert.map((d) => {
          const t = dienstTexte[d.art];
          return (
            <li key={d.art} className={styles.dienst}>
              <div className={styles.dienstKopf}>
                <span title={glossar[t.glossar].kurz}>
                  <strong>{t.name}</strong> <span className={styles.rolle}>({t.rolle})</span>
                </span>
                <button
                  type="button"
                  className={styles.klein}
                  aria-label={texte.deinstallieren(t.name)}
                  onClick={() => setzeDienste(geraet.id, dienstEntfernen(geraet, d.art))}
                >
                  ×
                </button>
              </div>
              {d.art === 'webserver' && <Webseiten geraet={geraet} dienst={d} onAendern={ersetzen} />}
              {d.art === 'dns-server' && <DnsTabelle dienst={d} onAendern={ersetzen} />}
            </li>
          );
        })}
      </ul>
      {fehlend.map((art: DienstArt) => (
        <button
          key={art}
          type="button"
          className={styles.installieren}
          title={dienstTexte[art].beschreibung}
          onClick={() => setzeDienste(geraet.id, dienstInstallieren(geraet, art))}
        >
          + {texte.installieren(dienstTexte[art].name)}
        </button>
      ))}
    </section>
  );
}

function Webseiten({
  geraet,
  dienst,
  onAendern,
}: {
  geraet: Geraet;
  dienst: Extract<Dienst, { art: 'webserver' }>;
  onAendern: (d: Dienst) => void;
}) {
  const [bearbeitet, setzeBearbeitet] = useState<string | null>(null);
  const seite = dienst.seiten.find((s) => s.pfad === bearbeitet);
  const pfade = dienst.seiten.map((s) => s.pfad);

  const neueSeite = () => {
    let n = 2;
    while (pfade.includes(texte.neueSeitePfad(n))) n++;
    const pfad = texte.neueSeitePfad(n);
    onAendern({
      ...dienst,
      seiten: [
        ...dienst.seiten,
        { pfad, html: `<h1>Neue Seite</h1>\n<p><a href="/">Zur Startseite</a></p>\n` },
      ],
    });
    setzeBearbeitet(pfad);
  };

  return (
    <div className={styles.unterliste}>
      <span className={styles.unterTitel}>{texte.seiten}</span>
      <ul>
        {dienst.seiten.map((s) => (
          <li key={s.pfad} className={styles.zeileKlein}>
            <code>{s.pfad}</code>
            {s.pfad === STARTSEITE && <span className={styles.rolle}> ({texte.startseite})</span>}
            <span className={styles.abstand} />
            <button
              type="button"
              className={styles.klein}
              aria-label={texte.seiteBearbeiten(s.pfad)}
              onClick={() => setzeBearbeitet(s.pfad)}
            >
              {texte.bearbeiten}
            </button>
            {s.pfad !== STARTSEITE && (
              <button
                type="button"
                className={styles.klein}
                aria-label={texte.seiteEntfernen(s.pfad)}
                onClick={() =>
                  onAendern({ ...dienst, seiten: dienst.seiten.filter((x) => x.pfad !== s.pfad) })
                }
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.installieren} onClick={neueSeite}>
        + {texte.seiteHinzufuegen}
      </button>
      {seite && (
        <HtmlEditor
          titel={texte.htmlEditorTitel(seite.pfad, geraet.name)}
          pfad={seite.pfad}
          html={seite.html}
          pfadAenderbar={seite.pfad !== STARTSEITE}
          belegtePfade={pfade}
          onUebernehmen={(pfad, html) =>
            onAendern({
              ...dienst,
              seiten: dienst.seiten.map((x) => (x.pfad === seite.pfad ? { pfad, html } : x)),
            })
          }
          onSchliessen={() => setzeBearbeitet(null)}
        />
      )}
    </div>
  );
}

function DnsTabelle({
  dienst,
  onAendern,
}: {
  dienst: Extract<Dienst, { art: 'dns-server' }>;
  onAendern: (d: Dienst) => void;
}) {
  const probleme = dnsEintragProbleme(dienst.eintraege);
  const aendere = (i: number, feld: 'domain' | 'ip', wert: string) => {
    if (dienst.eintraege[i]?.[feld] === wert) return;
    onAendern({
      ...dienst,
      eintraege: dienst.eintraege.map((e, j) => (j === i ? { ...e, [feld]: wert } : e)),
    });
  };

  return (
    <div className={styles.unterliste}>
      <span className={styles.unterTitel}>{texte.dnsTabelle}</span>
      {dienst.eintraege.length === 0 && <p className={styles.wert}>{texte.dnsKeineEintraege}</p>}
      {dienst.eintraege.length > 0 && (
        <table className={styles.dnsTabelle}>
          <thead>
            <tr>
              <th scope="col">{texte.domain}</th>
              <th scope="col">{texte.ipAdresse}</th>
              <th scope="col">
                <span className="visuell-versteckt">{texte.entfernen}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dienst.eintraege.map((e, i) => (
              <tr key={i}>
                <td>
                  <input
                    key={`d-${i}-${e.domain}`}
                    defaultValue={e.domain}
                    placeholder={texte.domainBeispiel}
                    aria-label={`${texte.domain} ${i + 1}`}
                    aria-invalid={probleme[i]?.some((p) => p !== 'ip-ungueltig') || undefined}
                    spellCheck={false}
                    autoCapitalize="off"
                    onBlur={(ev) => aendere(i, 'domain', ev.target.value.trim())}
                    onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                  />
                </td>
                <td>
                  <input
                    key={`i-${i}-${e.ip}`}
                    defaultValue={e.ip}
                    placeholder="192.168.0.2"
                    inputMode="decimal"
                    aria-label={`${texte.ipAdresse} ${i + 1}`}
                    aria-invalid={probleme[i]?.includes('ip-ungueltig') || undefined}
                    spellCheck={false}
                    onBlur={(ev) => aendere(i, 'ip', ev.target.value.trim())}
                    onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.klein}
                    aria-label={texte.eintragEntfernen(e.domain)}
                    onClick={() =>
                      onAendern({ ...dienst, eintraege: dienst.eintraege.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {probleme.some((p) => p.length > 0) && (
        <ul className={styles.probleme}>
          {probleme.flatMap((p, i) =>
            p.map((art) => (
              <li key={`${i}-${art}`}>
                <span aria-hidden="true">⚠ </span>
                {`${i + 1}. ${dnsEintragTexte[art]}`}
              </li>
            )),
          )}
        </ul>
      )}
      <button
        type="button"
        className={styles.installieren}
        onClick={() => onAendern({ ...dienst, eintraege: [...dienst.eintraege, { domain: '', ip: '' }] })}
      >
        + {texte.eintragHinzufuegen}
      </button>
    </div>
  );
}
