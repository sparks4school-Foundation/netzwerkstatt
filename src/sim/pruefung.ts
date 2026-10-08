import { adressProbleme } from '../model/adressen';
import type { NetzDatei, Pruefung } from '../model/datei';
import { ipZuZahl } from '../model/ip';
import { besitztIp } from '../model/adressen';
import { Simulation, type BrowserFehler, type SendeFehler } from './simulation';

/**
 * Automatische Prüfung einer Aufgabe („Lösung prüfen“). Jede Bedingung läuft in einer eigenen,
 * unsichtbaren Simulation des aktuellen Netzes – genau so, wie es die Schüler:innen auch ausprobieren könnten.
 */
export type PruefErgebnis =
  | { ok: true }
  | { ok: false; grund: 'geraet-fehlt' }
  | { ok: false; grund: 'browser'; fehler: BrowserFehler | { grund: 'status-404' } }
  | { ok: false; grund: 'senden'; fehler: SendeFehler }
  | { ok: false; grund: 'keine-antwort' }
  | { ok: false; grund: 'adressprobleme'; anzahl: number }
  | { ok: false; grund: 'dhcp' };

const MAX_SCHRITTE = 600;

function bisZumEnde(sim: Simulation) {
  for (let i = 0; i < MAX_SCHRITTE && sim.aktiv; i++) sim.schritt();
}

export function pruefe(netz: NetzDatei, p: Pruefung): PruefErgebnis {
  if (p.art === 'adressen-ok') {
    const anzahl = adressProbleme(netz).size;
    return anzahl === 0 ? { ok: true } : { ok: false, grund: 'adressprobleme', anzahl };
  }
  if (!netz.geraete.some((g) => g.id === p.geraetId)) return { ok: false, grund: 'geraet-fehlt' };
  const sim = new Simulation(netz);
  // DHCP-Clients holen sich zuerst eine Adresse – wie im Unterricht vor dem eigentlichen Test.
  const geraet = netz.geraete.find((g) => g.id === p.geraetId)!;
  if (geraet.dhcp) {
    sim.dhcpAnfordern(geraet.id);
    bisZumEnde(sim);
    if (sim.dhcpZustand(geraet.id)?.phase !== 'fertig') return { ok: false, grund: 'dhcp' };
    if (p.art === 'dhcp') return { ok: true };
  } else if (p.art === 'dhcp') {
    return { ok: false, grund: 'dhcp' };
  }

  if (p.art === 'webseite') {
    sim.aufrufen(p.geraetId, p.adresse);
    bisZumEnde(sim);
    const zustand = sim.browser(p.geraetId);
    if (zustand?.phase === 'fertig') {
      return zustand.status === 200
        ? { ok: true }
        : { ok: false, grund: 'browser', fehler: { grund: 'status-404' } };
    }
    if (zustand?.phase === 'fehler') return { ok: false, grund: 'browser', fehler: zustand.fehler };
    return { ok: false, grund: 'keine-antwort' };
  }

  // Nachricht: Ziel muss sie empfangen UND die Antwort muss zurückkommen.
  const ergebnis = sim.senden(p.geraetId, p.zielIp, 'Test');
  if (!ergebnis.ok) return { ok: false, grund: 'senden', fehler: ergebnis };
  bisZumEnde(sim);
  const ziel = ipZuZahl(p.zielIp);
  const angekommen = sim.protokoll.some(
    (e) =>
      e.art === 'empfangen' &&
      e.paket.art === 'nachricht' &&
      ziel !== null &&
      besitztIp(
        sim.netz,
        sim.netz.geraete.find((g) => g.id === e.geraetId)!,
        ziel,
      ),
  );
  const zurueck = sim.protokoll.some(
    (e) => e.art === 'empfangen' && e.paket.art === 'antwort' && e.geraetId === p.geraetId,
  );
  return angekommen && zurueck ? { ok: true } : { ok: false, grund: 'keine-antwort' };
}
