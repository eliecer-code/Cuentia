import { describe, expect, it } from 'vitest'
import { customerFormSchema, normalizeSearchText } from '@/features/customers/schemas/customer.schema'
import { findPossibleDuplicates, type CustomerItem } from '@/features/customers/services/customers.service'

const sampleCustomers: CustomerItem[] = [
  {
    id: 'c1',
    storeId: 's1',
    fullName: 'María José Gómez',
    nickname: 'La esquina',
    phoneE164: '+573124567890',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: 100_000,
    currentBalance: 45_000,
    lastLedgerSeq: 3,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'maria jose gomez la esquina +573124567890',
    createdBy: 'u1',
    createdAt: '2026-11-19T10:00:00.000Z',
  },
  {
    id: 'c2',
    storeId: 's1',
    fullName: 'María José Gómez',
    nickname: 'Panadería',
    phoneE164: '+573001112233',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'archived',
    creditLimit: null,
    currentBalance: 0,
    lastLedgerSeq: 0,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'maria jose gomez panaderia +573001112233',
    createdBy: 'u1',
    createdAt: '2026-11-19T10:00:00.000Z',
  },
]

describe('Fase 3 — Clientes: validación Zod, normalización y detección de duplicados', () => {
  it('permite alta rápida con solo el nombre y valida celular/tope opcionales', () => {
    expect(customerFormSchema.safeParse({ fullName: 'Don Pedro' }).success).toBe(true)
    expect(customerFormSchema.safeParse({ fullName: 'A' }).success).toBe(false)
    expect(
      customerFormSchema.safeParse({ fullName: 'Don Pedro', phoneRaw: '312 456 7890', creditLimitRaw: '150.000' }).success,
    ).toBe(true)
    expect(
      customerFormSchema.safeParse({ fullName: 'Don Pedro', phoneRaw: '12345' }).success,
    ).toBe(false)
    expect(
      customerFormSchema.safeParse({ fullName: 'Don Pedro', creditLimitRaw: '1500,50' }).success,
    ).toBe(false)
  })

  it('normaliza búsquedas ignorando tildes y mayúsculas', () => {
    expect(normalizeSearchText('  Doña MARÍA José  ')).toBe('dona maria jose')
  })

  it('detecta homónimos y teléfonos compartidos excluyendo clientes archivados y al propio registro', () => {
    const dup = findPossibleDuplicates(sampleCustomers, 'Maria Jose Gomez', '312 456 7890')
    expect(dup.sameName).toHaveLength(1)
    expect(dup.sameName[0]?.id).toBe('c1')
    expect(dup.samePhone).toHaveLength(1)
    expect(dup.samePhone[0]?.id).toBe('c1')

    const excludingSelf = findPossibleDuplicates(sampleCustomers, 'Maria Jose Gomez', '312 456 7890', 'c1')
    expect(excludingSelf.sameName).toHaveLength(0)
    expect(excludingSelf.samePhone).toHaveLength(0)
  })
})
