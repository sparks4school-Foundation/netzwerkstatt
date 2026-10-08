import { describe, expect, it } from 'vitest';
import { adressProbleme } from '../../model/adressen';
import { ladeNetz, type NetzDatei } from '../../model/datei';
import { dnsEintragProbleme } from '../../model/dienste';
import { pruefe } from '../../sim/pruefung';
import { Simulation } from '../../sim/simulation';
import { beispiele } from './index';

function lade(id: string): NetzDatei {
  const b = beispiele.find((x) => x.id === id)!;
  const ergebnis = ladeNetz(JSON.stringify(b.daten));
  if (!ergebnis.ok) throw new Error(`${id}: ${ergebnis.meldung}`);
  return ergebnis.netz;
}

function bisZumEnde(sim: Simulation) {
  for (let i = 0; i < 80 && sim.aktiv; i++) sim.schritt();
}

describe('Beispielnetze', () => {
  it.each(beispiele.map((b) => b.id))('%s ist eine gültige Netzwerkstatt-Datei', (id) => {
    expect(() => lade(id)).not.toThrow();
  });

  it('haben eindeutige IDs', () => {
    expect(new Set(beispiele.map((b) => b.id)).size).toBe(beispiele.length);
  });

  it('Schulnetz: Die Website ist sofort erreichbar', () => {
    const netz = lade('schulnetz-web-dns');
    expect(adressProbleme(netz).size).toBe(0);
    const sim = new Simulation(netz);
    sim.aufrufen('g1', 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.browser('g1')).toMatchObject({ phase: 'fertig', status: 200 });
  });

  it('Fehlersuche: enthält genau die drei beabsichtigten Fehler', () => {
    const netz = lade('fehlersuche-webseite');
    // 1. Computer 2 hat dieselbe IP-Adresse wie der Webserver
    expect(adressProbleme(netz).get('g2')).toMatchObject([{ art: 'ip-doppelt' }]);
    // 2. Computer 1 fragt einen DNS-Server, den es nicht gibt
    expect(netz.geraete.find((g) => g.id === 'g1')?.dnsServer).toBe('192.168.0.4');
    // 3. Tippfehler im DNS-Eintrag (gültige, aber falsche Domain)
    const dns = netz.geraete.find((g) => g.id === 'g5')?.dienste?.[0];
    expect(dns?.art === 'dns-server' && dns.eintraege[0]?.domain).toBe('www.schule.tset');
    expect(dns?.art === 'dns-server' && dnsEintragProbleme(dns.eintraege)).toEqual([[]]);

    const sim = new Simulation(netz);
    sim.aufrufen('g1', 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.browser('g1')).toMatchObject({ phase: 'fehler', fehler: { grund: 'keine-antwort' } });
  });

  it('Fehlersuche: nach Behebung der drei Fehler lädt die Seite', () => {
    const netz = lade('fehlersuche-webseite');
    const behoben: NetzDatei = {
      ...netz,
      geraete: netz.geraete.map((g) => {
        if (g.id === 'g1') return { ...g, dnsServer: '192.168.0.3' };
        if (g.id === 'g2') return { ...g, ip: '192.168.0.11' };
        if (g.id === 'g5')
          return {
            ...g,
            dienste: [{ art: 'dns-server', eintraege: [{ domain: 'www.schule.test', ip: '192.168.0.2' }] }],
          };
        return g;
      }),
    };
    const sim = new Simulation(behoben);
    sim.aufrufen('g1', 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.browser('g1')).toMatchObject({ phase: 'fertig', status: 200 });
  });

  it('Zwei Netze: Website aus dem anderen Netz über DNS und Router erreichbar', () => {
    const netz = lade('zwei-netze-router');
    expect(adressProbleme(netz).size).toBe(0);
    const sim = new Simulation(netz);
    sim.aufrufen('g1', 'www.netz-b.test');
    bisZumEnde(sim);
    expect(sim.browser('g1')).toMatchObject({ phase: 'fertig', status: 200 });
    expect(sim.protokoll.some((e) => e.art === 'weitergeleitet' && e.geraetId === 'g4')).toBe(true);
  });

  it('Vermaschtes Netz: kurzer Weg, bei Ausfall Umweg', () => {
    const netz = lade('vermaschtes-netz');
    expect(adressProbleme(netz).size).toBe(0);
    const router = (sim: Simulation) =>
      sim.protokoll
        .filter(
          (e) =>
            e.art === 'weitergeleitet' &&
            e.paket.art === 'nachricht' &&
            ['g3', 'g4', 'g5'].includes(e.geraetId),
        )
        .map((e) => e.geraetId);
    const sim = new Simulation(netz);
    sim.senden('g1', '192.168.2.10', 'x');
    bisZumEnde(sim);
    expect(router(sim)).toEqual(['g3', 'g5']);
    const umweg = new Simulation(netz);
    umweg.leitungAusfallen('l5', true);
    umweg.senden('g1', '192.168.2.10', 'x');
    bisZumEnde(umweg);
    expect(router(umweg)).toEqual(['g3', 'g4', 'g5']);
  });

  it('Paketvermittlung: Teile kommen über zwei Wege durcheinander an', () => {
    const netz = lade('paketvermittlung');
    expect(adressProbleme(netz).size).toBe(0);
    const sim = new Simulation(netz, { mehrwege: true });
    sim.inPaketenSenden('g1', '192.168.2.10', 'Netzwerkstatt', 2);
    bisZumEnde(sim);
    const [puffer] = sim.empfangspuffer('g6');
    expect(puffer!.text).toBe('Netzwerkstatt');
    expect(puffer!.ankunft).not.toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('Heimnetze und Internet: DHCP, dann Website über NAT', () => {
    const netz = lade('heimnetze-internet');
    expect(adressProbleme(netz).size).toBe(0);
    const sim = new Simulation(netz);
    sim.dhcpAnfordern('g1');
    bisZumEnde(sim);
    expect(sim.dhcpZustand('g1')).toMatchObject({ phase: 'fertig', angebot: { ip: '192.168.178.100' } });
    sim.aufrufen('g1', 'www.beispiel.test');
    bisZumEnde(sim);
    expect(sim.browser('g1')).toMatchObject({ phase: 'fertig', status: 200 });
    sim.aufrufen('g8', 'www.beispiel.test');
    bisZumEnde(sim);
    expect(sim.browser('g8')).toMatchObject({ phase: 'fertig', status: 200 });
    expect(sim.natTabelle('g5').length).toBeGreaterThan(0);
  });

  it('jedes Beispiel hat eine Aufgabe mit Auftrag und Hilfen', () => {
    for (const b of beispiele) {
      const netz = lade(b.id);
      expect(netz.aufgabe?.auftrag.length, b.id).toBeGreaterThan(20);
      expect(netz.aufgabe?.hilfen.length, b.id).toBeGreaterThan(0);
    }
  });

  it.each([
    'schulnetz-web-dns',
    'heimnetz-wlan',
    'zwei-netze-router',
    'vermaschtes-netz',
    'heimnetze-internet',
  ])('%s: Prüfungen bestehen im Ausgangszustand', (id) => {
    const netz = lade(id);
    for (const p of netz.aufgabe!.pruefungen)
      expect(pruefe(netz, p), JSON.stringify(p)).toEqual({ ok: true });
  });

  it('Fehlersuche: Prüfungen scheitern zuerst und bestehen nach dem Beheben', () => {
    const netz = lade('fehlersuche-webseite');
    expect(netz.aufgabe!.aufbauGesperrt).toBe(true);
    expect(netz.aufgabe!.pruefungen.map((p) => pruefe(netz, p).ok)).toEqual([false, false]);
    const behoben: NetzDatei = {
      ...netz,
      geraete: netz.geraete.map((g) => {
        if (g.id === 'g1') return { ...g, dnsServer: '192.168.0.3' };
        if (g.id === 'g2') return { ...g, ip: '192.168.0.11' };
        if (g.id === 'g5')
          return {
            ...g,
            dienste: [{ art: 'dns-server', eintraege: [{ domain: 'www.schule.test', ip: '192.168.0.2' }] }],
          };
        return g;
      }),
    };
    expect(behoben.aufgabe!.pruefungen.map((p) => pruefe(behoben, p).ok)).toEqual([true, true]);
  });

  it('Erstes Netz: erst nach Vergabe der IP-Adresse an Computer C bestanden', () => {
    const netz = lade('erstes-netz');
    expect(netz.aufgabe!.pruefungen.every((p) => pruefe(netz, p).ok)).toBe(false);
    const geloest: NetzDatei = {
      ...netz,
      geraete: netz.geraete.map((g) => (g.id === 'g3' ? { ...g, ip: '192.168.0.12' } : g)),
    };
    expect(geloest.aufgabe!.pruefungen.every((p) => pruefe(geloest, p).ok)).toBe(true);
  });
});
