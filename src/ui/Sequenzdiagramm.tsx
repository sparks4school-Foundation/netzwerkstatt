import { useRef } from 'react';
import { paketInhalt, paketKurzname } from '../content/meldungen';
import { texte } from '../content/texte';
import { sequenzdiagramm } from '../sim/sequenz';
import { istAnfrage } from '../sim/simulation';
import { useSim } from './simStore';
import styles from './Sequenzdiagramm.module.css';

const SPALTE = 170;
const KOPF = 56;
const ZEILE = 44;
const RAND = 24;

/**
 * Sequenzdiagramm (UML-nah, vereinfacht): Lebenslinien je Station, Pfeile in zeitlicher Reihenfolge.
 * Anfragen durchgezogen, Antworten gestrichelt (wie in UML), verlorene Pakete enden mit ✕.
 * Bewusst feste, druckfreundliche Farben (schwarz auf weiß) – auch für den Export als Bild.
 */
export function Sequenzdiagramm() {
  const sim = useSim((z) => z.sim);
  useSim((z) => z.version);
  const zwischen = useSim((z) => z.zwischenstationen);
  const svg = useRef<SVGSVGElement>(null);
  if (!sim) return null;

  const { teilnehmer, pfeile } = sequenzdiagramm(sim.protokoll, zwischen);
  const name = (id: string) => sim.netz.geraete.find((g) => g.id === id)?.name ?? id;
  const x = (id: string) => RAND + SPALTE / 2 + teilnehmer.indexOf(id) * SPALTE;
  const breite = Math.max(RAND * 2 + teilnehmer.length * SPALTE, 320);
  const hoehe = KOPF + RAND + Math.max(pfeile.length, 1) * ZEILE + RAND;

  const speichern = () => {
    if (!svg.current) return;
    const quelltext = new XMLSerializer().serializeToString(svg.current);
    const url = URL.createObjectURL(new Blob([quelltext], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sequenzdiagramm.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.rahmen}>
      <div className={styles.leiste}>
        <label className={styles.ankreuzen}>
          <input
            type="checkbox"
            checked={zwischen}
            onChange={(e) => useSim.getState().setzeZwischenstationen(e.target.checked)}
          />
          {texte.zwischenstationen}
        </label>
        <button type="button" onClick={speichern} disabled={pfeile.length === 0}>
          {texte.alsSvgSpeichern}
        </button>
      </div>
      {pfeile.length === 0 ? (
        <p className={styles.leer}>{texte.sequenzLeer}</p>
      ) : (
        <div className={styles.flaeche}>
          <svg
            ref={svg}
            xmlns="http://www.w3.org/2000/svg"
            width={breite}
            height={hoehe}
            viewBox={`0 0 ${breite} ${hoehe}`}
            role="img"
            aria-labelledby="sequenz-titel"
            fontFamily="system-ui, sans-serif"
          >
            <title id="sequenz-titel">{texte.sequenzBeschreibung(pfeile.length, teilnehmer.length)}</title>
            <rect width={breite} height={hoehe} fill="#ffffff" />
            <defs>
              <marker
                id="spitze"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="#14181f" />
              </marker>
            </defs>
            {teilnehmer.map((id) => (
              <g key={id}>
                <rect
                  x={x(id) - 70}
                  y={RAND / 2}
                  width={140}
                  height={32}
                  rx={6}
                  fill="#f3f5f8"
                  stroke="#14181f"
                />
                <text
                  x={x(id)}
                  y={RAND / 2 + 21}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#14181f"
                >
                  {name(id)}
                </text>
                <line
                  x1={x(id)}
                  y1={RAND / 2 + 32}
                  x2={x(id)}
                  y2={hoehe - RAND / 2}
                  stroke="#4a5361"
                  strokeDasharray="4 4"
                />
              </g>
            ))}
            {pfeile.map((p, i) => {
              const y = KOPF + RAND + i * ZEILE;
              const x1 = x(p.vonId);
              const x2 = x(p.nachId);
              const richtung = x2 >= x1 ? 1 : -1;
              const ende = p.verloren ? x2 - richtung * 12 : x2 - richtung * 2;
              const text = zwischen ? paketKurzname(p.paket) : paketInhalt(p.paket);
              return (
                <g key={p.nr}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={ende}
                    y2={y}
                    stroke="#14181f"
                    strokeWidth={2}
                    strokeDasharray={istAnfrage(p.paket) ? undefined : '7 5'}
                    markerEnd={p.verloren ? undefined : 'url(#spitze)'}
                  />
                  {p.verloren && (
                    <text x={x2} y={y + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#b42318">
                      ✕
                    </text>
                  )}
                  <text x={(x1 + x2) / 2} y={y - 7} textAnchor="middle" fontSize="11.5" fill="#14181f">
                    {kuerzen(
                      `${i + 1}. ${text}${p.verloren ? ` (${texte.verloren})` : ''}`,
                      Math.abs(x2 - x1) / 6.2,
                    )}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {/* Textfassung für Screenreader */}
      <ol className="visuell-versteckt">
        {pfeile.map((p) => (
          <li key={p.nr}>
            {`${name(p.vonId)} → ${name(p.nachId)}: ${paketInhalt(p.paket)}${p.verloren ? ` (${texte.verloren})` : ''}`}
          </li>
        ))}
      </ol>
    </div>
  );
}

function kuerzen(text: string, zeichen: number): string {
  const max = Math.max(12, Math.floor(zeichen));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
