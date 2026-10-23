const { test, expect } = require('@playwright/test');

test('validates the login form before calling the API', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Correo electrónico').fill('not-an-email');
  await page.getByLabel('Contraseña', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText('Ingresa un correo electrónico válido.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('rejects invalid credentials at the API', async ({ request }) => {
  const backendPort = process.env.E2E_BACKEND_PORT || '8100';
  const response = await request.post(`http://127.0.0.1:${backendPort}/auth/login`, {
    form: { username: 'nobody@example.com', password: 'wrong-password' },
  });

  expect(response.status()).toBe(401);
});
