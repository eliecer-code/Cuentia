import { describe, expect, it } from 'vitest'
import type { CustomerItem } from '@/features/customers/services/customers.service'
import type { LedgerEntryItem } from '@/features/ledger/services/ledger.service'
import {
  buildCustomersCsv,
  buildLedgerCsv,
  computeOverdueCustomers,
  computePeriodReport,
  filterOverdueByTier,
} from '@/features/reports/services/reports.service'
import { updateStoreSettingsSchema } from '@/features/stores/schemas/store.schema'
import { buildBalanceReminderMessage } from '@/shared/lib/whatsapp'
import { toBogotaBusinessDate } from '@/shared/utils/datesCO'

function makeEntry(overrides: Partial<LedgerEntryItem>): LedgerEntryItem {
  const occurredAt = overrides.occurredAt ?? '2026-11-19T15:00:00.000Z'
  return {
    id: overrides.id ?? 'e-1',
    storeId: 'store-a',
    customerId: overrides.customerId ?? 'c-1',
    customerName: overrides.customerName ?? 'Don Carlos Pérez',
    customerSeq: overrides.customerSeq ?? 1,
    entryType: overrides.entryType ?? 'credit_sale',
    signedAmount: overrides.signedAmount ?? 25_000,
    balanceBefore: overrides.balanceBefore ?? 0,
    balanceAfter: overrides.balanceAfter ?? 25_000,
    paymentMethod: overrides.paymentMethod ?? null,
    note: overrides.note ?? null,
    reason: overrides.reason ?? null,
    reversesEntryId: overrides.reversesEntryId ?? null,
    reversedByEntryId: overrides.reversedByEntryId ?? null,
    idempotencyKey: overrides.idempotencyKey ?? 'idem-1',
    payloadHash: 'hash-1',
    occurredAt,
    businessDate: overrides.businessDate ?? toBogotaBusinessDate(occurredAt),
    createdBy: 'u-1',
    createdByName: 'Propietario',
    createdAt: occurredAt,
  }
}

function makeCustomer(overrides: Partial<CustomerItem>): CustomerItem {
  return {
    id: overrides.id ?? 'c-1',
    storeId: 'store-a',
    fullName: overrides.fullName ?? 'Don Carlos Pérez',
    nickname: overrides.nickname ?? 'El del taller',
    phoneE164: overrides.phoneE164 ?? '+573124567890',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: overrides.creditStatus ?? 'active',
    creditLimit: overrides.creditLimit ?? 200_000,
    currentBalance: overrides.currentBalance ?? 100_000,
    lastLedgerSeq: overrides.lastLedgerSeq ?? 5,
    lastCreditSaleAt: overrides.lastCreditSaleAt ?? '2026-10-15T15:00:00.000Z',
    lastPaymentAt: overrides.lastPaymentAt ?? '2026-10-15T15:00:00.000Z',
    lastActivityAt: overrides.lastActivityAt ?? '2026-10-15T15:00:00.000Z',
    searchText: 'don carlos perez',
    createdBy: 'u-1',
    createdAt: '2026-09-01T15:00:00.000Z',
  }
}

