import { describe, expect, it } from 'vitest'
import {
  evaluateStorePlanCapabilities,
  FREE_PLAN_MAX_ACTIVE_CUSTOMERS,
} from '@/shared/lib/planPolicy'

describe('Fase 8 — Política Ética SaaS (ADR-06) y Límites de Plan', () => {
  it('garantiza consulta, exportación CSV y registro de abonos SIEMPRE activos incluso con suscripción vencida (Modo Solo Lectura ético)', () => {
    const expired = evaluateStorePlanCapabilities({
      planTier: 'pro',
      lifecycleState: 'read_only_expired',
      activeCustomersCount: 120,
    })

    expect(expired.canViewPortfolioAndHistory).toBe(true)
    expect(expired.canExportCsv).toBe(true)
    expect(expired.canRecordPayments).toBe(true)
    expect(expired.canRecordNewCreditSales).toBe(false)
    expect(expired.canCreateNewCustomer).toBe(false)
    expect(expired.statusBanner).toContain('Modo Solo Lectura ético activo')
  })

  it('permite operación completa durante período de gracia (7 días) y controla tope de clientes nuevos en Plan Gratis sin bloquear abonos ni fiados de clientes existentes', () => {
    const grace = evaluateStorePlanCapabilities({
      planTier: 'pro',
      lifecycleState: 'grace_period',
      activeCustomersCount: 80,
    })
    expect(grace.canRecordNewCreditSales).toBe(true)
    expect(grace.canCreateNewCustomer).toBe(true)
    expect(grace.canRecordPayments).toBe(true)

    const freeAtCap = evaluateStorePlanCapabilities({
      planTier: 'free',
      lifecycleState: 'active',
      activeCustomersCount: FREE_PLAN_MAX_ACTIVE_CUSTOMERS,
    })
    expect(freeAtCap.canCreateNewCustomer).toBe(false)
    expect(freeAtCap.canRecordNewCreditSales).toBe(true)
    expect(freeAtCap.canRecordPayments).toBe(true)
    expect(freeAtCap.canExportCsv).toBe(true)
  })
})
