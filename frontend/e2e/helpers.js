const { expect } = require('@playwright/test');

const admin = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@pago-vecinal.com',
  password: process.env.E2E_ADMIN_PASSWORD || 'E2ePass123!',
};

async function login(page, credentials = admin) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(credentials.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola,');
}

async function openUserMenu(page) {
  await page.getByRole('button', { name: 'Abrir menú de usuario' }).click();
}

async function logout(page) {
  await openUserMenu(page);
  await page.getByText('Cerrar sesión').click();
  await expect(page).toHaveURL(/\/login/);
}

module.exports = { admin, login, openUserMenu, logout };
