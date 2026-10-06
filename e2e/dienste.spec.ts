import { expect, test, type Page } from '@playwright/test';

async function ladeNetz(page: Page, geraete: object[], leitungen: object[]) {
  await page.goto('/');
  await page.evaluate(
    ([g, l]) =>
      localStorage.setItem(
        'netzwerkstatt:aktuelles-netz',
        JSON.stringify({
          format: 'netzwerkstatt',
          version: 1,
          stufe: '7-8',
          titel: '',
          geraete: g,
          leitungen: l,
        }),
      ),
    [geraete, leitungen],
  );
  await page.reload();
}

const pos = (x: number, y: number) => ({ position: { x, y } });
/** Netz ohne Dienste: Die Schüler:innen richten Webserver und DNS selbst ein. */
const roh = [
  {
    id: 'g1',
    typ: 'computer',
    name: 'Computer 1',
    ip: '192.168.0.10',
    dienste: [{ art: 'browser' }],
    ...pos(0, 0),
  },
  { id: 'g2', typ: 'switch', name: 'Switch 1', ...pos(250, 0) },
  { id: 'g3', typ: 'server', name: 'Server 1', ip: '192.168.0.2', ...pos(500, -150) },
  { id: 'g4', typ: 'server', name: 'Server 2', ip: '192.168.0.3', ...pos(500, 150) },
];
const leitungen = [
  { id: 'l1', art: 'kabel', von: 'g1', nach: 'g2' },
  { id: 'l2', art: 'kabel', von: 'g3', nach: 'g2' },
  { id: 'l3', art: 'kabel', von: 'g4', nach: 'g2' },
];
const fertig = [
  { ...roh[0], dnsServer: '192.168.0.3' },
  roh[1],
  {
    ...roh[2],
    dienste: [
      {
        art: 'webserver',
        seiten: [
          { pfad: '/', html: '<h1>Unsere Schule</h1><a href="/kontakt.html">Kontakt</a>' },
          { pfad: '/kontakt.html', html: '<h1>Kontaktseite</h1>' },
        ],
      },
    ],
  },
  {
    ...roh[3],
    dienste: [{ art: 'dns-server', eintraege: [{ domain: 'www.schule.test', ip: '192.168.0.2' }] }],
  },
];

const knoten = (page: Page, name: string) => page.locator('.react-flow__node', { hasText: name });

async function waehle(page: Page, name: string) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await knoten(page, name).click();
}

async function browserAufrufen(page: Page, adresse: string) {
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await waehle(page, 'Computer 1');
  await page.getByRole('button', { name: 'Browser öffnen' }).click();
  await page.getByLabel('Adresse', { exact: true }).fill(adresse);
  await page.getByRole('button', { name: 'Aufrufen' }).click();
}

const seite = (page: Page) => page.frameLocator('iframe[title^="http://"]');

