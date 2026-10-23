const { test, expect } = require('@playwright/test');
const { login, openUserMenu, logout } = require('./helpers');

test('owner can register, update profile and change password', async ({ page }) => {
  const email = `e2e-owner-${Date.now()}@example.com`;
  const initialPassword = 'OwnerPass123!';
  const newPassword = 'OwnerPass456!';

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Registrarme' }).click();
  await page.getByLabel('Nombre completo').fill('Owner E2E');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(initialPassword);
  await page.getByLabel('Teléfono (opcional)').fill('999999999');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola,');
  await expect(page.getByText('Evolución de deuda')).toBeVisible();
  await expect(page.getByText('Sin deuda pendiente')).toBeVisible();

  await openUserMenu(page);
  await page.getByText('Mi perfil').click();
  await expect(page.getByRole('heading', { name: 'Mi perfil', level: 1 })).toBeVisible();

  await page.getByLabel('Teléfono', { exact: true }).fill('988888888');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil actualizado correctamente')).toBeVisible();

  await page.getByRole('textbox', { name: /Contraseña actual/ }).fill(initialPassword);
  await page.getByRole('textbox', { name: /Nueva contraseña/ }).fill(newPassword);
  await page.getByRole('textbox', { name: /Confirmar nueva contraseña/ }).fill(newPassword);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('Contraseña actualizada correctamente')).toBeVisible();

  await logout(page);
  await login(page, { email, password: newPassword });
});
