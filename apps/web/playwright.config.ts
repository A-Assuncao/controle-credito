import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config para apps/web.
 *
 * Roda contra API+Web rodando (apps/api em :3001, apps/web em :3000).
 * Assume que ambos estao up antes do teste - use `pnpm dev:stack` ou
 * `docker-compose up` em paralelo.
 *
 * CI: webServer.start nao funciona em CI Linux (precisa de rede); use
 * `webServer.command` que sobe o Next via `pnpm dev` (com timeout).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1, // serial - login+logout compartilharia DB de teste
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
