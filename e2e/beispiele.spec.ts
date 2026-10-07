import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('leere Arbeitsfläche bietet Beispiele an', async ({ page }) => {
  await page.locator('main').getByRole('button', { name: 'Beispiele' }).click();
  await expect(page.getByRole('dialog', { name: 'Beispielnetze' })).toBeVisible();
  await expect(page.getByRole('button', { name: /öffnen$/ })).toHaveCount(6);
});

test('Schulnetz öffnen, Arbeitsauftrag lesen und Website abrufen', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: 'Schulnetz mit Webserver und DNS öffnen' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('region', { name: /Arbeitsauftrag/ })).toContainText(
    'rufe www.schule.test auf',
  );

  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await page.locator('.react-flow__node', { hasText: 'Computer 1' }).click();
  await page.getByRole('button', { name: 'Browser öffnen' }).click();
  await page.getByLabel('Adresse', { exact: true }).fill('www.schule.test');
  await page.getByRole('button', { name: 'Aufrufen' }).click();
  await expect(page.frameLocator('iframe[title^="http://"]').getByRole('heading')).toHaveText(
    'Willkommen auf der Schul-Website',
    { timeout: 20_000 },
  );
});

test('Arbeitsauftrag lässt sich aus- und wieder einblenden', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: 'Erstes lokales Rechnernetz öffnen' }).click();
  await page.getByRole('button', { name: 'Arbeitsauftrag ausblenden' }).click();
  await expect(page.getByRole('region', { name: /Arbeitsauftrag/ })).toBeHidden();
  await page.getByRole('button', { name: 'Arbeitsauftrag' }).click();
  await expect(page.getByRole('region', { name: /Arbeitsauftrag/ })).toContainText('Computer C');
});

test('Fehlersuche-Beispiel zeigt die doppelte IP-Adresse sofort an', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: 'Fehlersuche: Warum lädt die Seite nicht? öffnen' }).click();
  await expect(page.locator('.react-flow__node', { hasText: 'Computer 2' })).toContainText('IP doppelt');
});

test('vor dem Ersetzen eines eigenen Netzes wird nachgefragt', async ({ page }) => {
  await page.getByRole('button', { name: 'Router hinzufügen' }).click();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: 'Heimnetz mit WLAN öffnen' }).click();
  await expect(page.locator('.react-flow__node', { hasText: 'Router 1' })).toBeVisible();
});
