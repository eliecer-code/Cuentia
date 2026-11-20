import { expect, test } from '@playwright/test'

test.describe('Fase 1 — App Shell mobile-first y escritorio', () => {
  test('muestra Total por cobrar separado de flujos y sin scroll horizontal', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /total por cobrar hoy/i })).toBeVisible()
    await expect(page.getByText('$ 1.845.000')).toBeVisible()
    await expect(page.getByText(/no es ganancia del día/i)).toBeVisible()

    // Sin overflow horizontal en viewport activo (390×844 o 1280×800)
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('cambia período del flujo (Hoy -> Semana) y abre el Drawer COP', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('tab', { name: 'Semana' }).click()
    await expect(page.getByText('$ 642.000')).toBeVisible()
    await expect(page.getByText('$ 515.000')).toBeVisible()

    await page.getByRole('button', { name: /fiar/i }).click()
    await expect(page.getByRole('heading', { name: /registrar fiado/i })).toBeVisible()

    await page.getByRole('button', { name: '+20.000' }).click()
    await page.getByRole('button', { name: '+5.000' }).click()
    await expect(page.getByRole('button', { name: /^Fiar \$ 25\.000$/i })).toBeEnabled()
  })

  test('navega entre las 4 secciones del App Shell', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Clientes' }).first().click()
    await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Movimientos' }).first().click()
    await expect(page.getByRole('heading', { name: 'Movimientos', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Más' }).first().click()
    await expect(page.getByRole('heading', { name: 'Más opciones' })).toBeVisible()
  })
})
