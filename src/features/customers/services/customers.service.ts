import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { normalizeSearchText, type CustomerFormInput } from '@/features/customers/schemas/customer.schema'
import { recordDataFreshness } from '@/shared/composables/useOnlineStatus'
import { normalizeError } from '@/shared/lib/errors'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/shared/lib/firebase'
import type { CustomerCreditStatus, StoreRole } from '@/shared/types/domain.types'
import { normalizeColombianPhone, parseCOPInput } from '@/shared/utils/cop'
import { readTenantCache, writeTenantCache } from '@/shared/utils/tenantCache'

export interface CustomerItem {
  id: string
  storeId: string
  fullName: string
  nickname: string | null
  phoneE164: string | null
  documentNumber: string | null
  address: string | null
  notes: string | null
  whatsappOptOut: boolean
  creditStatus: CustomerCreditStatus
  creditLimit: number | null
  currentBalance: number
  lastLedgerSeq: number
  lastCreditSaleAt: string | null
  lastPaymentAt: string | null
  lastActivityAt: string | null
  searchText: string
  createdBy: string
  createdAt: string
}

function toIsoNullable(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return null
}

function mapCustomerDoc(id: string, data: Record<string, unknown>): CustomerItem {
  return {
    id,
    storeId: String(data.storeId ?? ''),
    fullName: String(data.fullName ?? ''),
    nickname: (data.nickname as string | null) ?? null,
    phoneE164: (data.phoneE164 as string | null) ?? null,
    documentNumber: (data.documentNumber as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    whatsappOptOut: Boolean(data.whatsappOptOut),
    creditStatus: (data.creditStatus as CustomerCreditStatus) ?? 'active',
    creditLimit: typeof data.creditLimit === 'number' ? data.creditLimit : null,
    currentBalance: typeof data.currentBalance === 'number' ? data.currentBalance : 0,
    lastLedgerSeq: typeof data.lastLedgerSeq === 'number' ? data.lastLedgerSeq : 0,
    lastCreditSaleAt: toIsoNullable(data.lastCreditSaleAt),
    lastPaymentAt: toIsoNullable(data.lastPaymentAt),
    lastActivityAt: toIsoNullable(data.lastActivityAt),
    searchText: String(data.searchText ?? ''),
    createdBy: String(data.createdBy ?? ''),
    createdAt: toIsoNullable(data.createdAt) ?? new Date().toISOString(),
  }
}

function buildSearchText(fields: {
  fullName: string
  nickname: string | null
  phoneE164: string | null
  documentNumber: string | null
}): string {
  return normalizeSearchText(
    [fields.fullName, fields.nickname ?? '', fields.phoneE164 ?? '', fields.documentNumber ?? ''].join(' '),
  )
}

export function findPossibleDuplicates(
  existing: CustomerItem[],
  fullName: string,
  phoneRaw: string,
  excludeId?: string,
): { sameName: CustomerItem[]; samePhone: CustomerItem[] } {
  const normName = normalizeSearchText(fullName)
  const phoneE164 = phoneRaw ? normalizeColombianPhone(phoneRaw) : null

  const sameName = normName.length >= 2
    ? existing.filter((c) => c.id !== excludeId && c.creditStatus !== 'archived' && normalizeSearchText(c.fullName) === normName)
    : []

  const samePhone = phoneE164
    ? existing.filter((c) => c.id !== excludeId && c.creditStatus !== 'archived' && c.phoneE164 === phoneE164)
    : []

  return { sameName, samePhone }
}

export async function listCustomers(storeId: string): Promise<CustomerItem[]> {
  if (!isFirebaseConfigured()) return []
  const userId = getFirebaseAuth().currentUser?.uid ?? null
  try {
    const db = getFirebaseDb()
    // ponytail: en tiendas de barrio (decenas/cientos de clientes) cargar la colección una vez
    // permite búsqueda instantánea sin tildes por nombre, apodo o últimos 4 dígitos del teléfono.
    const snap = await getDocs(
      query(collection(db, 'stores', storeId, 'customers'), orderBy('fullName', 'asc')),
    )
    const items = snap.docs.map((d) => mapCustomerDoc(d.id, d.data()))
    const env = writeTenantCache(userId, storeId, 'customers:list', items)
    if (env) recordDataFreshness(env.updatedAtIso)
    return items
  } catch (err) {
    const cached = readTenantCache<CustomerItem[]>(userId, storeId, 'customers:list')
    if (cached) {
      recordDataFreshness(cached.updatedAtIso)
      return cached.data
    }
    throw normalizeError(err)
  }
}

export async function getCustomerById(storeId: string, customerId: string): Promise<CustomerItem | null> {
  if (!isFirebaseConfigured()) return null
  const userId = getFirebaseAuth().currentUser?.uid ?? null
  try {
    const db = getFirebaseDb()
    const snap = await getDoc(doc(db, 'stores', storeId, 'customers', customerId))
    if (!snap.exists()) return null
    const item = mapCustomerDoc(snap.id, snap.data())
    const env = writeTenantCache(userId, storeId, `customer:${customerId}`, item)
    if (env) recordDataFreshness(env.updatedAtIso)
    return item
  } catch (err) {
    const cached = readTenantCache<CustomerItem>(userId, storeId, `customer:${customerId}`)
    if (cached) {
      recordDataFreshness(cached.updatedAtIso)
      return cached.data
    }
    throw normalizeError(err)
  }
}

export async function createCustomer(storeId: string, input: CustomerFormInput): Promise<CustomerItem> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const custRef = doc(collection(db, 'stores', storeId, 'customers'))
    const phoneE164 = input.phoneRaw ? normalizeColombianPhone(input.phoneRaw) : null
    const nickname = input.nickname ? input.nickname : null
    const documentNumber = input.documentNumber ? input.documentNumber : null
    const address = input.address ? input.address : null
    const notes = input.notes ? input.notes : null
    const creditLimit = input.creditLimitRaw ? parseCOPInput(input.creditLimitRaw) : null
    const searchText = buildSearchText({ fullName: input.fullName, nickname, phoneE164, documentNumber })

    const batch = writeBatch(db)
    batch.set(custRef, {
      storeId,
      fullName: input.fullName,
      nickname,
      phoneE164,
      documentNumber,
      address,
      notes,
      whatsappOptOut: false,
      consentRecordedAt: phoneE164 ? serverTimestamp() : null,
      creditStatus: 'active',
      creditLimit,
      currentBalance: 0,
      lastLedgerSeq: 0,
      lastCreditSaleAt: null,
      lastPaymentAt: null,
      lastActivityAt: null,
      searchText,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      id: custRef.id,
      storeId,
      fullName: input.fullName,
      nickname,
      phoneE164,
      documentNumber,
      address,
      notes,
      whatsappOptOut: false,
      creditStatus: 'active',
      creditLimit,
      currentBalance: 0,
      lastLedgerSeq: 0,
      lastCreditSaleAt: null,
      lastPaymentAt: null,
      lastActivityAt: null,
      searchText,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function updateCustomer(
  storeId: string,
  customer: CustomerItem,
  input: CustomerFormInput,
  actorRole: StoreRole,
): Promise<CustomerItem> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const custRef = doc(db, 'stores', storeId, 'customers', customer.id)
    const phoneE164 = input.phoneRaw ? normalizeColombianPhone(input.phoneRaw) : null
    const nickname = input.nickname ? input.nickname : null
    const documentNumber = input.documentNumber ? input.documentNumber : null
    const address = input.address ? input.address : null
    const notes = input.notes ? input.notes : null
    const requestedLimit = input.creditLimitRaw ? parseCOPInput(input.creditLimitRaw) : null

    const canEditLimit = actorRole === 'owner' || actorRole === 'admin'
    const nextCreditLimit = canEditLimit ? requestedLimit : customer.creditLimit
    const searchText = buildSearchText({ fullName: input.fullName, nickname, phoneE164, documentNumber })

    const batch = writeBatch(db)
    batch.update(custRef, {
      fullName: input.fullName,
      nickname,
      phoneE164,
      documentNumber,
      address,
      notes,
      creditLimit: nextCreditLimit,
      searchText,
      updatedAt: serverTimestamp(),
    })

    if (canEditLimit && nextCreditLimit !== customer.creditLimit) {
      batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
        storeId,
        actorUserId: user.uid,
        actorRole,
        action: 'customer.credit_limit_changed',
        entityType: 'customer',
        entityId: customer.id,
        beforeState: { creditLimit: customer.creditLimit },
        afterState: { creditLimit: nextCreditLimit },
        createdAt: serverTimestamp(),
      })
    }

    await batch.commit()

    return {
      ...customer,
      fullName: input.fullName,
      nickname,
      phoneE164,
      documentNumber,
      address,
      notes,
      creditLimit: nextCreditLimit,
      searchText,
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function updateCustomerStatus(
  storeId: string,
  customer: CustomerItem,
  nextStatus: CustomerCreditStatus,
  actorRole: StoreRole,
): Promise<CustomerItem> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })
  if (actorRole === 'employee') throw normalizeError({ code: 'CU_FORBIDDEN' })
  if (nextStatus === 'archived' && customer.currentBalance !== 0) {
    throw normalizeError({ code: 'CU_CUSTOMER_HAS_BALANCE' })
  }

  try {
    const db = getFirebaseDb()
    const batch = writeBatch(db)
    batch.update(doc(db, 'stores', storeId, 'customers', customer.id), {
      creditStatus: nextStatus,
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole,
      action: 'customer.status_changed',
      entityType: 'customer',
      entityId: customer.id,
      beforeState: { creditStatus: customer.creditStatus },
      afterState: { creditStatus: nextStatus },
      createdAt: serverTimestamp(),
    })
    await batch.commit()

    return { ...customer, creditStatus: nextStatus }
  } catch (err) {
    throw normalizeError(err)
  }
}
