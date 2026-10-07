import { schnittstellenVon, type Schnittstelle } from './adressen';
import type { Geraet, NetzDatei, RoutingEintrag } from './datei';
import { STANDARD_SUBNETZMASKE, ipZuZahl, maskeZuZahl, netzanteil, zahlZuIp } from './ip';
import { findeGeraet } from './netz';
import { segmentSchluessel } from './topologie';

/**
 * Routing (Bildungsplan 11, TK 3). Ein Router entscheidet anhand seiner Routingtabelle, über welchen
 * Anschluss und an welchen nächsten Router ein Paket weitergeht.
 *
 * Automatisch: Die Tabelle wird wie bei einem eingeschwungenen Routingprotokoll berechnet – direkt
 * angeschlossene Netze plus für jedes andere bekannte Netz der Weg mit den wenigsten Routern.
 * Ausgefallene Leitungen werden dabei nicht benutzt; so entstehen im vermaschten Netz Umwege.
 * Manuell: Die gespeicherte Tabelle gilt so, wie sie eingegeben wurde – auch wenn sie falsch ist.
 */
export interface Route {
  ziel: number;
  maske: number;
  /** IP-Adresse des nächsten Routers; `null` = Zielnetz hängt direkt an diesem Anschluss. */
  gateway: number | null;
  leitungId: string;
  /** Anzahl der Router bis zum Zielnetz (0 = direkt angeschlossen). */
  metrik: number;
}

/** Netz ohne ausgefallene Leitungen – so „sieht“ das Netz ein Routingprotokoll. */
export function aktivesNetz(netz: NetzDatei): NetzDatei {
  return netz.leitungen.some((l) => l.ausgefallen)
    ? { ...netz, leitungen: netz.leitungen.filter((l) => !l.ausgefallen) }
    : netz;
}

type RouterSchnittstelle = Schnittstelle & { leitungId: string; segment: string };

function routerSchnittstellen(netz: NetzDatei): RouterSchnittstelle[] {
  return netz.geraete
    .filter((g) => g.typ === 'router')
    .flatMap((g) => schnittstellenVon(netz, g))
    .filter((s): s is Schnittstelle & { leitungId: string } => s.leitungId !== null)
    .map((s) => ({ ...s, segment: segmentSchluessel(netz, s.geraetId, s.leitungId) }));
}

/** Berechnet die automatische Routingtabelle eines Routers (deterministisch). */
export function automatischeRouten(netzGesamt: NetzDatei, routerId: string): Route[] {
  const netz = aktivesNetz(netzGesamt);
  const alle = routerSchnittstellen(netz);
  const eigene = alle.filter((s) => s.geraetId === routerId);
  const routen = new Map<string, Route>();
  const schluessel = (ip: number, maske: number) => `${netzanteil(ip, maske)}/${maske}`;

  // 1. Direkt angeschlossene Netze
  for (const s of eigene) {
    const k = schluessel(s.ip, s.maske);
    if (!routen.has(k)) {
      routen.set(k, {
        ziel: netzanteil(s.ip, s.maske),
        maske: s.maske,
        gateway: null,
        leitungId: s.leitungId,
        metrik: 0,
      });
    }
  }

  // 2. Breitensuche über Router, die sich ein lokales Rechnernetz teilen
  type Eintrag = {
    routerId: string;
    ersterSchritt: { leitungId: string; gateway: number } | null;
    metrik: number;
  };
  const besucht = new Set([routerId]);
  const schlange: Eintrag[] = [{ routerId, ersterSchritt: null, metrik: 0 }];
  while (schlange.length) {
    const aktuell = schlange.shift()!;
    for (const s of alle.filter((x) => x.geraetId === aktuell.routerId)) {
      // Nachbarrouter im selben Segment und im selben IP-Netz (sonst verstehen sie sich nicht)
      for (const n of alle) {
        if (n.geraetId === aktuell.routerId || besucht.has(n.geraetId) || n.segment !== s.segment) continue;
        if (netzanteil(n.ip, s.maske) !== netzanteil(s.ip, s.maske)) continue;
        besucht.add(n.geraetId);
        const ersterSchritt = aktuell.ersterSchritt ?? { leitungId: s.leitungId, gateway: n.ip };
        const metrik = aktuell.metrik + 1;
        for (const ns of alle.filter((x) => x.geraetId === n.geraetId)) {
          const k = schluessel(ns.ip, ns.maske);
          if (!routen.has(k)) {
            routen.set(k, { ziel: netzanteil(ns.ip, ns.maske), maske: ns.maske, ...ersterSchritt, metrik });
          }
        }
        schlange.push({ routerId: n.geraetId, ersterSchritt, metrik });
      }
    }
  }
  return [...routen.values()];
}

/** Gespeicherte (manuelle) Tabelle in Routen umwandeln; ungültige Zeilen werden übersprungen. */
export function manuelleRouten(router: Geraet): Route[] {
  const ergebnis: Route[] = [];
  for (const e of router.routing?.tabelle ?? []) {
    const ziel = ipZuZahl(e.ziel);
    const maske = maskeZuZahl(e.subnetzmaske || STANDARD_SUBNETZMASKE);
    const gateway = e.gateway.trim() ? ipZuZahl(e.gateway) : null;
    if (ziel === null || maske === null || (e.gateway.trim() && gateway === null)) continue;
    ergebnis.push({ ziel: netzanteil(ziel, maske), maske, gateway, leitungId: e.leitungId, metrik: 0 });
  }
  return ergebnis;
}

/** Die Routen, nach denen der Router tatsächlich arbeitet. */
export function routenVon(netz: NetzDatei, routerId: string): Route[] {
  const router = findeGeraet(netz, routerId);
  if (!router) return [];
  return router.routing?.modus === 'manuell' ? manuelleRouten(router) : automatischeRouten(netz, routerId);
}

/** Passende Route für eine Ziel-IP: die mit der längsten Subnetzmaske gewinnt (spezifischste). */
export function routeFuer(routen: Route[], zielIp: number): Route | null {
  let beste: Route | null = null;
  for (const r of routen) {
    if (netzanteil(zielIp, r.maske) !== r.ziel) continue;
    if (!beste || r.maske >>> 0 > beste.maske >>> 0) beste = r;
  }
  return beste;
}

/** Route als Tabellenzeile zum Speichern (z. B. um die automatische Tabelle von Hand weiterzubearbeiten). */
export function alsEintrag(r: Route): RoutingEintrag {
  return {
    ziel: zahlZuIp(r.ziel),
    subnetzmaske: zahlZuIp(r.maske),
    gateway: r.gateway === null ? '' : zahlZuIp(r.gateway),
    leitungId: r.leitungId,
  };
}

export type RoutingEintragProblem =
  'ziel-ungueltig' | 'maske-ungueltig' | 'gateway-ungueltig' | 'anschluss-fehlt';

export function routingEintragProbleme(netz: NetzDatei, router: Geraet): RoutingEintragProblem[][] {
  const leitungen = new Set(
    netz.leitungen.filter((l) => l.von === router.id || l.nach === router.id).map((l) => l.id),
  );
  return (router.routing?.tabelle ?? []).map((e) => {
    const p: RoutingEintragProblem[] = [];
    if (ipZuZahl(e.ziel) === null) p.push('ziel-ungueltig');
    if (maskeZuZahl(e.subnetzmaske) === null) p.push('maske-ungueltig');
    if (e.gateway.trim() && ipZuZahl(e.gateway) === null) p.push('gateway-ungueltig');
    if (!leitungen.has(e.leitungId)) p.push('anschluss-fehlt');
    return p;
  });
}
