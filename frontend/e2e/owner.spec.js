const { test, expect } = require('@playwright/test');
const { login, openUserMenu, logout } = require('./helpers');

test('admin creates an owner account that can update profile and change password', async ({ page }) => {
  const timestamp = Date.now();
  const email = `e2e-owner-${timestamp}@example.com`;
  const fullName = `Owner E2E ${timestamp}`;
  const initialPassword = 'OwnerPass123!';
  const newPassword = 'OwnerPass456!';

  await login(page);

  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });

  await navigation.getByText('Usuarios', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo usuario' }).first().click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Nombre completo').fill(fullName);
  await page.getByLabel('Teléfono').fill('999999999');
  await page.getByLabel('Contraseña inicial').fill(initialPassword);
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(page.getByText('Usuario creado correctamente')).toBeVisible();

  await navigation.getByText('Propietarios', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Propietarios', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo propietario' }).first().click();
  await page.getByLabel('Nombre completo').fill(fullName);
  await page.getByLabel('Teléfono').fill('999999999');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Cuenta vinculada').click();
  await page.getByRole('option', { name: new RegExp(email) }).click();
  await page.getByRole('button', { name: 'Crear propietario' }).click();
  await expect(page.getByText('Propietario creado correctamente')).toBeVisible();

  await logout(page);
  await login(page, { email, password: initialPassword });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola,');
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
