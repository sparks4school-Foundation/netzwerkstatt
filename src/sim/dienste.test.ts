import { describe, expect, it } from 'vitest';
import type { NetzDatei } from '../model/datei';
import { baueNetz, mitGeraet } from '../model/testnetze';
import { Simulation } from './simulation';

function bisZumEnde(sim: Simulation, max = 60) {
  for (let i = 0; i < max && sim.aktiv; i++) sim.schritt();
  expect(sim.aktiv).toBe(false);
}

/** Schulnetz: PC mit Browser, DNS-Server und Webserver an einem Switch. */
function schulnetz(anpassen?: (netz: NetzDatei, id: (n: string) => string) => NetzDatei) {
  const { netz: roh, id } = baueNetz(
    {
      pc: ['computer', '192.168.0.10'],
      dns: ['server', '192.168.0.3'],
      web: ['server', '192.168.0.2'],
      sw: ['switch'],
    },
    [
      ['pc', 'sw'],
      ['dns', 'sw'],
      ['web', 'sw'],
    ],
  );
  let netz = mitGeraet(roh, id('pc'), { dnsServer: '192.168.0.3' });
  netz = mitGeraet(netz, id('dns'), {
    dienste: [{ art: 'dns-server', eintraege: [{ domain: 'www.schule.test', ip: '192.168.0.2' }] }],
  });
  netz = mitGeraet(netz, id('web'), {
    dienste: [
      {
        art: 'webserver',
        seiten: [
          { pfad: '/', html: '<h1>Schule</h1>' },
          { pfad: '/kontakt.html', html: '<p>Kontakt</p>' },
        ],
      },
    ],
  });
  if (anpassen) netz = anpassen(netz, id);
  return { netz, id };
}

describe('Namensauflösung und Webseite (TK 4, TK 5)', () => {
  it('fragt erst den DNS-Server, dann den Webserver und zeigt die Seite', () => {
    const { netz, id } = schulnetz();
    const sim = new Simulation(netz);
    expect(sim.aufrufen(id('pc'), 'www.schule.test').phase).toBe('dns');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({
      phase: 'fertig',
      status: 200,
      html: '<h1>Schule</h1>',
      ip: '192.168.0.2',
    });
    const arten = sim.protokoll
      .filter((e) => e.art === 'empfangen')
      .map((e) => ('paket' in e ? e.paket.art : ''));
    expect(arten).toEqual(['dns-anfrage', 'dns-antwort', 'http-anfrage', 'http-antwort']);
    expect(sim.protokoll.at(-1)).toMatchObject({ art: 'seite-angezeigt' });
  });

  it('kennt Unterseiten, „/index.html“ und liefert 404 für fehlende Seiten', () => {
    const { netz, id } = schulnetz();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'http://www.schule.test/kontakt.html');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({ phase: 'fertig', html: '<p>Kontakt</p>' });
    sim.aufrufen(id('pc'), 'WWW.Schule.test/index.html');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({ phase: 'fertig', html: '<h1>Schule</h1>' });
    sim.aufrufen(id('pc'), 'www.schule.test/gibtsnicht.html');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({ phase: 'fertig', status: 404 });
  });

  it('braucht bei einer IP-Adresse keinen DNS-Server', () => {
    const { netz, id } = schulnetz((n, id) => mitGeraet(n, id('pc'), { dnsServer: '' }));
    const sim = new Simulation(netz);
    expect(sim.aufrufen(id('pc'), '192.168.0.2').phase).toBe('laden');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({ phase: 'fertig', status: 200 });
  });

  it('meldet fehlenden DNS-Server-Eintrag am Client', () => {
    const { netz, id } = schulnetz((n, id) => mitGeraet(n, id('pc'), { dnsServer: '' }));
    const sim = new Simulation(netz);
    expect(sim.aufrufen(id('pc'), 'www.schule.test')).toMatchObject({
      phase: 'fehler',
      fehler: { grund: 'kein-dns-server' },
    });
    expect(sim.aktiv).toBe(false);
  });

  it('meldet unbekannte Domains', () => {
    const { netz, id } = schulnetz();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'www.andere.test');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({
      phase: 'fehler',
      fehler: { grund: 'domain-unbekannt', domain: 'www.andere.test' },
    });
  });

  it('meldet, wenn auf dem Zielgerät kein Webserver läuft', () => {
    const { netz, id } = schulnetz((n, id) => mitGeraet(n, id('web'), { dienste: [] }));
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({
      phase: 'fehler',
      fehler: { grund: 'dienst-fehlt', dienst: 'webserver', ip: '192.168.0.2' },
    });
  });

  it('meldet, wenn auf dem eingetragenen DNS-Server kein DNS-Dienst läuft', () => {
    const { netz, id } = schulnetz((n, id) => mitGeraet(n, id('pc'), { dnsServer: '192.168.0.2' }));
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({
      phase: 'fehler',
      fehler: { grund: 'dienst-fehlt', dienst: 'dns-server' },
    });
  });

  it('gibt nach dem Zeitlimit auf, wenn die DNS-Anfrage verloren geht', () => {
    const { netz, id } = schulnetz((n, id) => mitGeraet(n, id('pc'), { dnsServer: '192.168.0.99' }));
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.browser(id('pc'))).toMatchObject({
      phase: 'fehler',
      fehler: { grund: 'keine-antwort', von: 'dns-server', ip: '192.168.0.99' },
    });
    expect(sim.protokoll.some((e) => e.art === 'verworfen' && e.grund === 'kein-ziel')).toBe(true);
  });

  it('beendet die Simulation sofort nach der Seite (kein Warten auf Zeitlimits)', () => {
    const { netz, id } = schulnetz();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.zeit).toBe(8); // 4 Pakete × 2 Leitungen
  });

  it('meldet ungültige Adressen', () => {
    const { netz, id } = schulnetz();
    const sim = new Simulation(netz);
    expect(sim.aufrufen(id('pc'), 'www schule')).toMatchObject({ fehler: { grund: 'adresse-ungueltig' } });
  });

  it('liefert logische Verbindungen für die Dienste-Ansicht', () => {
    const { netz, id } = schulnetz();
    const sim = new Simulation(netz);
    sim.aufrufen(id('pc'), 'www.schule.test');
    bisZumEnde(sim);
    expect(sim.verbindungen).toEqual([
      { clientId: id('pc'), serverId: id('dns'), protokoll: 'DNS' },
      { clientId: id('pc'), serverId: id('web'), protokoll: 'HTTP' },
    ]);
  });
});
