import { expect, test } from '@playwright/test';

test('Startseite lädt mit deutscher Oberfläche', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Netzwerkstatt');
  await expect(page.getByRole('heading', { name: 'Netzwerkstatt' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Klasse 7/8' })).toBeChecked();
});

test('Klassenstufe lässt sich per Tastatur wechseln', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Klasse 7/8' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Klasse 11' })).toBeChecked();
});

test('lädt keine Ressourcen von fremden Servern', async ({ page, baseURL }) => {
  const fremd: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) fremd.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(fremd).toEqual([]);
});
