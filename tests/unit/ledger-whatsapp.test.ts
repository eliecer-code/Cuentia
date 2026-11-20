import { describe, expect, it } from 'vitest'
import {
  adjustmentInputSchema,
  creditSaleInputSchema,
  migrateNotebookSchema,
  paymentInputSchema,
  reversalInputSchema,
} from '@/features/ledger/schemas/ledger.schema'
import { reconcileCustomerEntries, type LedgerEntryItem } from '@/features/ledger/services/ledger.service'
import {
  buildBalanceReminderMessage,
  buildPaymentReceiptMessage,
  buildWhatsAppUrl,
} from '@/shared/lib/whatsapp'

describe('Fase 4 — Schemas Zod del Ledger y Migración de Cuaderno', () => {
  it('valida fiados, abonos, reversiones, ajustes y saldo inicial', () => {
    expect(creditSaleInputSchema.safeParse({ amount: 15_000, note: 'Arroz y leche' }).success).toBe(true)
    expect(creditSaleInputSchema.safeParse({ amount: 0 }).success).toBe(false)
    expect(paymentInputSchema.safeParse({ amount: 10_000, paymentMethod: 'nequi' }).success).toBe(true)
    expect(reversalInputSchema.safeParse({ reason: 'abc' }).success).toBe(false)
    expect(reversalInputSchema.safeParse({ reason: 'Error de digitación' }).success).toBe(true)
    expect(adjustmentInputSchema.safeParse({ direction: 'decrease', amount: 5_000, reason: 'Descuento acordado' }).success).toBe(true)
    expect(migrateNotebookSchema.safeParse({ fullName: 'Don Carlos', openingBalance: 125_000 }).success).toBe(true)
  })

  it('reconcileCustomerEntries verifica 120 operaciones mixtas reproducibles con 0 discrepancias', () => {
    let seed = 42
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    const entries: LedgerEntryItem[] = []
    let balance = 0

    for (let i = 1; i <= 120; i++) {
      const isSale = balance === 0 || nextRand() > 0.42
      const delta = isSale
        ? (Math.floor(nextRand() * 30) + 1) * 1_000
        : -Math.min(balance, (Math.floor(nextRand() * 20) + 1) * 1_000)

      const before = balance
      balance += delta
      entries.push({
        id: `e-${i}`,
        storeId: 's1',
        customerId: 'c1',
        customerName: 'Carlos',
        customerSeq: i,
        entryType: delta > 0 ? 'credit_sale' : 'payment',
        signedAmount: delta,
        balanceBefore: before,
        balanceAfter: balance,
        paymentMethod: delta < 0 ? 'cash' : null,
        reversesEntryId: null,
        reversedByEntryId: null,
        idempotencyKey: `e-${i}`,
        payloadHash: 'h',
        note: null,
        reason: null,
        occurredAt: '2026-11-19T15:00:00.000Z',
        businessDate: '2026-11-19',
        createdBy: 'u1',
        createdByName: 'Dueño',
        createdAt: '2026-11-19T15:00:00.000Z',
      })
    }

    const res = reconcileCustomerEntries(balance, entries.length, entries)
    expect(res.ok).toBe(true)
    expect(res.expectedBalance).toBe(balance)
    expect(res.issues).toEqual([])

    // Si alguien alterara el saldo materializado, la conciliación lo detecta de inmediato
    const tampered = reconcileCustomerEntries(balance + 1_000, entries.length, entries)
    expect(tampered.ok).toBe(false)
    expect(tampered.issues.length).toBeGreaterThan(0)
  })
})

describe('Fase 4 — Generador WhatsApp (wa.me) y plantillas colombianas', () => {
  it('construye enlaces wa.me con prefijo +57 o selector libre cuando no hay teléfono', () => {
    const withPhone = buildWhatsAppUrl('+573124567890', 'Hola Don Carlos')
    expect(withPhone).toBe('https://wa.me/573124567890?text=Hola%20Don%20Carlos')

    const withoutPhone = buildWhatsAppUrl(null, 'Hola')
    expect(withoutPhone).toBe('https://wa.me/?text=Hola')
  })

  it('genera comprobante de abono parcial, paz y salvo y recordatorio amable', () => {
    const partial = buildPaymentReceiptMessage({
      storeName: 'Tienda La Esquina',
      customerName: 'Don Carlos',
      amount: 10_000,
      paymentMethod: 'nequi',
      balanceAfter: 25_000,
      occurredAt: '2026-11-19T15:00:00.000Z',
      seqLabel: '#004',
    })
    expect(partial).toContain('$ 10.000')
    expect(partial).toContain('Nequi')
    expect(partial).toContain('$ 25.000')

    const paidOff = buildPaymentReceiptMessage({
      storeName: 'Tienda La Esquina',
      customerName: 'Don Carlos',
      amount: 25_000,
      paymentMethod: 'cash',
      balanceAfter: 0,
      occurredAt: '2026-11-19T15:00:00.000Z',
    })
    expect(paidOff).toContain('Paz y salvo ($ 0)')

    const reminder = buildBalanceReminderMessage({
      storeName: 'Tienda La Esquina',
      customerName: 'Don Carlos',
      currentBalance: 30_500,
    })
    expect(reminder).toContain('$ 30.500')
    expect(reminder).not.toMatch(/jurídico|embargo|mora/i)
  })
})
