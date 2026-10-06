import { useEffect, useRef, useState } from 'react';
import { browserFehlerText } from '../content/meldungen';
import { texte } from '../content/texte';
import { adresseAlsText, linkZiel, type Adresse } from '../model/domain';
import type { BrowserZustand } from '../sim/simulation';
import { LINK_NACHRICHT, seitenDokument } from './seitenDokument';
import { useSim } from './simStore';
import styles from './BrowserFenster.module.css';

/**
 * Einfacher Browser im Simulator (TK 5). Zeigt, was der Browser gerade tut (DNS fragen, Seite laden)
 * und am Ende die Seite – in einem iframe ohne Skripte und ohne Zugriff nach außen.
 */
export function BrowserFenster() {
  const geraetId = useSim((z) => z.browserGeraet);
  const sim = useSim((z) => z.sim);
  useSim((z) => z.version);
  const zustand = geraetId ? sim?.browser(geraetId) : undefined;
  const geraet = sim?.netz.geraete.find((g) => g.id === geraetId);
  const [eingabe, setzeEingabe] = useState('');
  const feld = useRef<HTMLInputElement>(null);

  // Adresszeile zeigt nach dem Laden die aufgelöste Adresse (wie ein echter Browser).
  const angezeigt = zustand?.adresse ? adresseAlsText(zustand.adresse) : zustand?.eingabe;
  const [zuletztAngezeigt, setzeZuletztAngezeigt] = useState(angezeigt);
  if (angezeigt !== zuletztAngezeigt) {
    // Zustand während des Renderns anpassen (React-Muster statt Effekt).
    setzeZuletztAngezeigt(angezeigt);
    if (angezeigt) setzeEingabe(angezeigt);
  }
  useEffect(() => {
    if (geraetId) feld.current?.focus();
  }, [geraetId]);

  if (!sim || !geraet) return null;
  const aufrufen = (text: string) => useSim.getState().aufrufen(geraet.id, text);

  return (
    <section className={styles.fenster} aria-label={texte.browserVon(geraet.name)}>
      <div className={styles.titelzeile}>
        <h2 className={styles.titel}>
          <span aria-hidden="true">🌐 </span>
          {texte.browserVon(geraet.name)}
        </h2>
        <button
          type="button"
          className={styles.schliessen}
          aria-label={texte.schliessen}
          onClick={() => useSim.getState().oeffneBrowser(null)}
        >
          ×
        </button>
      </div>
      <form
        className={styles.adresszeile}
        onSubmit={(e) => {
          e.preventDefault();
          if (eingabe.trim()) aufrufen(eingabe);
        }}
      >
        <label className="visuell-versteckt" htmlFor="browser-adresse">
          {texte.adresszeile}
        </label>
        <input
          id="browser-adresse"
          ref={feld}
          value={eingabe}
          onChange={(e) => setzeEingabe(e.target.value)}
          placeholder={texte.domainBeispiel}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit">{texte.aufrufen}</button>
      </form>
      <div className={styles.inhalt} aria-live="polite">
        <Inhalt zustand={zustand} geraetName={geraet.name} onLink={aufrufen} />
      </div>
    </section>
  );
}

function Inhalt({
  zustand,
  geraetName,
  onLink,
}: {
  zustand: BrowserZustand | undefined;
  geraetName: string;
  onLink: (adresse: string) => void;
}) {
  if (!zustand) return <p className={styles.hinweis}>{texte.browserLeer}</p>;
  switch (zustand.phase) {
    case 'dns':
      return <p className={styles.status}>{texte.browserDns(zustand.adresse.host, zustand.dnsIp)}</p>;
    case 'laden':
      return <p className={styles.status}>{texte.browserLaden(zustand.ip)}</p>;
    case 'fehler': {
      const { titel, text } = browserFehlerText(zustand.fehler, geraetName);
      return (
        <div className={styles.fehler} role="alert">
          <h3>
            <span aria-hidden="true">⚠ </span>
            {titel}
          </h3>
          <p>{text}</p>
        </div>
      );
    }
    case 'fertig':
      if (zustand.status === 404) {
        return (
          <div className={styles.fehler}>
            <h3>
              <span aria-hidden="true">⚠ </span>
              {texte.seiteNichtGefunden}
            </h3>
            <p>{texte.seiteNichtGefundenText(zustand.adresse.pfad)}</p>
          </div>
        );
      }
      return <Seite html={zustand.html} adresse={zustand.adresse} onLink={onLink} />;
  }
}

/**
 * Die Seite selbst – in einem isolierten iframe (`allow-scripts` OHNE `allow-same-origin`): Es kann weder
 * auf die App noch nach außen zugreifen. Link-Klicks meldet das eingebaute Skript per postMessage;
 * die App schickt sie als neue Anfrage durch die Simulation.
 */
function Seite({ html, adresse, onLink }: { html: string; adresse: Adresse; onLink: (a: string) => void }) {
  const rahmen = useRef<HTMLIFrameElement>(null);
  const [nonce] = useState(() => crypto.randomUUID().replace(/-/g, ''));

  useEffect(() => {
    const empfangen = (e: MessageEvent) => {
      if (e.source !== rahmen.current?.contentWindow) return;
      const daten = e.data as { typ?: string; href?: unknown };
      if (daten?.typ !== LINK_NACHRICHT || typeof daten.href !== 'string' || daten.href.startsWith('#'))
        return;
      onLink(linkZiel(daten.href, adresse));
    };
    window.addEventListener('message', empfangen);
    return () => window.removeEventListener('message', empfangen);
  }, [adresse, onLink]);

  return (
    <iframe
      ref={rahmen}
      className={styles.seite}
      title={adresseAlsText(adresse)}
      sandbox="allow-scripts"
      srcDoc={seitenDokument(html, nonce)}
    />
  );
}
