import { expect, test, type Page } from '@playwright/test';

/** Lädt ein Netz über den Zwischenspeicher – schneller und robuster als es per Hand aufzubauen. */
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
const lan = [
  { id: 'g1', typ: 'computer', name: 'Computer 1', ip: '192.168.0.10', ...pos(0, 0) },
  { id: 'g2', typ: 'switch', name: 'Switch 1', ...pos(250, 0) },
  { id: 'g3', typ: 'server', name: 'Server 1', ip: '192.168.0.2', ...pos(500, 0) },
];
const lanLeitungen = [
  { id: 'l1', art: 'kabel', von: 'g1', nach: 'g2' },
  { id: 'l2', art: 'kabel', von: 'g3', nach: 'g2' },
];

const knoten = (page: Page, name: string) => page.locator('.react-flow__node', { hasText: name });

async function ausprobieren(page: Page) {
  await page.getByRole('radio', { name: 'Ausprobieren' }).check({ force: true });
}

async function sende(page: Page, von: string, zielIp: string) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await knoten(page, von).click();
  await page.getByLabel('An IP-Adresse').fill(zielIp);
  await page.getByRole('button', { name: 'Senden' }).click();
}

const zeilen = (page: Page) => page.locator('table tbody tr');

test('IP-Adresse eintragen und Vorschlag nutzen', async ({ page }) => {
  await ladeNetz(page, lan, lanLeitungen);
  await page.getByRole('button', { name: 'Computer hinzufügen' }).click();
  const ipFeld = page.getByRole('textbox', { name: 'IP-Adresse' });
  await page.getByRole('button', { name: 'Vorschlag' }).click();
  await expect(ipFeld).toHaveValue('192.168.0.11');
  await ipFeld.fill('192.168.0.300');
  await ipFeld.press('Enter');
  await expect(knoten(page, 'Computer 2')).toContainText('IP ungültig');
  await expect(page.getByText('Eine IP-Adresse besteht aus vier Zahlen')).toBeVisible();
});

test('doppelte IP-Adresse wird am Gerät markiert', async ({ page }) => {
  await ladeNetz(
    page,
    [...lan, { id: 'g4', typ: 'computer', name: 'Computer 2', ip: '192.168.0.10', ...pos(250, 200) }],
    [...lanLeitungen, { id: 'l3', art: 'kabel', von: 'g4', nach: 'g2' }],
  );
  await expect(knoten(page, 'Computer 1')).toContainText('IP doppelt');
  await expect(knoten(page, 'Computer 2')).toContainText('IP doppelt');
  await expect(knoten(page, 'Server 1')).not.toContainText('IP doppelt');
});

test('Nachricht senden: über den Switch zum Server und zurück', async ({ page }) => {
  await ladeNetz(page, lan, lanLeitungen);
  await ausprobieren(page);
  await expect(page.getByRole('toolbar', { name: 'Simulation' })).toBeVisible();
  await sende(page, 'Computer 1', '192.168.0.2');
  await expect(page.locator('[class*=paket]').first()).toBeVisible();
  await expect(zeilen(page)).toHaveCount(6, { timeout: 15_000 });
  await expect(zeilen(page).nth(2)).toContainText('Server 1');
  await expect(zeilen(page).nth(2)).toContainText('empfangen');
  await expect(zeilen(page).nth(5)).toContainText('Antwort von 192.168.0.2 empfangen');
});

test('Einzelschritt: Pakete Schritt für Schritt verfolgen', async ({ page }) => {
  await ladeNetz(page, lan, lanLeitungen);
  await ausprobieren(page);
  // Vorher auf „Schritt für Schritt“ stellen: Die Nachricht wartet dann am Startgerät.
  await page.getByRole('button', { name: 'Einzelschritt' }).click();
  await sende(page, 'Computer 1', '192.168.0.2');
  await expect(page.getByText('Schritt 0')).toBeVisible();
  await expect(zeilen(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Einzelschritt' }).click();
  await expect(page.getByText('Schritt 1')).toBeVisible({ timeout: 5000 });
  await expect(zeilen(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Abspielen' }).click();
  await expect(zeilen(page)).toHaveCount(6, { timeout: 15_000 });
});

test('verständliche Meldung beim Senden in ein anderes Netz', async ({ page }) => {
  await ladeNetz(page, lan, lanLeitungen);
  await ausprobieren(page);
  await sende(page, 'Computer 1', '10.0.0.1');
  await expect(page.getByRole('alert')).toContainText('liegt nicht im Netz von Computer 1 (192.168.0.x)');
  await expect(zeilen(page).first()).toContainText('Nicht gesendet');
});

test('Nachricht an unbekannte IP-Adresse geht am Switch verloren', async ({ page }) => {
  await ladeNetz(page, lan, lanLeitungen);
  await ausprobieren(page);
  await sende(page, 'Computer 1', '192.168.0.99');
  await expect(zeilen(page).last()).toContainText('kein Gerät mit dieser IP-Adresse', { timeout: 10_000 });
});
