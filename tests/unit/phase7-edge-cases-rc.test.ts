import { describe, expect, it } from 'vitest'
import { findPossibleDuplicates } from '@/features/customers/services/customers.service'
import type { CustomerItem } from '@/features/customers/services/customers.service'
import {
  applyHabeasDataTombstonesToSnapshot,
  reconcileCustomerEntries,
  reconcileStorePortfolio,
  type LedgerEntryItem,
} from '@/features/ledger/services/ledger.service'
import { scrubPiiText, scrubTelemetryPayload } from '@/shared/lib/errors'
import { toBogotaBusinessDate } from '@/shared/utils/datesCO'
import { createActionAttempt } from '@/shared/utils/idempotency'

function makeEntry(overrides: Partial<LedgerEntryItem>): LedgerEntryItem {
  const occurredAt = overrides.occurredAt ?? '2026-11-19T15:00:00.000Z'
  return {
    id: overrides.id ?? 'e-1',
    storeId: 'store-rc',
    customerId: overrides.customerId ?? 'c-1',
    customerName: overrides.customerName ?? 'Don Carlos Pérez',
    customerSeq: overrides.customerSeq ?? 1,
    entryType: overrides.entryType ?? 'credit_sale',
    signedAmount: overrides.signedAmount ?? 20_000,
    balanceBefore: overrides.balanceBefore ?? 0,
    balanceAfter: overrides.balanceAfter ?? 20_000,
    paymentMethod: overrides.paymentMethod ?? null,
    reversesEntryId: overrides.reversesEntryId ?? null,
    reversedByEntryId: overrides.reversedByEntryId ?? null,
    idempotencyKey: overrides.idempotencyKey ?? 'idem-1',
    payloadHash: 'hash-1',
    note: overrides.note ?? null,
    reason: overrides.reason ?? null,
    occurredAt,
    businessDate: overrides.businessDate ?? toBogotaBusinessDate(occurredAt),
    createdBy: 'u-owner',
    createdByName: 'Propietario',
    createdAt: occurredAt,
  }
}

