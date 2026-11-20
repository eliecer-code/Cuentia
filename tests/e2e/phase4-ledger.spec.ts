import { expect, test } from '@playwright/test'

test.describe('Fase 4 — Libro Mayor, Abonos, WhatsApp y Movimientos', () => {
  test('registra fiado, abono parcial, abre vista previa WhatsApp y evita overflow', async ({ page }) => {
    await page.goto('/clientes/demo-c1')

    await expect(page.getByText('$ 185.000').first()).toBeVisible()

    // 1. Registrar compra fiada de $ 15.000 -> saldo pasa a $ 200.000
    await page.getByRole('button', { name: 'Fiar', exact: true }).click()
    await page.getByRole('button', { name: '+10.000' }).click()
    await page.getByRole('button', { name: '+5.000' }).click()
    await page.getByRole('button', { name: /^Fiar \$ 15\.000$/i }).click()

    await expect(page.getByText(/saldo actual: \$ 200\.000/i)).toBeVisible()
    await page.getByRole('button', { name: /listo, cerrar/i }).click()
    await expect(page.getByText('$ 200.000').first()).toBeVisible()

    // 2. Registrar abono de $ 50.000 por Nequi -> saldo pasa a $ 150.000 + abrir comprobante WhatsApp
    await page.getByRole('button', { name: 'Abonar', exact: true }).click()
    await page.getByRole('button', { name: '+50.000' }).click()
    await page.getByRole('button', { name: 'Nequi', exact: true }).click()
    await page.getByRole('button', { name: /^Abonar \$ 50\.000$/i }).click()

    await expect(page.getByText(/abono de \$ 50\.000 \(nequi\)/i)).toBeVisible()
    await page.getByRole('button', { name: /enviar comprobante por whatsapp/i }).click()

    const waLink = page.getByRole('link', { name: /abrir en whatsapp/i })
    await expect(waLink).toBeVisible()
    const href = await waLink.getAttribute('href')
    expect(href).toContain('https://wa.me/573124567890?text=')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('pantalla Movimientos filtra por tipo y abre detalle de asiento', async ({ page }) => {
    await page.goto('/movimientos')
    await expect(page.getByRole('heading', { name: 'Movimientos', exact: true })).toBeVisible()
    await expect(page.getByText('Don Carlos Pérez')).toBeVisible()

    await page.getByLabel('Filtrar por tipo de movimiento').selectOption('payment')
    await expect(page.getByText('Doña Marta Gómez')).toBeVisible()
    await expect(page.getByText('Don Carlos Pérez')).toBeHidden()

    await page.getByText('Doña Marta Gómez').click()
    await expect(page.getByRole('heading', { name: /movimiento #039/i })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