test('Webserver und DNS einrichten und eigene Seite im Browser abrufen (TK 4, TK 5)', async ({ page }) => {
  test.slow();
  await ladeNetz(page, roh, leitungen);

  // Webserver auf Server 1 installieren und Startseite schreiben
  await waehle(page, 'Server 1');
  await page.getByRole('button', { name: 'Webserver installieren' }).click();
  await page.getByRole('button', { name: 'Seite / bearbeiten' }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('HTML-Quelltext').fill('<h1>Hallo aus der Netzwerkstatt</h1>');
  await expect(editor.frameLocator('iframe').getByRole('heading')).toHaveText('Hallo aus der Netzwerkstatt');
  await editor.getByRole('button', { name: 'Übernehmen' }).click();

  // DNS-Server auf Server 2 mit einem Eintrag
  await waehle(page, 'Server 2');
  await page.getByRole('button', { name: 'DNS-Server installieren' }).click();
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await page.getByLabel('Domain 1').fill('www.netzwerkstatt.test');
  await page.getByLabel('Domain 1').press('Tab');
  await page.getByRole('textbox', { name: 'IP-Adresse 1' }).fill('192.168.0.2');
  await page.getByRole('textbox', { name: 'IP-Adresse 1' }).press('Enter');

  // Computer 1 bekommt den DNS-Server per Vorschlag
  await waehle(page, 'Computer 1');
  await page
    .getByRole('button', { name: 'IP-Adresse des DNS-Servers im lokalen Rechnernetz eintragen' })
    .click();
  await expect(page.getByRole('textbox', { name: 'DNS-Server' })).toHaveValue('192.168.0.3');

  await browserAufrufen(page, 'www.netzwerkstatt.test');
  await expect(page.getByText(/Frage den DNS-Server/)).toBeVisible();
  await expect(seite(page).getByRole('heading')).toHaveText('Hallo aus der Netzwerkstatt', {
    timeout: 20_000,
  });

  const protokoll = page.locator('table tbody');
  await expect(protokoll).toContainText('DNS-Anfrage „Welche IP-Adresse hat www.netzwerkstatt.test?“');
  await expect(protokoll).toContainText('hat die IP-Adresse 192.168.0.2');
  await expect(protokoll).toContainText('Browser zeigt die Seite www.netzwerkstatt.test/');
});

test('Links auf der eigenen Seite funktionieren', async ({ page }) => {
  await ladeNetz(page, fertig, leitungen);
  await browserAufrufen(page, 'www.schule.test');
  await seite(page).getByRole('link', { name: 'Kontakt' }).click({ timeout: 20_000 });
  await expect(seite(page).getByRole('heading')).toHaveText('Kontaktseite', { timeout: 20_000 });
  await expect(page.getByLabel('Adresse', { exact: true })).toHaveValue(
    'http://www.schule.test/kontakt.html',
  );
});

test('Fehlender DNS-Eintrag wird verständlich erklärt', async ({ page }) => {
  await ladeNetz(page, fertig, leitungen);
  await browserAufrufen(page, 'www.gibtsnicht.test');
  await expect(page.getByRole('alert')).toContainText('Domain nicht gefunden', { timeout: 20_000 });
  await expect(page.getByRole('alert')).toContainText('Schau in die Tabelle des DNS-Servers');
});

test('Ohne DNS-Server-Eintrag hilft eine IP-Adresse direkt', async ({ page }) => {
  await ladeNetz(page, [roh[0], ...fertig.slice(1)], leitungen);
  await browserAufrufen(page, 'www.schule.test');
  await expect(page.getByRole('alert')).toContainText('Kein DNS-Server eingetragen');
  await page.getByLabel('Adresse', { exact: true }).fill('192.168.0.2');
  await page.getByRole('button', { name: 'Aufrufen' }).click();
  await expect(seite(page).getByRole('heading')).toHaveText('Unsere Schule', { timeout: 20_000 });
});

test('Dienste-Ansicht: Hardware und Dienste getrennt, logische Verbindung sichtbar (TK 1)', async ({
  page,
}) => {
  await ladeNetz(page, fertig, leitungen);
  await page.getByRole('radio', { name: 'Dienste' }).check({ force: true });
  await expect(knoten(page, 'Server 1')).toContainText('Hardware: Server');
  await expect(knoten(page, 'Server 1')).toContainText('Webserver');
  await expect(knoten(page, 'Server 2')).toContainText('DNS-Server');
  await expect(page.locator('.react-flow__edge-verbindung')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Infrastruktur' }).check({ force: true });
  await expect(page.locator('.react-flow__edge-verbindung')).toHaveCount(0);
});

test('Webseite darf nichts von außen nachladen (Datenschutz)', async ({ page, baseURL }) => {
  const extern = [
    {
      ...fertig[2],
      dienste: [
        {
          art: 'webserver',
          seiten: [{ pfad: '/', html: '<h1>Bild</h1><img src="https://example.org/x.png">' }],
        },
      ],
    },
  ];
  await ladeNetz(page, [fertig[0], fertig[1], ...extern, fertig[3]], leitungen);
  const fremd: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:') && !r.url().startsWith('about:'))
      fremd.push(r.url());
  });
  await browserAufrufen(page, 'www.schule.test');
  await expect(seite(page).getByRole('heading')).toHaveText('Bild', { timeout: 20_000 });
  await page.waitForTimeout(500);
  expect(fremd).toEqual([]);
});