describe('Fase 7 — Hardening, Matriz de 16 Casos Límite, Scrubbing PII y Simulacro Backup/Restore', () => {
  it('Escenarios #1-#7: valida las 4 invariantes de conciliación y detecta doble reversión o reversión de reversión', () => {
    const attempt = createActionAttempt()
    const key1 = attempt.getKey()
    expect(attempt.getKey()).toBe(key1) // Reintento tras corte en vuelo conserva la misma llave

    const e1 = makeEntry({
      id: 'e-1',
      customerSeq: 1,
      entryType: 'opening_balance',
      signedAmount: 100_000,
      balanceBefore: 0,
      balanceAfter: 100_000,
    })
    const e2 = makeEntry({
      id: 'e-2',
      customerSeq: 2,
      entryType: 'payment',
      signedAmount: -40_000,
      balanceBefore: 100_000,
      balanceAfter: 60_000,
      paymentMethod: 'nequi',
      reversedByEntryId: 'e-3',
    })
    const e3 = makeEntry({
      id: 'e-3',
      customerSeq: 3,
      entryType: 'reversal',
      signedAmount: 40_000,
      balanceBefore: 60_000,
      balanceAfter: 100_000,
      reversesEntryId: 'e-2',
      reason: 'Digitó monto equivocado',
    })

    const validResult = reconcileCustomerEntries(100_000, 3, [e1, e2, e3])
    expect(validResult.ok).toBe(true)
    expect(validResult.issues).toEqual([])

    // Intento fraudulento de doble reversión sobre 'e-2'
    const doubleReversal = makeEntry({
      id: 'e-4',
      customerSeq: 4,
      entryType: 'reversal',
      signedAmount: 40_000,
      balanceBefore: 100_000,
      balanceAfter: 140_000,
      reversesEntryId: 'e-2',
    })
    const invalidDouble = reconcileCustomerEntries(140_000, 4, [e1, e2, e3, doubleReversal])
    expect(invalidDouble.ok).toBe(false)
    expect(invalidDouble.issues.some((i) => i.includes('Doble reversión'))).toBe(true)

    // Intento prohibido de revertir una reversión ('e-3')
    const reverseOfReversal = makeEntry({
      id: 'e-4b',
      customerSeq: 4,
      entryType: 'reversal',
      signedAmount: -40_000,
      balanceBefore: 100_000,
      balanceAfter: 60_000,
      reversesEntryId: 'e-3',
    })
    const invalidChain = reconcileCustomerEntries(60_000, 4, [e1, e2, e3, reverseOfReversal])
    expect(invalidChain.ok).toBe(false)
    expect(invalidChain.issues.some((i) => i.includes('Prohibido revertir una reversión'))).toBe(true)
  })

  it('Escenarios #8-#10 y #12-#16: simulacro de Backup/Restore con Tombstone Habeas Data y separación de saldos a favor', () => {
    const backupCustomers: CustomerItem[] = [
      {
        id: 'c-1',
        storeId: 'store-rc',
        fullName: 'Don Carlos Pérez',
        nickname: 'El del taller',
        phoneE164: '+573124567890',
        documentNumber: '79123456',
        address: 'Calle 45 # 12-34',
        notes: 'Vecino antiguo',
        whatsappOptOut: false,
        creditStatus: 'active',
        creditLimit: 200_000,
        currentBalance: 85_000,
        lastLedgerSeq: 2,
        lastCreditSaleAt: null,
        lastPaymentAt: null,
        lastActivityAt: null,
        searchText: 'don carlos perez',
        createdBy: 'u-owner',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 'c-2',
        storeId: 'store-rc',
        fullName: 'Doña Marta Gómez',
        nickname: 'Casa reja verde',
        phoneE164: '+573105558899',
        documentNumber: '52987654',
        address: 'Carrera 10 # 5-20',
        notes: null,
        whatsappOptOut: false,
        creditStatus: 'active',
        creditLimit: 200_000,
        currentBalance: -15_000, // Escenario #10: saldo a favor en opt-in futuro jamás reduce totalReceivable
        lastLedgerSeq: 1,
        lastCreditSaleAt: null,
        lastPaymentAt: null,
        lastActivityAt: null,
        searchText: 'dona marta gomez',
        createdBy: 'u-owner',
        createdAt: '2026-10-02T10:00:00.000Z',
      },
    ]

    const backupEntries: LedgerEntryItem[] = [
      makeEntry({
        id: 'c1-e1',
        customerId: 'c-1',
        customerSeq: 1,
        entryType: 'opening_balance',
        signedAmount: 100_000,
        balanceBefore: 0,
        balanceAfter: 100_000,
      }),
      makeEntry({
        id: 'c1-e2',
        customerId: 'c-1',
        customerSeq: 2,
        entryType: 'payment',
        signedAmount: -15_000,
        balanceBefore: 100_000,
        balanceAfter: 85_000,
        paymentMethod: 'cash',
      }),
      makeEntry({
        id: 'c2-e1',
        customerId: 'c-2',
        customerSeq: 1,
        entryType: 'adjustment',
        signedAmount: -15_000,
        balanceBefore: 0,
        balanceAfter: -15_000,
      }),
    ]

    // Re-aplicar tombstone Habeas Data sobre 'c-1' tras restaurar un backup histórico
    const restoredCustomers = applyHabeasDataTombstonesToSnapshot(backupCustomers, ['c-1'])
    const anonymized = restoredCustomers.find((c) => c.id === 'c-1')!
    expect(anonymized.fullName).toBe('Cliente anonimizado (Habeas Data)')
    expect(anonymized.phoneE164).toBeNull()
    expect(anonymized.documentNumber).toBeNull()
    expect(anonymized.address).toBeNull()
    expect(anonymized.whatsappOptOut).toBe(true)
    expect(anonymized.currentBalance).toBe(85_000)

    // Verificar conciliación post-restore: 0 discrepancias y totalReceivable = SUM(GREATEST(balance, 0))
    const report = reconcileStorePortfolio(restoredCustomers, backupEntries)
    expect(report.ok).toBe(true)
    expect(report.discrepancies).toHaveLength(0)
    expect(report.totalReceivable).toBe(85_000)
    expect(report.totalCustomerFavor).toBe(15_000)

    // Escenario #15: Homónimos y teléfono compartido
    const dupCheck = findPossibleDuplicates(backupCustomers, 'Doña Marta Gómez', '310 555 8899')
    expect(dupCheck.sameName).toHaveLength(1)
    expect(dupCheck.samePhone).toHaveLength(1)
  })

  it('Scrubbing de PII y credenciales en observabilidad (Ley 1581 / SEC-07)', () => {
    const rawText =
      'Error autenticando juanperez032197@gmail.com tel +57 312 456 7890 con Bearer eyJhbGciOiJIUzI1NiJ9.abc y key AIza_TEST_ONLY_NOT_A_REAL_KEY'
    const scrubbed = scrubPiiText(rawText)
    expect(scrubbed).not.toContain('juanperez032197@gmail.com')
    expect(scrubbed).not.toContain('312 456 7890')
    expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(scrubbed).not.toContain('AIza_TEST_ONLY_NOT_A_REAL_KEY')
    expect(scrubbed).toContain('[EMAIL_REDACTED]')
    expect(scrubbed).toContain('[PHONE_REDACTED]')
    expect(scrubbed).toContain('Bearer [TOKEN_REDACTED]')
    expect(scrubbed).toContain('[KEY_REDACTED]')

    const payload = scrubTelemetryPayload({
      action: 'customer.create',
      fullName: 'Don Carlos Pérez',
      phoneE164: '+573124567890',
      documentNumber: '79123456',
      password: 'SuperSecretPassword123',
      nested: {
        email: 'carlos@tienda.co',
        safeCount: 42,
      },
    }) as Record<string, unknown>

    expect(payload.fullName).toBe('[PII_REDACTED]')
    expect(payload.phoneE164).toBe('[PII_REDACTED]')
    expect(payload.documentNumber).toBe('[PII_REDACTED]')
    expect(payload.password).toBe('[PII_REDACTED]')
    expect((payload.nested as Record<string, unknown>).email).toBe('[PII_REDACTED]')
    expect((payload.nested as Record<string, unknown>).safeCount).toBe(42)
  })
})
