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

test('DHCP holen, dann Website aus dem Internet über NAT laden', async ({ page }) => {
  test.slow();
  await oeffneBeispiel(page, 'Heimnetze und Internet (DHCP und NAT)');
  await expect(page.locator('.react-flow__node', { hasText: 'PC Familie A' })).toContainText('DHCP');

  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
  await page.getByRole('slider', { name: 'Tempo' }).fill('3');
  await waehle(page, 'PC Familie A');
  await page.getByRole('button', { name: 'IP-Adresse per DHCP holen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Adresse erhalten' })).toContainText(
    '192.168.178.100',
    {
      timeout: 30_000,
    },
  );
  await expect(page.locator('.react-flow__node', { hasText: 'PC Familie A' })).toContainText(
    '192.168.178.100 (DHCP)',
  );

  await page.getByRole('radio', { name: 'Sequenzdiagramm' }).check({ force: true });
  const bild = page.getByRole('img', { name: /Sequenzdiagramm/ });
  for (const t of ['DHCP-Discover', 'DHCP-Offer', 'DHCP-Request', 'DHCP-Ack'])
    await expect(bild).toContainText(t);
  await page.getByRole('radio', { name: 'Protokoll' }).check({ force: true });

  await page.getByRole('button', { name: 'Browser öffnen' }).click();
  await page.getByLabel('Adresse', { exact: true }).fill('www.beispiel.test');
  await page.getByRole('button', { name: 'Aufrufen' }).click();
  await expect(page.frameLocator('iframe[title^="http://"]').getByRole('heading')).toHaveText(
    'Willkommen im Internet',
    {
      timeout: 40_000,
    },
  );
  await expect(page.locator('table tbody').last()).toContainText(
    'NAT: Absender 192.168.178.100 wird zu 203.0.113.2',
  );

  await page.getByRole('button', { name: 'Schließen' }).first().click();
  await waehle(page, 'Heimrouter A');
  const nat = page.locator('section', { hasText: 'NAT-Tabelle' }).last();
  await expect(nat).toContainText('192.168.178.100');
  await expect(nat).toContainText('203.0.113.2:50001');
});

test('Aufbauen: DHCP-Schalter am Endgerät, DHCP-Server und NAT am Router (nur Klasse 11)', async ({
  page,
}) => {
  await oeffneBeispiel(page, 'Zwei Netze mit Router');
  await waehle(page, 'Computer A1');
  await page.getByLabel('IP-Adresse automatisch beziehen (DHCP)').check();
  await expect(page.getByRole('textbox', { name: 'IP-Adresse' })).toHaveCount(0);
  await expect(page.getByText('bekommt dieses Gerät beim Ausprobieren von einem DHCP-Server')).toBeVisible();

  await waehle(page, 'Router');
  await page.getByRole('button', { name: 'DHCP-Server installieren' }).click();
  await expect(page.getByRole('textbox', { name: 'Adressen von' })).toHaveValue('192.168.1.100');
  await page.getByLabel('führt ins Internet (NAT)').first().check();
  await expect(page.getByText('NAT-Tabelle')).toBeVisible();

  await page.getByRole('radio', { name: 'Klasse 7/8' }).check({ force: true });
  await waehle(page, 'Server B');
  await expect(page.getByRole('button', { name: 'DHCP-Server installieren' })).toHaveCount(0);
});
