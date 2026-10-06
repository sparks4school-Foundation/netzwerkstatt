import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function hinzufuegen(page: Page, ...namen: string[]) {
  for (const name of namen) await page.getByRole('button', { name: `${name} hinzufügen` }).click();
}

const knoten = (page: Page, name: string) => page.locator('.react-flow__node', { hasText: name });
const leitungen = (page: Page) => page.locator('.react-flow__edge');

async function verbindeUeberPanel(page: Page, von: string, nach: string, art: 'Kabel' | 'WLAN') {
  // Auswahl aufheben: Auf Tablets könnte das Eigenschaften-Blatt sonst das Gerät verdecken.
  await page.keyboard.press('Escape');
  await knoten(page, von).click();
  await page.getByLabel('Verbinden mit').selectOption({ label: nach });
  await page.getByLabel('per').selectOption({ label: art });
  await page.getByRole('button', { name: 'Verbinden', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Geräte hinzufügen und automatisch benennen', async ({ page }) => {
  await hinzufuegen(page, 'Computer', 'Computer', 'Switch');
  await expect(knoten(page, 'Computer 1')).toBeVisible();
  await expect(knoten(page, 'Computer 2')).toBeVisible();
  await expect(knoten(page, 'Switch 1')).toBeVisible();
  // Das zuletzt hinzugefügte Gerät ist ausgewählt und im Eigenschaften-Panel zu sehen.
  await expect(page.getByLabel('Name')).toHaveValue('Switch 1');
});

test('Netz über das Eigenschaften-Panel verbinden (ohne Ziehen)', async ({ page }) => {
  await hinzufuegen(page, 'Computer', 'Switch', 'Access Point', 'Smartphone');
  await verbindeUeberPanel(page, 'Computer 1', 'Switch 1', 'Kabel');
  await verbindeUeberPanel(page, 'Access Point 1', 'Switch 1', 'Kabel');
  await verbindeUeberPanel(page, 'Smartphone 1', 'Access Point 1', 'WLAN');
  await expect(leitungen(page)).toHaveCount(3);
  await expect(page.getByText('WLAN', { exact: true }).first()).toBeVisible();
});

test('verständliche Meldung bei unmöglicher Verbindung', async ({ page }) => {
  await hinzufuegen(page, 'Smartphone', 'Switch');
  await verbindeUeberPanel(page, 'Smartphone 1', 'Switch 1', 'Kabel');
  await expect(page.getByRole('alert')).toContainText('Smartphone 1 hat keinen Kabelanschluss');
  await expect(leitungen(page)).toHaveCount(0);
});

test('Rückgängig und Wiederholen', async ({ page }) => {
  await hinzufuegen(page, 'Computer', 'Server');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(knoten(page, 'Server 1')).toHaveCount(0);
  await page.getByRole('button', { name: 'Wiederholen' }).click();
  await expect(knoten(page, 'Server 1')).toBeVisible();
});

test('Gerät umbenennen und per Entf-Taste entfernen', async ({ page }) => {
  await hinzufuegen(page, 'Server');
  await page.getByLabel('Name').fill('Webserver Schule');
  await page.getByLabel('Name').press('Enter');
  await expect(knoten(page, 'Webserver Schule')).toBeVisible();
  await page.keyboard.press('Escape');
  await knoten(page, 'Webserver Schule').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
});

test('Netz bleibt nach Neuladen erhalten', async ({ page }) => {
  await hinzufuegen(page, 'Router');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(knoten(page, 'Router 1')).toBeVisible();
});

test('Speichern und Öffnen als JSON-Datei', async ({ page }, testInfo) => {
  await hinzufuegen(page, 'Computer', 'Switch');
  await verbindeUeberPanel(page, 'Computer 1', 'Switch 1', 'Kabel');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toBe('netz.netzwerkstatt.json');
  const pfad = testInfo.outputPath('netz.json');
  await datei.saveAs(pfad);
  const inhalt = JSON.parse(await readFile(pfad, 'utf8'));
  expect(inhalt).toMatchObject({ format: 'netzwerkstatt', version: 1, leitungen: [{ art: 'kabel' }] });

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Neu' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);

  await page.locator('input[type=file]').setInputFiles(pfad);
  await expect(knoten(page, 'Computer 1')).toBeVisible();
  await expect(leitungen(page)).toHaveCount(1);
});

test('fremde Datei wird mit verständlicher Meldung abgelehnt', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles({
    name: 'quatsch.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hallo": 1}'),
  });
  await expect(page.getByRole('alert')).toContainText('nicht aus der Netzwerkstatt');
});

test('im Modus „Ausprobieren“ ist die Palette ausgeblendet', async ({ page }) => {
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await expect(page.getByRole('button', { name: 'Computer hinzufügen' })).toHaveCount(0);
});
