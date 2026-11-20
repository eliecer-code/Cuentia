import { expect, test } from '@playwright/test'

test.describe('Fase 3 — Gestión de Clientes', () => {
  test('lista, filtra, busca sin tildes y abre alta rápida con detección de homónimos y celular compartido', async ({ page }) => {
    await page.goto('/clientes')

    await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible()
    await expect(page.getByText('Don Carlos Pérez')).toBeVisible()

    // Búsqueda tolerante a tildes ("dona marta")
    const searchInput = page.getByLabel('Buscar cliente')
    await searchInput.fill('dona marta')
    await expect(page.getByText('Doña Marta Gómez')).toBeVisible()
    await expect(page.getByText('Don Carlos Pérez')).toBeHidden()

    // Búsqueda sin resultados ofrece CTA de creación rápida prellenado
    await searchInput.fill('Vecina Nueva')
    await expect(page.getByRole('button', { name: /crear "Vecina Nueva"/i })).toBeVisible()
    await page.getByRole('button', { name: /crear "Vecina Nueva"/i }).click()

    await expect(page.getByRole('heading', { name: /nuevo cliente/i })).toBeVisible()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Vecina Nueva')

    // Probar detección de homónimo y celular compartido sin bloquear hogares
    await page.getByLabel('Nombre completo').fill('Don Carlos Pérez')
    await expect(page.getByText(/ya existe un cliente con ese nombre/i)).toBeVisible()

    await page.getByLabel(/whatsapp \/ celular/i).fill('3124567890')
    await expect(page.getByText(/este celular ya pertenece a/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /guardar cliente/i })).toBeDisabled()

    await page.getByLabel(/familiar que comparte el mismo celular/i).check()
    await expect(page.getByRole('button', { name: /guardar cliente/i })).toBeEnabled()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('abre el perfil del cliente con saldo, tope y sin overflow horizontal', async ({ page }) => {
    await page.goto('/clientes/demo-c1')
    await expect(page.getByRole('heading', { name: 'Don Carlos Pérez' })).toBeVisible()
    await expect(page.getByText('$ 185.000', { exact: true })).toBeVisible()
    await expect(page.getByText(/tope de fiado: \$ 200\.000/i)).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
