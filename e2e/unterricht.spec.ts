import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function start(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function oeffneBeispiel(page: Page, titel: string) {
  await start(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Beispiele' }).click();
  await page.getByRole('button', { name: `${titel} öffnen` }).click();
  const info = page.getByRole('status').filter({ hasText: 'ohne Internet' });
  if (await info.isVisible()) await info.getByRole('button', { name: 'Schließen' }).click();
}

async function waehle(page: Page, name: string) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganzes Netz anzeigen' }).click();
  await page.locator('.react-flow__node', { hasText: name }).first().click();
}

const auftrag = (page: Page) => page.getByRole('region', { name: /Arbeitsauftrag/ });

test('Diagnoseaufgabe: Hilfen aufdecken, Fehler beheben, Lösung prüfen', async ({ page }) => {
  test.slow();
  await oeffneBeispiel(page, 'Fehlersuche: Warum lädt die Seite nicht?');
  // Aufbau gesperrt: keine Bausteine
  await expect(page.getByRole('button', { name: 'Computer hinzufügen' })).toHaveCount(0);
  await expect(auftrag(page)).toContainText('nur einstellen');

  await auftrag(page).getByRole('button', { name: 'Lösung prüfen' }).click();
  await expect(auftrag(page)).toContainText('Noch 2 Bedingungen offen.');

  await auftrag(page).getByRole('button', { name: 'Hilfe 1 von 3 anzeigen' }).click();
  await expect(auftrag(page)).toContainText('Ein Fehler ist schon am Netzplan zu sehen');
  await expect(auftrag(page).getByRole('button', { name: 'Hilfe 2 von 3 anzeigen' })).toBeVisible();

  // Fehler 1: doppelte IP-Adresse
  await waehle(page, 'Computer 2');
  await page.getByRole('textbox', { name: 'IP-Adresse' }).fill('192.168.0.11');
  await page.getByRole('textbox', { name: 'IP-Adresse' }).press('Enter');
  // Fehler 2: falscher DNS-Server
  await waehle(page, 'Computer 1');
  await page.getByRole('textbox', { name: 'DNS-Server' }).fill('192.168.0.3');
  await page.getByRole('textbox', { name: 'DNS-Server' }).press('Enter');
  // Fehler 3: Tippfehler in der DNS-Tabelle
  await waehle(page, 'DNS-Rechner');
  await page.getByRole('textbox', { name: 'Domain 1' }).fill('www.schule.test');
  await page.getByRole('textbox', { name: 'Domain 1' }).press('Enter');

  await auftrag(page).getByRole('button', { name: 'Lösung prüfen' }).click();
  await expect(auftrag(page)).toContainText('Geschafft! Alle Bedingungen sind erfüllt.');
});

test('Lehrkraft erstellt Aufgabe mit Blackbox und Prüfung; sie wird in der Datei gespeichert', async ({
  page,
}, info) => {
  await oeffneBeispiel(page, 'Erstes lokales Rechnernetz');
  await page.locator('summary', { hasText: 'Mehr' }).click();
  await page.getByRole('button', { name: /Aufgabe bearbeiten/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Aufgabe bearbeiten' });
  await dialog.getByLabel('Titel').fill('Wer ist der Switch?');
  await dialog
    .getByLabel('Arbeitsauftrag', { exact: true })
    .fill('Finde heraus, welche IP-Adresse Computer B hat.');
  await dialog.getByLabel('Hilfe 1 (optional)').fill('Schicke Nachrichten und sieh ins Protokoll.');
  await dialog.getByRole('checkbox', { name: 'Computer B' }).check();
  await dialog.getByRole('button', { name: 'Aufgabe übernehmen' }).click();

  await expect(auftrag(page)).toContainText('Wer ist der Switch?');
  const b = page.locator('.react-flow__node', { hasText: 'Computer B' });
  await expect(b).toContainText('Blackbox');
  await expect(b).not.toContainText('192.168.0.11');
  await waehle(page, 'Computer B');
  await expect(page.getByText('Das Innenleben dieses Geräts ist verborgen.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'IP-Adresse' })).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const pfad = info.outputPath('aufgabe.json');
  await (await download).saveAs(pfad);
  const datei = JSON.parse(await readFile(pfad, 'utf8'));
  expect(datei.aufgabe).toMatchObject({
    titel: 'Wer ist der Switch?',
    blackbox: ['g2'],
    hilfen: expect.arrayContaining(['Schicke Nachrichten und sieh ins Protokoll.']),
  });
});

test('Glossar und Netzplan als Bild', async ({ page }) => {
  await oeffneBeispiel(page, 'Schulnetz mit Webserver und DNS');
  await page.locator('summary', { hasText: 'Mehr' }).click();
  await page.getByRole('button', { name: /Glossar/ }).click();
  const glossar = page.getByRole('dialog', { name: /Glossar/ });
  await expect(glossar).toContainText('Namensauflösung');
  await expect(glossar).not.toContainText('Sequenzdiagramm'); // erst ab Klasse 11
  await glossar.getByLabel('Klassenstufe').selectOption('11');
  await expect(glossar).toContainText('Sequenzdiagramm');
  await page.keyboard.press('Escape');

  await page.locator('summary', { hasText: 'Mehr' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Netzplan als Bild/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
