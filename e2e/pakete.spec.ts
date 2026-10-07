import { expect, test, type Page } from '@playwright/test';

async function oeffneBeispiel(page: Page, titel: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: `${titel} öffnen` }).click();
  await page.getByRole('button', { name: 'Arbeitsauftrag ausblenden' }).click();
  const info = page.getByRole('status').filter({ hasText: 'ohne Internet' });
  if (await info.isVisible()) await info.getByRole('button', { name: 'Schließen' }).click();
}

async function waehle(page: Page, name: string) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await page.locator('.react-flow__node', { hasText: name }).first().click();
}

const protokoll = (page: Page) => page.locator('table tbody').last();

test('Nachricht in Paketen über verschiedene Wege – Teile werden neu zusammengesetzt (TK 4)', async ({
  page,
}) => {
  test.slow();
  await oeffneBeispiel(page, 'Paketvermittlung: Teile auf verschiedenen Wegen');
  await expect(page.locator('.react-flow__edge').getByText('3 Schritte')).toHaveCount(0); // Etikett liegt im Label-Layer
  await expect(page.getByText('⏱ 3 Schritte')).toBeVisible();

  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('slider', { name: 'Tempo' }).fill('3');
  await page.locator('summary', { hasText: 'Einstellungen' }).click();
  await page.getByLabel('Pakete dürfen verschiedene Wege nehmen').check();
  await page.locator('summary', { hasText: 'Einstellungen' }).click();

  await waehle(page, 'Sender');
  await page.getByLabel('In Paketen senden').check();
  await page.getByLabel('Text', { exact: true }).fill('Netzwerkstatt');
  await page.getByLabel('Zeichen pro Paket').fill('2');
  await page.getByLabel('An IP-Adresse').fill('192.168.2.10');
  await page.getByRole('button', { name: 'Senden' }).click();

  await expect(protokoll(page)).toContainText('in 7 Teile zerlegt');
  await expect(protokoll(page)).toContainText(
    'Nachricht zusammengesetzt: „Netzwerkstatt“ (Teile kamen in anderer Reihenfolge an)',
    {
      timeout: 45_000,
    },
  );

  await waehle(page, 'Empfänger');
  const puffer = page.getByRole('region', { name: 'Empfangene Teile' });
  await expect(puffer).toContainText('„Ne“');
  await expect(puffer).toContainText('Reihenfolge der Ankunft:');
  await expect(puffer).not.toContainText('fehlt');
});

test('gestörte Leitung einstellen und im Netzplan sehen', async ({ page }) => {
  await oeffneBeispiel(page, 'Paketvermittlung: Teile auf verschiedenen Wegen');
  await waehle(page, 'Router 4');
  await page.getByRole('button', { name: 'Kabel → Empfänger' }).click();
  await page.getByLabel('Störung: Pakete gehen verloren').selectOption('25');
  await expect(page.getByText('⚡ 25 % Verlust')).toBeVisible();
  await page.getByLabel('Laufzeit der Leitung').selectOption('2');
  await expect(page.getByText('⚡ 25 % Verlust · ⏱ 2 Schritte')).toBeVisible();
});

test('In Klasse 7/8 gibt es kein „In Paketen senden“', async ({ page }) => {
  await oeffneBeispiel(page, 'Erstes lokales Rechnernetz');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await waehle(page, 'Computer A');
  await expect(page.getByLabel('An IP-Adresse')).toBeVisible();
  await expect(page.getByLabel('In Paketen senden')).toHaveCount(0);
  await expect(page.locator('summary', { hasText: 'Einstellungen' })).toHaveCount(0);
});
