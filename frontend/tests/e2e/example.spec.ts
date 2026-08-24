import { test, expect } from '@playwright/test';

test('Debe cargar la aplicación y mostrar el Dashboard', async ({ page }) => {
  // Ir a la raíz de la app
  await page.goto('/');

  // Esperar a que el título principal en la sidebar esté visible
  const brandTitle = page.getByText('UPS Control');
  await expect(brandTitle).toBeVisible();

  // Verificar que el menú lateral cargue la opción de Dashboard
  const dashboardMenu = page.getByText('Dashboard General');
  await expect(dashboardMenu).toBeVisible();
});
