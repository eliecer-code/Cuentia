import { expect, test } from '@playwright/test'

test.describe('Fase 5 — Reportes, Morosos y Configuración de Tienda', () => {
  test('pantalla Reportes separa stock vs flujo, muestra cuadre de pago, filtra morosos y abre recordatorio WhatsApp sin overflow', async ({
    page,
  }) => {
    await page.goto('/reportes')
    await expect(page.getByRole('heading', { name: /reportes y morosos/i })).toBeVisible()

    // Stock vs Flujo separados
    await expect(page.getByText(/cartera total hoy \(stock\)/i)).toBeVisible()
    await expect(page.getByText(/fiado en el período/i)).toBeVisible()
    await expect(page.getByText(/abonos recaudados/i)).toBeVisible()
    await expect(page.getByText(/cuadre de abonos por medio de pago/i)).toBeVisible()

    // Filtrar tramo +60 días -> muestra Luis Fernando Díaz (65d)
    await page.getByRole('tab', { name: '+60 días' }).click()
    await expect(page.getByText('Luis Fernando Díaz')).toBeVisible()

    // Abrir recordatorio de WhatsApp
    await page.getByRole('button', { name: /recordar por whatsapp/i }).first().click()
    await expect(page.getByRole('heading', { name: /recordatorio de saldo por whatsapp/i })).toBeVisible()
    const waLink = page.getByRole('link', { name: /abrir en whatsapp/i })
    await expect(waLink).toHaveAttribute('href', /https:\/\/wa\.me\/573120000084\?text=/)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('pantalla Configuración actualiza reglas, vista previa de plantilla WhatsApp y guarda en auditoría sin overflow', async ({
    page,
  }) => {
    await page.goto('/configuracion')
    await expect(page.getByRole('heading', { name: /configuración de tienda/i })).toBeVisible()

    await page.getByLabel(/nombre de la tienda/i).fill('Granero El Sol')
    await page.getByRole('button', { name: '+ {cliente}' }).click()

    await expect(page.getByText(/Granero El Sol/).first()).toBeVisible()

    await page.getByRole('button', { name: /guardar configuración/i }).click()
    await expect(page.getByText(/configuración de la tienda guardada y registrada en auditoría/i)).toBeVisible()
    await expect(page.getByText('store.settings_updated')).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
