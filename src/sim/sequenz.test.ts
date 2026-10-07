import { describe, expect, it } from 'vitest';
import { baueNetz, mitGeraet } from '../model/testnetze';
import { sequenzdiagramm } from './sequenz';
import { Simulation } from './simulation';

function schulnetz() {
  const { netz: roh, id } = baueNetz(
    {
      pc: ['computer', '192.168.0.10'],
      sw: ['switch'],
      dns: ['server', '192.168.0.3'],
      web: ['server', '192.168.0.2'],
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
  netz = mitGeraet(netz, id('web'), { dienste: [{ art: 'webserver', seiten: [{ pfad: '/', html: 'x' }] }] });
  return { netz, id };
}

function lauf(netz: ReturnType<typeof schulnetz>['netz'], start: (sim: Simulation) => void) {
  const sim = new Simulation(netz);
  start(sim);
  for (let i = 0; i < 60 && sim.aktiv; i++) sim.schritt();
  return sim;
}

describe('Sequenzdiagramm', () => {
  it('Ende-zu-Ende: DNS-Anfrage, DNS-Antwort, HTTP-Anfrage, HTTP-Antwort', () => {
    const { netz, id } = schulnetz();
    const sim = lauf(netz, (s) => s.aufrufen(id('pc'), 'www.schule.test'));
    const seq = sequenzdiagramm(sim.protokoll, false);
    expect(seq.teilnehmer).toEqual([id('pc'), id('dns'), id('web')]);
    expect(seq.pfeile.map((p) => [p.paket.art, p.vonId, p.nachId])).toEqual([
      ['dns-anfrage', id('pc'), id('dns')],
      ['dns-antwort', id('dns'), id('pc')],
      ['http-anfrage', id('pc'), id('web')],
      ['http-antwort', id('web'), id('pc')],
    ]);
  });

  it('mit Zwischenstationen: jeder Abschnitt über den Switch', () => {
    const { netz, id } = schulnetz();
    const sim = lauf(netz, (s) => s.aufrufen(id('pc'), '192.168.0.2'));
    const seq = sequenzdiagramm(sim.protokoll, true);
    expect(seq.teilnehmer).toEqual([id('pc'), id('sw'), id('web')]);
    expect(seq.pfeile).toHaveLength(4);
  });

  it('verlorene Pakete enden mit ✕ beim verwerfenden Gerät', () => {
    const { netz, id } = schulnetz();
    const sim = lauf(netz, (s) => s.senden(id('pc'), '192.168.0.99', 'x'));
    expect(sequenzdiagramm(sim.protokoll, false).pfeile).toMatchObject([
      { vonId: id('pc'), nachId: id('sw'), verloren: true },
    ]);
    expect(sequenzdiagramm(sim.protokoll, true).pfeile).toMatchObject([{ nachId: id('sw'), verloren: true }]);
  });
});
