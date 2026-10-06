import { defineConfig, devices } from '@playwright/test';

// Getestet wird gegen den Produktions-Build (vite preview), so wie Schüler:innen die App erhalten.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
  ],
});
