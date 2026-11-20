import { expect, test } from '@playwright/test'

test.describe('Fase 8 — Cumplimiento Legal Colombia y Política Ética de Datos', () => {
  test('navega desde Más hacia Marco Legal Colombia (/legal), verifica Ley 1581/2300 y garantía ética ADR-06 sin overflow', async ({
    page,
  }) => {
    await page.goto('/mas')
    await page.getByRole('link', { name: /marco legal colombia y tus datos/i }).click()

    await expect(
      page.getByRole('heading', { name: /marco legal colombia y compromiso de datos/i }),
    ).toBeVisible()
    await expect(page.getByText(/no somos una entidad financiera/i)).toBeVisible()
    await expect(page.getByText(/ley 1581 de 2012/i).first()).toBeVisible()
    await expect(page.getByText(/ley 2300 de 2023/i).first()).toBeVisible()
    await expect(
      page.getByText(/Lectura=SI · Abonos=SI · Exportación CSV=SI/),
    ).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
