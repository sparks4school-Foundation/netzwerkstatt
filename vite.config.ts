/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH wird beim GitHub-Pages-Build gesetzt (z. B. "/netzwerkstatt/").
// Für eigenen Webspace oder eigene Domain bleibt es "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Kein Workbox-CDN: alles wird mitgeliefert, damit keine externen Requests entstehen.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      pwaAssets: { config: true },
      manifest: {
        name: 'Netzwerkstatt',
        short_name: 'Netzwerkstatt',
        description: 'Netzwerk-Simulator für den Informatikunterricht',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1f4e79',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
