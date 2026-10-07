import { expect, test, type Page } from '@playwright/test';

async function oeffneBeispiel(page: Page, titel: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: `${titel} öffnen` }).click();
  await page.getByRole('button', { name: 'Arbeitsauftrag ausblenden' }).click();
  // Info „offline bereit“ nicht abwarten
  const info = page.getByRole('status').filter({ hasText: 'ohne Internet' });
  if (await info.isVisible()) await info.getByRole('button', { name: 'Schließen' }).click();
}

async function sende(page: Page, von: string, zielIp: string) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await page.locator('.react-flow__node', { hasText: von }).first().click();
  await page.getByLabel('An IP-Adresse').fill(zielIp);
  await page.getByRole('button', { name: 'Senden' }).click();
}

test('Klasse 11: Paket in vier Schichten aufklappen', async ({ page }) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('button', { name: 'Einzelschritt' }).click();
  await sende(page, 'Computer A1', '192.168.2.10');

  await page.getByRole('button', { name: /Details zu Schritt 0: Nachricht/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Nachricht: Computer A1 → Switch A');
  await expect(dialog.getByText('Netzzugangsschicht')).toBeVisible();
  // Auf der Netzzugangsschicht ist der Router Empfänger – nicht das endgültige Ziel
  await expect(dialog).toContainText(/Empfänger\s*Router \(02:00:/);

  await dialog.getByText('Vermittlungsschicht').click();
  await expect(dialog.getByText('192.168.2.10')).toBeVisible();
  await dialog.getByText('Transportschicht').click();
  await expect(dialog.getByText('UDP')).toBeVisible();
  await dialog.getByText('Anwendungsschicht').click();
  await expect(dialog.getByText('Hallo!')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Klasse 11: Sequenzdiagramm aus dem Protokoll', async ({ page }) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('slider', { name: 'Tempo' }).fill('3');
  await sende(page, 'Computer A1', '192.168.2.10');
  await expect(page.locator('table tbody')).toContainText('Antwort von 192.168.2.10 empfangen', {
    timeout: 20_000,
  });

  await page.getByRole('radio', { name: 'Sequenzdiagramm' }).check({ force: true });
  const bild = page.getByRole('img', { name: /Sequenzdiagramm mit 2 Nachrichten zwischen 2 Stationen/ });
  await expect(bild).toBeVisible();
  await expect(bild).toContainText('Computer B1');

  await page.getByLabel('Zwischenstationen zeigen (Switches, Router)').check();
  await expect(page.getByRole('img', { name: /zwischen 5 Stationen/ })).toContainText('Router');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als Bild (SVG) speichern' }).click();
  expect((await download).suggestedFilename()).toBe('sequenzdiagramm.svg');
});

test('Klasse 7/8: vereinfachtes 2-Schichten-Modell, kein Sequenzdiagramm', async ({ page }) => {
  await oeffneBeispiel(page, 'Erstes lokales Rechnernetz');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('button', { name: 'Einzelschritt' }).click();
  await sende(page, 'Computer A', '192.168.0.11');
  await page.getByRole('button', { name: /Details zu Schritt 0/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Infrastruktur – wohin?')).toBeVisible();
  await dialog.getByText('Dienst – was?').click();
  await expect(dialog.getByText('Hallo!')).toBeVisible();
  await expect(dialog.getByText('Transportschicht')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('radio', { name: 'Sequenzdiagramm' })).toHaveCount(0);
});

test('Paket auf der Leitung anklicken öffnet die Schichten', async ({ page }) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('button', { name: 'Einzelschritt' }).click();
  await sende(page, 'Computer A1', '192.168.2.10');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Details zu Nachricht' }).click();
  await expect(page.getByRole('dialog')).toContainText('Netzzugangsschicht');
});
