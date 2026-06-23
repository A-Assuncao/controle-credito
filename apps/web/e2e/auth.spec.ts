import { test, expect } from '@playwright/test';

/**
 * Suite Playwright basica para apps/web.
 *
 * Cobre o caminho feliz de auth:
 *  - GET / (redirect para /login)
 *  - GET /login (form renderiza)
 *  - GET /dashboard (redirect para /login sem sessao)
 *
 * NAO testa login completo aqui - depende do apps/api estar rodando com
 * um user seed. Para teste end-to-end completo (login + dashboard), use
 * o MCP playwright interativamente e/ou criar helper de seed.
 */

test.describe('apps/web auth flow', () => {
  test('GET / redireciona para /login quando nao autenticado', async ({ page }) => {
    const response = await page.goto('/');
    // NextAuth + middleware devem redirecionar para /login
    expect(response?.url()).toMatch(/\/login/);
  });

  test('GET /login renderiza form de email e senha', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('GET /dashboard redireciona para /login sem sessao', async ({ page }) => {
    await page.goto('/dashboard');
    expect(page.url()).toMatch(/\/login/);
  });

  test('login com credenciais invalidas permanece em /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('inexistente@example.com');
    await page.getByLabel('Senha').fill('wrong-password-12345');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Permanece em /login (signIn retorna erro -> redirectTo nao acontece).
    // Pode demorar um pouco para o NextAuth processar.
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/login/);
  });
});
