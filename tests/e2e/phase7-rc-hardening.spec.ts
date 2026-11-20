import { expect, test } from '@playwright/test'

test.describe('Fase 7 — Hardening RC y Conciliación Contable en Vivo', () => {
  test('ejecuta conciliación de las 4 invariantes en Reportes con 0 discrepancias y sin overflow', async ({
    page,
  }) => {
    await page.goto('/reportes')
    await expect(
      page.getByRole('heading', { name: /verificación de integridad contable/i }),
    ).toBeVisible()

    await page.getByRole('button', { name: /verificar conciliación del libro mayor/i }).click()

    await expect(page.getByText('0 discrepancias · OK')).toBeVisible()
    await expect(
      page.getByText(/conciliación verificada: 3 clientes y 6 asientos auditados con 0 discrepancias/i),
    ).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
