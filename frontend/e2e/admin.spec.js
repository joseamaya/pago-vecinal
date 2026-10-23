const { test, expect } = require('@playwright/test');
const { login, openUserMenu } = require('./helpers');

test('admin can navigate payments and profile', async ({ page }) => {
  await login(page);

  await expect(page.getByText('Ingresos y gastos')).toBeVisible();

  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await navigation.getByText('Pagos', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pagos', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo pago' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nuevo pago' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(3);
  await expect(page.getByRole('combobox').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo pago' })).toBeHidden();

  await openUserMenu(page);
  await page.getByText('Mi perfil').click();
  await expect(page.getByRole('heading', { name: 'Mi perfil', level: 1 })).toBeVisible();
});
