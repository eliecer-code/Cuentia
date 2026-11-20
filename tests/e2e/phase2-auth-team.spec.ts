import { expect, test } from '@playwright/test'

test.describe('Fase 2 — Pantallas de Autenticación, Onboarding y Equipo', () => {
  test('Login valida campos, alterna visibilidad de contraseña y no tiene overflow horizontal', async ({ page }) => {
    await page.goto('/entrar')

    await expect(page.getByRole('heading', { name: /entrar a tu tienda/i })).toBeVisible()
    await page.getByRole('button', { name: /entrar a mi tienda/i }).click()
    await expect(page.getByText(/correo electrónico válido/i)).toBeVisible()

    const passInput = page.getByLabel('Contraseña', { exact: true })
    await passInput.fill('ClaveSegura2026!')
    await page.getByRole('button', { name: /ver contraseña/i }).click()
    await expect(passInput).toHaveAttribute('type', 'text')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('Registro paso 1 y Onboarding de tienda paso 2 validan entradas colombianas', async ({ page }) => {
    await page.goto('/crear-cuenta')
    await expect(page.getByRole('heading', { name: /crea tu cuenta/i })).toBeVisible()
    await page.getByLabel('Tu nombre').fill('Marta Rodríguez')
    await page.getByLabel('Correo electrónico').fill('marta@tienda.co')
    await page.getByLabel('Contraseña', { exact: true }).fill('corta')
    await page.getByRole('button', { name: /continuar al paso 2/i }).click()
    await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible()

    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: /nombra tu tienda/i })).toBeVisible()
    await expect(page.getByText(/colombia · pesos/i)).toBeVisible()
    await page.getByLabel('Nombre de la tienda').fill('A')
    await page.getByRole('button', { name: /entrar a mi cuaderno digital/i }).click()
    await expect(page.getByText(/mínimo 2 letras/i)).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('Pantalla de Equipo muestra roles y abre Drawer de invitación sin overflow', async ({ page }) => {
    await page.goto('/equipo')
    await expect(page.getByRole('heading', { name: /equipo y permisos/i })).toBeVisible()
    await expect(page.getByText('Dueño', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Administrador', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Empleado', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /invitar empleado/i }).click()
    await expect(page.getByRole('heading', { name: /invitar colaborador/i })).toBeVisible()
    await page.getByRole('button', { name: /crear invitación/i }).click()
    await expect(page.getByText(/correo válido del colaborador/i)).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