describe('Fase 5 — Reportes de período, frontera de medianoche Bogotá, morosos y CSV', () => {
  it('respeta la frontera de medianoche Colombia (23:55 COT vs 00:05 COT) y separa opening_balance y adjustment del flujo', () => {
    // 2026-11-19 23:55:00 COT == 2026-11-20T04:55:00.000Z -> businessDate '2026-11-19'
    const lateBogotaSale = makeEntry({
      id: 'sale-2355',
      entryType: 'credit_sale',
      signedAmount: 40_000,
      occurredAt: '2026-11-20T04:55:00.000Z',
    })
    // 2026-11-20 00:05:00 COT == 2026-11-20T05:05:00.000Z -> businessDate '2026-11-20'
    const nextDayBogotaSale = makeEntry({
      id: 'sale-0005',
      entryType: 'credit_sale',
      signedAmount: 65_000,
      occurredAt: '2026-11-20T05:05:00.000Z',
    })
    // Saldo migrado del cuaderno el 2026-11-19 (no debe inflar creditSalesTotal)
    const openingEntry = makeEntry({
      id: 'open-1',
      entryType: 'opening_balance',
      signedAmount: 150_000,
      occurredAt: '2026-11-19T14:00:00.000Z',
    })
    // Abonos en efectivo y Nequi el 2026-11-19
    const cashPayment = makeEntry({
      id: 'pay-cash',
      entryType: 'payment',
      signedAmount: -30_000,
      paymentMethod: 'cash',
      occurredAt: '2026-11-19T16:00:00.000Z',
    })
    const nequiPayment = makeEntry({
      id: 'pay-nequi',
      entryType: 'payment',
      signedAmount: -20_000,
      paymentMethod: 'nequi',
      occurredAt: '2026-11-19T18:00:00.000Z',
    })
    // Abono anulado + su asiento de reversión (no deben inflar el cuadre de caja)
    const reversedPayment = makeEntry({
      id: 'pay-rev-orig',
      entryType: 'payment',
      signedAmount: -90_000,
      paymentMethod: 'daviplata',
      reversedByEntryId: 'rev-1',
      occurredAt: '2026-11-19T19:00:00.000Z',
    })
    const reversalEntry = makeEntry({
      id: 'rev-1',
      entryType: 'reversal',
      signedAmount: 90_000,
      reversesEntryId: 'pay-rev-orig',
      occurredAt: '2026-11-19T19:05:00.000Z',
    })
    // Ajuste/descuento gerencial (no debe inflar paymentsTotal)
    const adjustmentDiscount = makeEntry({
      id: 'adj-1',
      entryType: 'adjustment',
      signedAmount: -5_000,
      occurredAt: '2026-11-19T20:00:00.000Z',
    })

    const entries = [
      lateBogotaSale,
      nextDayBogotaSale,
      openingEntry,
      cashPayment,
      nequiPayment,
      reversedPayment,
      reversalEntry,
      adjustmentDiscount,
    ]

    const report19 = computePeriodReport(entries, '2026-11-19', '2026-11-19')
    expect(report19.creditSalesTotal).toBe(40_000)
    expect(report19.creditSalesCount).toBe(1)
    expect(report19.openingBalanceTotal).toBe(150_000)
    expect(report19.openingBalanceCount).toBe(1)
    expect(report19.paymentsTotal).toBe(50_000)
    expect(report19.paymentsCount).toBe(2)
    expect(report19.adjustmentsNet).toBe(-5_000)
    expect(report19.adjustmentsCount).toBe(1)
    expect(report19.reversalsCount).toBe(1)

    const cashRow = report19.byPaymentMethod.find((m) => m.method === 'cash')
    const nequiRow = report19.byPaymentMethod.find((m) => m.method === 'nequi')
    const daviplataRow = report19.byPaymentMethod.find((m) => m.method === 'daviplata')
    expect(cashRow?.amount).toBe(30_000)
    expect(cashRow?.sharePercent).toBe(60)
    expect(nequiRow?.amount).toBe(20_000)
    expect(nequiRow?.sharePercent).toBe(40)
    expect(daviplataRow?.amount).toBe(0)

    const report20 = computePeriodReport(entries, '2026-11-20', '2026-11-20')
    expect(report20.creditSalesTotal).toBe(65_000)
    expect(report20.creditSalesCount).toBe(1)
  })

  it('clasifica clientes morosos en tramos +15d, +30d y +60d en hora de Bogotá', () => {
    const now = new Date('2026-11-19T15:00:00.000Z')
    const customers: CustomerItem[] = [
      makeCustomer({ id: 'c-recent', fullName: 'Cliente Reciente', currentBalance: 40_000, lastPaymentAt: '2026-11-14T15:00:00.000Z' }), // 5d
      makeCustomer({ id: 'c-18', fullName: 'Cliente 18d', currentBalance: 80_000, lastPaymentAt: '2026-11-01T15:00:00.000Z' }), // 18d
      makeCustomer({ id: 'c-35', fullName: 'Cliente 35d', currentBalance: 120_000, lastPaymentAt: '2026-10-15T15:00:00.000Z' }), // 35d
      makeCustomer({ id: 'c-65', fullName: 'Cliente 65d', currentBalance: 90_000, lastPaymentAt: '2026-09-15T15:00:00.000Z' }), // 65d
      makeCustomer({ id: 'c-zero', fullName: 'Cliente Al Día', currentBalance: 0, lastPaymentAt: '2026-08-01T15:00:00.000Z' }),
    ]

    const overdue = computeOverdueCustomers(customers, now)
    expect(overdue).toHaveLength(4)
    expect(overdue[0]?.customer.id).toBe('c-65')
    expect(overdue[0]?.tier).toBe('60+')

    expect(filterOverdueByTier(overdue, '15+').map((i) => i.customer.id)).toEqual(['c-65', 'c-35', 'c-18'])
    expect(filterOverdueByTier(overdue, '30+').map((i) => i.customer.id)).toEqual(['c-65', 'c-35'])
    expect(filterOverdueByTier(overdue, '60+').map((i) => i.customer.id)).toEqual(['c-65'])
  })

  it('restringe la exportación CSV exclusivamente al rol owner y neutraliza inyección de fórmulas', () => {
    const customers = [
      makeCustomer({ fullName: '=CMD("calc")', nickname: 'Vecino', currentBalance: 75_000 }),
    ]
    const entries = [makeEntry({ note: '+SUM(A1:A2)' })]

    expect(() => buildCustomersCsv(customers, 'admin')).toThrow()
    expect(() => buildCustomersCsv(customers, 'employee')).toThrow()
    expect(() => buildLedgerCsv(entries, 'admin')).toThrow()

    const csvCustomers = buildCustomersCsv(customers, 'owner', new Date('2026-11-19T15:00:00.000Z'))
    expect(csvCustomers.startsWith('\uFEFF')).toBe(true)
    expect(csvCustomers).toContain('\'=CMD(""calc"")')

    const csvLedger = buildLedgerCsv(entries, 'owner')
    expect(csvLedger.startsWith('\uFEFF')).toBe(true)
    expect(csvLedger).toContain('\'+SUM(A1:A2)')
  })

  it('valida configuración de tienda y reemplaza variables en plantilla personalizada de WhatsApp', () => {
    const valid = updateStoreSettingsSchema.safeParse({
      name: 'Tienda La Esquina',
      phoneRaw: '3124567890',
      defaultCreditLimit: 250_000,
      allowOverLimit: false,
      employeeCanReverseMinutes: 15,
      whatsappReminderTemplate: 'Hola {cliente}, en {tienda} su saldo es {saldo}.',
    })
    expect(valid.success).toBe(true)

    const msg = buildBalanceReminderMessage({
      storeName: 'Tienda La Esquina',
      customerName: 'Doña Marta',
      currentBalance: 128_500,
      customTemplate: 'Hola {cliente}, le recordamos de *{tienda}* su saldo de {saldo}.',
    })
    expect(msg).toBe('Hola Doña Marta, le recordamos de *Tienda La Esquina* su saldo de $ 128.500.')
  })
})
