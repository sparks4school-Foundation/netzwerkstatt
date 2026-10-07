import { useState } from 'react';
import { adressProblemText, sendeFehlerText } from '../content/meldungen';
import { geraeteTexte, leitungsTexte } from '../content/geraete';
import { texte } from '../content/texte';
import type { Geraet, LeitungsArt, NetzDatei } from '../model/datei';
import { dnsServerVorschlag, hatDienst } from '../model/dienste';
import { geraeteKatalog } from '../model/geraete';
import { adresseVon, adressProbleme, gatewayVorschlag, hatIpAdresse, ipVorschlag } from '../model/adressen';
import { istPrivat } from '../model/ip';
import { findeGeraet, leitungenVon } from '../model/netz';
import { stufenKonfiguration } from '../stufen';
import { DiensteAbschnitt } from './DiensteAbschnitt';
import { RouterEinstellungen } from './RouterEinstellungen';
import { useSim } from './simStore';
import { Textfeld } from './Textfeld';
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
  const [ziel, setzeZiel] = useState('');
  // Geräte ohne Kabelanschluss (Smartphone) starten direkt mit WLAN.
  const [art, setzeArt] = useState<LeitungsArt>(
    geraeteKatalog[geraet.typ].maxKabel === 0 ? 'wlan' : verbindungsart,
  );

  const leitungen = leitungenVon(netz, geraet.id);
  const andere = netz.geraete.filter((g) => g.id !== geraet.id);

  return (
    <div className={styles.inhalt}>
      <Textfeld
        key={`name-${geraet.name}`}
        klasse={styles.feld}
        beschriftung={texte.name}
        wert={geraet.name}
        disabled={!bearbeitbar}
        maxLength={40}
        onUebernehmen={(neu) => neu && umbenennen(geraet.id, neu)}
      />

      <div className={styles.feld}>
        <span>{texte.geraetetyp}</span>
        <p className={styles.wert}>
          <strong>{geraeteTexte[geraet.typ].name}</strong> – {geraeteTexte[geraet.typ].beschreibung}
        </p>
      </div>

      {bearbeitbar ? (
        <>
          <NetzwerkEinstellungen geraet={geraet} netz={netz} />
          <DiensteAbschnitt geraet={geraet} />
        </>
      ) : (
        <>
          {hatDienst(geraet, 'browser') && (
            <button
              type="button"
              className={styles.senden}
              onClick={() => useSim.getState().oeffneBrowser(geraet.id)}
            >
              <span aria-hidden="true">🌐 </span>
              {texte.browserOeffnen}
            </button>
          )}
          <NachrichtSenden geraet={geraet} />
          <Empfangspuffer geraetId={geraet.id} />
        </>
      )}

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
      <label className={styles.ankreuzen}>
        <input
          type="checkbox"
          checked={!!leitung.ausgefallen}
          onChange={(e) => {
            useApp.getState().setzeLeitungAusgefallen(id, e.target.checked);
            // Während der Simulation wirkt die Störung sofort.
            useSim.getState().leitungAusfallen(id, e.target.checked);
          }}
        />
        <span>{texte.leitungAusgefallen}</span>
      </label>
      <p className={styles.hinweisKlein}>{texte.leitungAusgefallenHinweis}</p>
      {stufenKonfiguration[netz.stufe].zeigeRoutingtabelle && (
        <>
          <label className={styles.feld}>
            <span>{texte.stoerung}</span>
            <select
              value={leitung.verlust ?? 0}
              onChange={(e) => {
                const verlust = Number(e.target.value);
                useApp.getState().setzeLeitung(id, { verlust });
                useSim.getState().leitungAendern(id, { verlust });
              }}
            >
              {[0, 10, 25, 50, 100].map((p) => (
                <option key={p} value={p}>
                  {texte.verlustProzent(p)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.feld}>
            <span>{texte.laufzeit}</span>
            <select
              value={leitung.verzoegerung ?? 1}
              onChange={(e) => {
                const verzoegerung = Number(e.target.value);
                useApp.getState().setzeLeitung(id, { verzoegerung });
                useSim.getState().leitungAendern(id, { verzoegerung });
              }}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {texte.laufzeitText(n)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
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

/** IP-Adresse (und ab Klasse 11 Subnetzmaske und Gateway) eines Geräts bearbeiten. */
function NetzwerkEinstellungen({ geraet, netz }: { geraet: Geraet; netz: NetzDatei }) {
  const { setzeNetzwerk } = useApp.getState();
  const zeigeMaske = stufenKonfiguration[netz.stufe].zeigeSubnetzmaske;
  const probleme = adressProbleme(netz).get(geraet.id) ?? [];

  if (geraet.typ === 'router') return <RouterEinstellungen router={geraet} netz={netz} bearbeitbar />;
  if (!hatIpAdresse(geraet)) return <p className={styles.wert}>{texte.ipNichtNoetig}</p>;
  const eigene = adresseVon(geraet);
  const dhcpSchalter = zeigeMaske && (
    <label className={styles.ankreuzen}>
      <input
        type="checkbox"
        checked={!!geraet.dhcp}
        onChange={(e) => useApp.getState().setzeNetzwerk(geraet.id, { dhcp: e.target.checked })}
      />
      <span>{texte.dhcpAutomatisch}</span>
    </label>
  );
  if (geraet.dhcp && zeigeMaske) {
    return (
      <div className={styles.inhalt}>
        {dhcpSchalter}
        <p className={styles.hinweisKlein}>{texte.dhcpHinweis}</p>
      </div>
    );
  }

  return (
    <div className={styles.inhalt}>
      {dhcpSchalter}
      <div className={styles.zeile}>
        <Textfeld
          key={`ip-${geraet.ip}`}
          klasse={`${styles.feld} ${styles.wachsen}`}
          beschriftung={texte.ipAdresse}
          wert={geraet.ip ?? ''}
          placeholder={texte.ipBeispiel}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={probleme.some((p) => p.art === 'ip-ungueltig') || undefined}
          onUebernehmen={(ip) => setzeNetzwerk(geraet.id, { ip })}
        />
        <button
          type="button"
          className={styles.vorschlag}
          title={texte.ipVorschlagBeschreibung}
          aria-label={texte.ipVorschlagBeschreibung}
          onClick={() => setzeNetzwerk(geraet.id, { ip: ipVorschlag(netz, geraet.id) })}
        >
          {texte.ipVorschlag}
        </button>
      </div>
      {zeigeMaske && eigene && (
        <p
          className={styles.hinweisKlein}
          title={istPrivat(eigene.ip) ? texte.privatBeschreibung : texte.oeffentlichBeschreibung}
        >
          <strong>{istPrivat(eigene.ip) ? texte.privat : texte.oeffentlich}</strong>
          {' – '}
          {istPrivat(eigene.ip) ? texte.privatBeschreibung : texte.oeffentlichBeschreibung}
        </p>
      )}
      {zeigeMaske && (
        <>
          <Textfeld
            key={`maske-${geraet.subnetzmaske}`}
            klasse={styles.feld}
            beschriftung={texte.subnetzmaske}
            wert={geraet.subnetzmaske ?? ''}
            placeholder="255.255.255.0"
            inputMode="decimal"
            spellCheck={false}
            onUebernehmen={(subnetzmaske) => setzeNetzwerk(geraet.id, { subnetzmaske })}
          />
          <div className={styles.zeile}>
            <Textfeld
              key={`gateway-${geraet.gateway}`}
              klasse={`${styles.feld} ${styles.wachsen}`}
              beschriftung={texte.gateway}
              wert={geraet.gateway ?? ''}
              placeholder="192.168.0.1"
              inputMode="decimal"
              spellCheck={false}
              aria-invalid={probleme.some((p) => p.art.startsWith('gateway')) || undefined}
              onUebernehmen={(gateway) => setzeNetzwerk(geraet.id, { gateway })}
            />
            <button
              type="button"
              className={styles.vorschlag}
              title={texte.gatewayVorschlagBeschreibung}
              aria-label={texte.gatewayVorschlagBeschreibung}
              disabled={!gatewayVorschlag(netz, geraet.id)}
              onClick={() => setzeNetzwerk(geraet.id, { gateway: gatewayVorschlag(netz, geraet.id) })}
            >
              {texte.ipVorschlag}
            </button>
          </div>
        </>
      )}
      <div className={styles.zeile}>
        <Textfeld
          key={`dns-${geraet.dnsServer}`}
          klasse={`${styles.feld} ${styles.wachsen}`}
          beschriftung={texte.dnsServer}
          title={texte.dnsServerBeschreibung}
          wert={geraet.dnsServer ?? ''}
          placeholder="192.168.0.3"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={probleme.some((p) => p.art === 'dns-ungueltig') || undefined}
          onUebernehmen={(dnsServer) => setzeNetzwerk(geraet.id, { dnsServer })}
        />
        <button
          type="button"
          className={styles.vorschlag}
          title={texte.dnsVorschlagBeschreibung}
          aria-label={texte.dnsVorschlagBeschreibung}
          disabled={!dnsServerVorschlag(netz, geraet.id)}
          onClick={() => setzeNetzwerk(geraet.id, { dnsServer: dnsServerVorschlag(netz, geraet.id) })}
        >
          {texte.ipVorschlag}
        </button>
      </div>
      {probleme.length > 0 && (
        <ul className={styles.probleme} aria-label={texte.probleme}>
          {probleme.map((p, i) => (
            <li key={i}>
              <span aria-hidden="true">⚠ </span>
              {adressProblemText(p)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Im Modus „Ausprobieren“: Nachricht von diesem Gerät an eine IP-Adresse schicken. */
function NachrichtSenden({ geraet }: { geraet: Geraet }) {
  const netz = useApp((z) => z.netz);
  const melde = useApp((z) => z.melde);
  const [zielIp, setzeZielIp] = useState('');
  const [text, setzeText] = useState<string>(texte.nachrichtStandard);
  const [inPaketen, setzeInPaketen] = useState(false);
  const [zeichen, setzeZeichen] = useState(4);
  const mitPaketen = stufenKonfiguration[netz.stufe].zeigeRoutingtabelle;
  // Eigene Adresse aus der Simulation (DHCP-Clients bekommen sie erst dort)
  const simIp = useSim((z) => {
    const g = z.sim?.netz.geraete.find((x) => x.id === geraet.id);
    return g && !g.dhcp && g.ip ? g.ip : null;
  });
  if (geraet.typ === 'router') return <RouterEinstellungen router={geraet} netz={netz} bearbeitbar={false} />;
  if (!hatIpAdresse(geraet)) return <p className={styles.wert}>{texte.ipNichtNoetig}</p>;
  const andere = netz.geraete.filter((g) => g.id !== geraet.id && g.ip && hatIpAdresse(g));

  return (
    <form
      className={styles.inhalt}
      onSubmit={(e) => {
        e.preventDefault();
        const ergebnis =
          mitPaketen && inPaketen
            ? useSim.getState().inPaketenSenden(geraet.id, zielIp, text || texte.langerText, zeichen)
            : useSim.getState().senden(geraet.id, zielIp, text || texte.nachrichtStandard);
        if (!ergebnis.ok) melde(sendeFehlerText(ergebnis, geraet.name, zielIp.trim()), 'fehler');
      }}
    >
      {geraet.dhcp && <DhcpHolen geraetId={geraet.id} />}
      <p className={styles.wert}>{texte.eigeneIp(simIp ?? texte.keineIp)}</p>
      <h3 className={styles.untertitel}>{texte.nachrichtSenden}</h3>
      <label className={styles.feld}>
        <span>{texte.anIpAdresse}</span>
        <input
          value={zielIp}
          onChange={(e) => setzeZielIp(e.target.value)}
          placeholder={texte.ipBeispiel}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          list="ziel-ips"
        />
        {/* Vorschläge: IP-Adressen der anderen Geräte (mit Namen). */}
        <datalist id="ziel-ips">
          {andere.map((g) => (
            <option key={g.id} value={g.ip}>
              {g.name}
            </option>
          ))}
        </datalist>
      </label>
      {mitPaketen && (
        <label className={styles.ankreuzen}>
          <input
            type="checkbox"
            checked={inPaketen}
            onChange={(e) => {
              setzeInPaketen(e.target.checked);
              if (e.target.checked && text === texte.nachrichtStandard) setzeText(texte.langerText);
            }}
          />
          <span>{texte.inPaketenSenden}</span>
        </label>
      )}
      <label className={styles.feld}>
        <span>{texte.nachrichtText}</span>
        {mitPaketen && inPaketen ? (
          <textarea
            value={text}
            maxLength={200}
            rows={3}
            aria-label={texte.nachrichtText}
            onChange={(e) => setzeText(e.target.value)}
          />
        ) : (
          <input value={text} maxLength={40} onChange={(e) => setzeText(e.target.value)} />
        )}
      </label>
      {mitPaketen && inPaketen && (
        <label className={styles.feld}>
          <span>{texte.zeichenProPaket}</span>
          <input
            type="number"
            min={1}
            max={40}
            value={zeichen}
            onChange={(e) => setzeZeichen(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
          />
        </label>
      )}
      <button type="submit" className={styles.senden} disabled={!zielIp.trim()}>
        <span aria-hidden="true">✉ </span>
        {texte.senden}
      </button>
    </form>
  );
}

/** Empfangspuffer (Neuzusammensetzung) und Sendestatus zerlegter Nachrichten an diesem Gerät. */
function Empfangspuffer({ geraetId }: { geraetId: string }) {
  const sim = useSim((z) => z.sim);
  useSim((z) => z.version);
  if (!sim) return null;
  const empfangen = sim.empfangspuffer(geraetId);
  const gesendet = sim.sendungenVon(geraetId);
  if (empfangen.length === 0 && gesendet.length === 0) return null;
  return (
    <>
      {empfangen.map((p) => (
        <section key={p.sendungId} className={styles.feld} aria-label={texte.empfangeneTeile}>
          <span>{texte.empfangeneTeile}</span>
          <ol className={styles.puffer}>
            {p.teile.map((t, i) => (
              <li key={i} data-fehlt={t === null || undefined}>
                <span className={styles.pufferNr}>{i + 1}</span>
                <span className={styles.pufferInhalt}>
                  {t === null ? (
                    <>
                      <span aria-hidden="true">✕ </span>
                      {texte.teilFehlt}
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">✓ </span>„{t}“
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.hinweisKlein}>{texte.ankunftReihenfolge(p.ankunft.join(', ') || '–')}</p>
          <p className={styles.wert}>
            <strong>{texte.zusammengesetzt}:</strong>{' '}
            {p.text === null ? texte.nochUnvollstaendig : `„${p.text}“`}
          </p>
        </section>
      ))}
      {gesendet.map((s) => (
        <section key={s.sendungId} className={styles.feld} aria-label={texte.gesendeteTeile}>
          <span>{texte.gesendeteTeile}</span>
          <p className={styles.wert}>
            {texte.bestaetigtVon(s.bestaetigt.length, s.teile.length)}
            {s.aufgegeben && ` – ${texte.aufgegeben}`}
          </p>
        </section>
      ))}
    </>
  );
}

function DhcpHolen({ geraetId }: { geraetId: string }) {
  const zustand = useSim((z) => z.sim?.dhcpZustand(geraetId));
  useSim((z) => z.version);
  return (
    <div className={styles.feld}>
      <button
        type="button"
        className={styles.senden}
        disabled={zustand?.phase === 'suche' || zustand?.phase === 'anfrage'}
        onClick={() => useSim.getState().dhcpAnfordern(geraetId)}
      >
        <span aria-hidden="true">🏷 </span>
        {texte.dhcpHolen}
      </button>
      {zustand && (
        <p className={styles.hinweisKlein} role="status">
          {zustand.phase === 'fehler' && <span aria-hidden="true">⚠ </span>}
          {texte.dhcpStatus[zustand.phase]}
          {zustand.phase === 'fertig' && `: ${zustand.angebot.ip}`}
        </p>
      )}
    </div>
  );
}
