import { expect, test, type Page } from '@playwright/test';

async function oeffneBeispiel(page: Page, titel: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: `${titel} öffnen` }).click();
  await page.getByRole('button', { name: 'Arbeitsauftrag ausblenden' }).click();
}

const knoten = (page: Page, name: string) => page.locator('.react-flow__node', { hasText: name });

async function waehle(page: Page, name: string) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await knoten(page, name).first().click();
}

async function sende(page: Page, von: string, zielIp: string) {
  await waehle(page, von);
  await page.getByLabel('An IP-Adresse').fill(zielIp);
  await page.getByRole('button', { name: 'Senden' }).click();
}

const protokoll = (page: Page) => page.locator('table tbody').last();

test('Router zeigt Anschlüsse und automatische Routingtabelle (Whitebox)', async ({ page }) => {
  await oeffneBeispiel(page, 'Vermaschtes Netz: Umweg bei Ausfall');
  await expect(page.getByRole('radio', { name: 'Klasse 11' })).toBeChecked();
  await expect(knoten(page, 'Router 1')).toContainText('192.168.1.1');
  await waehle(page, 'Router 1');
  await expect(page.getByText('Anschluss zu Router 3')).toBeVisible();
  const tabelle = page
    .getByRole('region', { name: 'Routingtabelle' })
    .or(page.locator('section', { hasText: 'Routingtabelle' }))
    .last();
  await expect(tabelle).toContainText('192.168.2.0/24');
  await expect(tabelle).toContainText('10.0.13.3');
});

test('Routing: Nachricht über Router, bei Leitungsausfall Umweg', async ({ page }) => {
  test.slow();
  await oeffneBeispiel(page, 'Vermaschtes Netz: Umweg bei Ausfall');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('slider', { name: 'Tempo' }).fill('3');

  await sende(page, 'PC A', '192.168.2.10');
  await expect(protokoll(page)).toContainText('Antwort von 192.168.2.10 empfangen', { timeout: 20_000 });
  await expect(protokoll(page)).toContainText('laut Routingtabelle: 192.168.2.0/24 über 10.0.13.3');
  await expect(protokoll(page)).not.toContainText('Router 2');

  // Leitung Router 1 – Router 3 ausfallen lassen (über die Leitungsliste von Router 1)
  await waehle(page, 'Router 1');
  await page.getByRole('button', { name: 'Kabel → Router 3' }).click();
  await page.getByLabel('Leitung ausgefallen (Störung simulieren)').check();
  await expect(page.locator('.react-flow__edge', { hasText: '' }).locator('[data-ausgefallen]')).toHaveCount(
    1,
  );

  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await sende(page, 'PC A', '192.168.2.10');
  await expect(protokoll(page)).toContainText('Antwort von 192.168.2.10 empfangen', { timeout: 20_000 });
  await expect(protokoll(page)).toContainText('über 10.0.12.2');
});

test('Gateway fehlt: verständliche Meldung', async ({ page }) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await waehle(page, 'Computer A1');
  await page.getByRole('textbox', { name: 'Gateway' }).fill('');
  await page.getByRole('textbox', { name: 'Gateway' }).press('Enter');
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await sende(page, 'Computer A1', '192.168.2.10');
  await expect(page.getByRole('alert')).toContainText('Trage bei Computer A1 ein Gateway ein');
});

test('private Adressen werden in Klasse 11 gekennzeichnet', async ({ page }) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await waehle(page, 'Computer A1');
  await expect(page.getByText('privat (lokal)')).toBeVisible();
  await page.getByRole('textbox', { name: 'IP-Adresse' }).fill('8.8.8.8');
  await page.getByRole('textbox', { name: 'IP-Adresse' }).press('Enter');
  await expect(page.getByText('öffentlich (global)')).toBeVisible();
});

test('Routingtabelle von Hand: Zeile bearbeiten', async ({ page }) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await waehle(page, 'Router');
  await page.getByRole('radio', { name: 'von Hand' }).check({ force: true });
  await expect(page.getByRole('textbox', { name: 'Zielnetz 1' })).toHaveValue('192.168.1.0');
  await page.getByRole('button', { name: 'Route 2 entfernen' }).click();
  await expect(page.getByRole('textbox', { name: 'Zielnetz 2' })).toHaveCount(0);
  await page.getByRole('button', { name: /Automatische Tabelle übernehmen/ }).click();
  await expect(page.getByRole('textbox', { name: 'Zielnetz 2' })).toHaveValue('192.168.2.0');
});
