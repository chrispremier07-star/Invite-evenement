import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile('.env.test');
  process.loadEnvFile('.env');
} catch {
  /* variables fournies par l'environnement (CI) */
}
// Les workers rechargent ce fichier : seule la commande principale réinitialise la base.
if (process.env.TEST_WORKER_INDEX === undefined)
  execFileSync(process.execPath, ['e2e/reset-db.mjs'], { stdio: 'inherit' });
const PORT = 3200;
const base = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { baseURL: base, locale: 'fr-FR', timezoneId: 'Africa/Abidjan', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /form\.spec/ },
  ],
  webServer: {
    command: 'node apps/api/dist/server.js',
    url: `${base}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...(process.env as Record<string, string>),
      NODE_ENV: 'development',
      PORT: String(PORT),
      PUBLIC_URL: base,
      STUDIO_URL: `${base}/studio/`,
      ALLOWED_ORIGINS: base,
      DATABASE_URL: process.env.DATABASE_URL!.replace(/\/[^/]+$/, '/cree_e2e'),
      LOGIN_LINK_COOLDOWN_SECONDS: '0',
      RATE_GLOBAL_PER_MINUTE: '100000',
      RATE_SUBMIT_PER_HOUR: '100000',
      RATE_UPLOAD_PER_HOUR: '100000',
      RATE_AUTH_PER_HOUR: '100000',
    },
  },
});
