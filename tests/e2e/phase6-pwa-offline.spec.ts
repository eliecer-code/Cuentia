import { expect, test } from '@playwright/test'

test.describe('Fase 6 — PWA instalable, bloqueo offline honesto y dispositivo compartido', () => {
  test('expone manifest.webmanifest instalable, bloquea escrituras sin conexión y recupera al reconectar', async ({
    page,
    context,
    request,
  }) => {
    // 1. Verificar Web App Manifest e íconos PWA
    const manifestRes = await request.get('/manifest.webmanifest')
    expect(manifestRes.ok()).toBe(true)
    const manifest = (await manifestRes.json()) as {
      short_name: string
      display: string
      theme_color: string
      background_color: string
    }
    expect(manifest.short_name).toBe('Cuentia')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#145343')
    expect(manifest.background_color).toBe('#FAF9F6')

    const swRes = await request.get('/sw.js')
    expect(swRes.ok()).toBe(true)
    const swText = await swRes.text()
    expect(swText).toContain('isFinancialOrAuthApi')

    // 2. Abrir Dashboard en línea
    await page.goto('/')
    const fiarBtn = page.getByRole('button', { name: 'Fiar', exact: true })
    const abonarBtn = page.getByRole('button', { name: 'Abonar', exact: true })
    await expect(fiarBtn).toBeEnabled()
    await expect(abonarBtn).toBeEnabled()

    // 3. Simular caída de señal móvil -> aparece banner honesto y se bloquean escrituras financieras
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    await expect(page.getByText(/sin internet · solo consulta/i)).toBeVisible()
    await expect(fiarBtn).toBeDisabled()
    await expect(abonarBtn).toBeDisabled()

    // 4. Simular reconexión -> desaparece banner y se reactivan botones
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    await expect(page.getByText(/sin internet · solo consulta/i)).toBeHidden()
    await expect(fiarBtn).toBeEnabled()
    await expect(abonarBtn).toBeEnabled()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('pantalla Más permite limpiar caché temporal en dispositivo compartido sin overflow', async ({
    page,
  }) => {
    await page.goto('/mas')
    await page.evaluate(() => {
      window.sessionStorage.setItem('cuentia.cache.v1:u1:s1:customers:list', '{"data":[]}')
    })

    await page.getByRole('button', { name: /limpiar caché de mostrador/i }).click()
    await expect(page.getByText(/datos temporales de lectura eliminados de este dispositivo/i)).toBeVisible()

    const residual = await page.evaluate(() =>
      window.sessionStorage.getItem('cuentia.cache.v1:u1:s1:customers:list'),
    )
    expect(residual).toBeNull()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
