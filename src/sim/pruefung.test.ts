import { describe, expect, it } from 'vitest';
import { baueNetz, mitGeraet } from '../model/testnetze';
import { pruefe } from './pruefung';

function netz() {
  const { netz: roh, id } = baueNetz(
    { pc: ['computer', '192.168.0.10'], sw: ['switch'], web: ['server', '192.168.0.2'] },
    [
      ['pc', 'sw'],
      ['web', 'sw'],
    ],
  );
  const n = mitGeraet(roh, id('web'), {
    dienste: [{ art: 'webserver', seiten: [{ pfad: '/', html: 'x' }] }],
  });
  return { netz: n, id };
}

describe('Prüfungen', () => {
  it('Webseite lädt / lädt nicht', () => {
    const { netz: n, id } = netz();
    expect(pruefe(n, { art: 'webseite', geraetId: id('pc'), adresse: '192.168.0.2' })).toEqual({ ok: true });
    expect(
      pruefe(n, { art: 'webseite', geraetId: id('pc'), adresse: '192.168.0.2/fehlt.html' }),
    ).toMatchObject({
      ok: false,
      fehler: { grund: 'status-404' },
    });
    expect(pruefe(n, { art: 'webseite', geraetId: id('pc'), adresse: 'www.x.test' })).toMatchObject({
      ok: false,
      fehler: { grund: 'kein-dns-server' },
    });
  });

  it('Nachricht kommt an und wird beantwortet', () => {
    const { netz: n, id } = netz();
    expect(pruefe(n, { art: 'nachricht', geraetId: id('pc'), zielIp: '192.168.0.2' })).toEqual({ ok: true });
    expect(pruefe(n, { art: 'nachricht', geraetId: id('pc'), zielIp: '192.168.0.99' })).toMatchObject({
      ok: false,
      grund: 'keine-antwort',
    });
  });

  it('Adressen ohne Probleme', () => {
    const { netz: n, id } = netz();
    expect(pruefe(n, { art: 'adressen-ok' })).toEqual({ ok: true });
    expect(pruefe(mitGeraet(n, id('pc'), { ip: '192.168.0.2' }), { art: 'adressen-ok' })).toMatchObject({
      ok: false,
      anzahl: 2,
    });
  });

  it('DHCP-Client wird vor der Prüfung automatisch eingerichtet', () => {
    const { netz: n, id } = netz();
    let mitDhcp = mitGeraet(n, id('pc'), { dhcp: true });
    expect(pruefe(mitDhcp, { art: 'dhcp', geraetId: id('pc') })).toMatchObject({ ok: false, grund: 'dhcp' });
    mitDhcp = mitGeraet(mitDhcp, id('web'), {
      dienste: [
        { art: 'webserver', seiten: [{ pfad: '/', html: 'x' }] },
        {
          art: 'dhcp-server',
          von: '192.168.0.100',
          bis: '192.168.0.110',
          subnetzmaske: '255.255.255.0',
          gateway: '',
          dnsServer: '',
        },
      ],
    });
    expect(pruefe(mitDhcp, { art: 'dhcp', geraetId: id('pc') })).toEqual({ ok: true });
    expect(pruefe(mitDhcp, { art: 'webseite', geraetId: id('pc'), adresse: '192.168.0.2' })).toEqual({
      ok: true,
    });
  });

  it('gelöschtes Gerät', () => {
    const { netz: n } = netz();
    expect(pruefe(n, { art: 'nachricht', geraetId: 'gibtsnicht', zielIp: '1.2.3.4' })).toEqual({
      ok: false,
      grund: 'geraet-fehlt',
    });
  });
});
