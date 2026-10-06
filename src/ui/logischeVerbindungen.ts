import { adresseVon } from '../model/adressen';
import type { NetzDatei } from '../model/datei';
import { ipZuZahl } from '../model/ip';
import { segment } from '../model/topologie';
import type { LogischeVerbindung, Simulation } from '../sim/simulation';

/**
 * Logische Verbindungen für die Dienste-Ansicht:
 * - aus der Konfiguration: Gerät → eingetragener DNS-Server (DNS)
 * - aus der Simulation: wer hat tatsächlich mit wem kommuniziert (DNS, HTTP, Nachricht)
 */
export function logischeVerbindungen(netz: NetzDatei, sim: Simulation | null): LogischeVerbindung[] {
  const ergebnis = new Map<string, LogischeVerbindung>();
  const hinzu = (v: LogischeVerbindung) => ergebnis.set(`${v.clientId}>${v.serverId}>${v.protokoll}`, v);

  for (const g of netz.geraete) {
    const dnsIp = g.dnsServer ? ipZuZahl(g.dnsServer) : null;
    if (dnsIp === null) continue;
    const imSegment = segment(netz, g.id);
    const server = netz.geraete.find(
      (x) => x.id !== g.id && imSegment.has(x.id) && adresseVon(x)?.ip === dnsIp,
    );
    if (server) hinzu({ clientId: g.id, serverId: server.id, protokoll: 'DNS' });
  }
  for (const v of sim?.verbindungen ?? []) hinzu(v);
  return [...ergebnis.values()];
}
