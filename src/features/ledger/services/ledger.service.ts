import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import { normalizeSearchText } from '@/features/customers/schemas/customer.schema'
import type { CustomerItem } from '@/features/customers/services/customers.service'
import { recordDataFreshness } from '@/shared/composables/useOnlineStatus'
import { normalizeError } from '@/shared/lib/errors'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/shared/lib/firebase'
import type { LedgerEntryType, PaymentMethodType, StoreRole } from '@/shared/types/domain.types'
import { normalizeColombianPhone } from '@/shared/utils/cop'
import { sha256Hex } from '@/shared/utils/crypto'
import { CO_TIMEZONE, toBogotaBusinessDate } from '@/shared/utils/datesCO'
import { readTenantCache, writeTenantCache } from '@/shared/utils/tenantCache'

export interface LedgerEntryItem {
  id: string
  storeId: string
  customerId: string
  customerName: string
  customerSeq: number
  entryType: LedgerEntryType
  signedAmount: number
  balanceBefore: number
  balanceAfter: number
  paymentMethod: PaymentMethodType | null
  reversesEntryId: string | null
  reversedByEntryId: string | null
  idempotencyKey: string
  payloadHash: string
  note: string | null
  reason: string | null
  occurredAt: string
  businessDate: string
  createdBy: string
  createdByName: string
  createdAt: string
}

export interface PostLedgerEntryInput {
  storeId: string
  customerId: string
  entryType: Extract<LedgerEntryType, 'credit_sale' | 'payment' | 'adjustment'>
  signedAmount: number
  paymentMethod?: PaymentMethodType | null
  note?: string | null
  reason?: string | null
  idempotencyKey: string
  actorRole: StoreRole
  confirmOverLimit?: boolean
}

export interface PostLedgerEntryResult {
  entry: LedgerEntryItem
  newBalance: number
  idempotentReplay: boolean
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

function mapLedgerDoc(id: string, data: Record<string, unknown>, reversedIds: Set<string>): LedgerEntryItem {
  return {
    id,
    storeId: String(data.storeId ?? ''),
    customerId: String(data.customerId ?? ''),
    customerName: String(data.customerName ?? 'Cliente'),
    customerSeq: Number(data.customerSeq ?? 0),
    entryType: data.entryType as LedgerEntryType,
    signedAmount: Number(data.signedAmount ?? 0),
    balanceBefore: Number(data.balanceBefore ?? 0),
    balanceAfter: Number(data.balanceAfter ?? 0),
    paymentMethod: (data.paymentMethod as PaymentMethodType | null) ?? null,
    reversesEntryId: (data.reversesEntryId as string | null) ?? null,
    reversedByEntryId: reversedIds.has(id) ? id : null,
    idempotencyKey: String(data.idempotencyKey ?? id),
    payloadHash: String(data.payloadHash ?? ''),
    note: (data.note as string | null) ?? null,
    reason: (data.reason as string | null) ?? null,
    occurredAt: toIso(data.occurredAt),
    businessDate: String(data.businessDate ?? ''),
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? 'Usuario'),
    createdAt: toIso(data.createdAt),
  }
}

async function computePayloadHash(parts: Record<string, unknown>): Promise<string> {
  return sha256Hex(JSON.stringify(parts))
}

export async function listCustomerLedger(storeId: string, customerId: string): Promise<LedgerEntryItem[]> {
  if (!isFirebaseConfigured()) return []
  const userId = getFirebaseAuth().currentUser?.uid ?? null
  try {
    const db = getFirebaseDb()
    const [entriesSnap, reversalsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'stores', storeId, 'ledgerEntries'),
          where('customerId', '==', customerId),
          orderBy('customerSeq', 'desc'),
        ),
      ),
      getDocs(collection(db, 'stores', storeId, 'reversals')),
    ])
    const reversedMap = new Map<string, string>()
    for (const r of reversalsSnap.docs) {
      reversedMap.set(r.id, String(r.data().reversalEntryId ?? r.id))
    }
    const items = entriesSnap.docs.map((d) => {
      const item = mapLedgerDoc(d.id, d.data(), new Set(reversedMap.keys()))
      item.reversedByEntryId = reversedMap.get(d.id) ?? null
      return item
    })
    const env = writeTenantCache(userId, storeId, `ledger:customer:${customerId}`, items)
    if (env) recordDataFreshness(env.updatedAtIso)
    return items
  } catch (err) {
    const cached = readTenantCache<LedgerEntryItem[]>(userId, storeId, `ledger:customer:${customerId}`)
    if (cached) {
      recordDataFreshness(cached.updatedAtIso)
      return cached.data
    }
    throw normalizeError(err)
  }
}

export async function listStoreLedger(storeId: string, maxRows = 120): Promise<LedgerEntryItem[]> {
  if (!isFirebaseConfigured()) return []
  const userId = getFirebaseAuth().currentUser?.uid ?? null
  const cacheKey = `ledger:store:${maxRows}`
  try {
    const db = getFirebaseDb()
    const [entriesSnap, reversalsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'stores', storeId, 'ledgerEntries'),
          orderBy('createdAt', 'desc'),
          limit(maxRows),
        ),
      ),
      getDocs(collection(db, 'stores', storeId, 'reversals')),
    ])
    const reversedMap = new Map<string, string>()
    for (const r of reversalsSnap.docs) {
      reversedMap.set(r.id, String(r.data().reversalEntryId ?? r.id))
    }
    const items = entriesSnap.docs.map((d) => {
      const item = mapLedgerDoc(d.id, d.data(), new Set(reversedMap.keys()))
      item.reversedByEntryId = reversedMap.get(d.id) ?? null
      return item
    })
    const env = writeTenantCache(userId, storeId, cacheKey, items)
    if (env) recordDataFreshness(env.updatedAtIso)
    return items
  } catch (err) {
    const cached = readTenantCache<LedgerEntryItem[]>(userId, storeId, cacheKey)
    if (cached) {
      recordDataFreshness(cached.updatedAtIso)
      return cached.data
    }
    throw normalizeError(err)
  }
}

/**
 * Registra atómicamente un fiado, abono o ajuste usando `runTransaction` e idempotencia nativa (`idempotencyKey` como documentId).
 */
export async function postLedgerEntry(input: PostLedgerEntryInput): Promise<PostLedgerEntryResult> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })
  if (!Number.isSafeInteger(input.signedAmount) || input.signedAmount === 0) {
    throw normalizeError({ code: 'failed-precondition' })
  }

  try {
    const db = getFirebaseDb()
    const entryRef = doc(db, 'stores', input.storeId, 'ledgerEntries', input.idempotencyKey)
    const customerRef = doc(db, 'stores', input.storeId, 'customers', input.customerId)
    const storeRef = doc(db, 'stores', input.storeId)

    const payloadHash = await computePayloadHash({
      customerId: input.customerId,
      entryType: input.entryType,
      signedAmount: input.signedAmount,
      paymentMethod: input.paymentMethod ?? null,
    })

    const actorName = user.displayName || user.email?.split('@')[0] || 'Usuario'

    return await runTransaction(db, async (tx) => {
      const [existingSnap, customerSnap, storeSnap] = await Promise.all([
        tx.get(entryRef),
        tx.get(customerRef),
        tx.get(storeRef),
      ])

      // Idempotencia (`BR-06`, `CL-03`, `CL-04`, `CL-05`)
      if (existingSnap.exists()) {
        const existingData = existingSnap.data()
        if (String(existingData.payloadHash ?? '') !== payloadHash) {
          throw { code: 'CU_IDEMPOTENCY_CONFLICT' }
        }
        const item = mapLedgerDoc(existingSnap.id, existingData, new Set())
        return {
          entry: item,
          newBalance: item.balanceAfter,
          idempotentReplay: true,
        }
      }

      if (!customerSnap.exists() || !storeSnap.exists()) {
        throw { code: 'not-found' }
      }

      const cust = customerSnap.data()
      const store = storeSnap.data()

      if (cust.creditStatus === 'archived') {
        throw { code: 'CU_CUSTOMER_ARCHIVED' }
      }
      if (input.entryType === 'credit_sale' && cust.creditStatus === 'frozen') {
        throw { code: 'CU_CUSTOMER_FROZEN' }
      }
      if (input.entryType === 'adjustment' && input.actorRole === 'employee') {
        throw { code: 'CU_FORBIDDEN' }
      }

      const balanceBefore = Number(cust.currentBalance ?? 0)
      const prevSeq = Number(cust.lastLedgerSeq ?? 0)
      const nextSeq = prevSeq + 1
      const balanceAfter = balanceBefore + input.signedAmount

      const allowNegative = Boolean(store.allowNegativeBalance)
      if (!allowNegative && balanceAfter < 0) {
        throw { code: 'CU_PAYMENT_EXCEEDS_BALANCE' }
      }

      const effectiveLimit =
        typeof cust.creditLimit === 'number'
          ? cust.creditLimit
          : typeof store.defaultCreditLimit === 'number'
            ? store.defaultCreditLimit
            : null

      const exceedsLimit =
        input.entryType === 'credit_sale' && effectiveLimit !== null && balanceAfter > effectiveLimit

      if (exceedsLimit) {
        const allowOverLimit = store.allowOverLimit !== false
        if (!allowOverLimit || input.actorRole === 'employee' || !input.confirmOverLimit) {
          throw { code: 'CU_CREDIT_LIMIT_EXCEEDED' }
        }
      }

      const now = new Date()
      const businessDate = toBogotaBusinessDate(now)
      const occurredIso = now.toISOString()

      tx.set(entryRef, {
        storeId: input.storeId,
        customerId: input.customerId,
        customerName: String(cust.fullName ?? 'Cliente'),
        customerSeq: nextSeq,
        entryType: input.entryType,
        signedAmount: input.signedAmount,
        balanceBefore,
        balanceAfter,
        paymentMethod: input.paymentMethod ?? null,
        reversesEntryId: null,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        note: input.note ? input.note : null,
        reason: input.reason ? input.reason : null,
        occurredAt: serverTimestamp(),
        businessDate,
        createdBy: user.uid,
        createdByName: actorName,
        createdAt: serverTimestamp(),
      })

      const customerUpdates: Record<string, unknown> = {
        currentBalance: balanceAfter,
        lastLedgerSeq: nextSeq,
        lastLedgerEntryId: input.idempotencyKey,
        lastActivityAt: serverTimestamp(),
        balanceUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      if (input.entryType === 'credit_sale') {
        customerUpdates.lastCreditSaleAt = serverTimestamp()
      } else if (input.entryType === 'payment') {
        customerUpdates.lastPaymentAt = serverTimestamp()
      }

      tx.update(customerRef, customerUpdates)

      if (input.entryType === 'adjustment' || exceedsLimit) {
        tx.set(doc(collection(db, 'stores', input.storeId, 'auditLogs')), {
          storeId: input.storeId,
          actorUserId: user.uid,
          actorRole: input.actorRole,
          action: input.entryType === 'adjustment' ? 'ledger.adjustment' : 'ledger.over_limit_approved',
          entityType: 'ledger_entry',
          entityId: input.idempotencyKey,
          beforeState: { currentBalance: balanceBefore },
          afterState: { currentBalance: balanceAfter, reason: input.reason ?? null },
          createdAt: serverTimestamp(),
        })
      }

      return {
        entry: {
          id: input.idempotencyKey,
          storeId: input.storeId,
          customerId: input.customerId,
          customerName: String(cust.fullName ?? 'Cliente'),
          customerSeq: nextSeq,
          entryType: input.entryType,
          signedAmount: input.signedAmount,
          balanceBefore,
          balanceAfter,
          paymentMethod: input.paymentMethod ?? null,
          reversesEntryId: null,
          reversedByEntryId: null,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          note: input.note ? input.note : null,
          reason: input.reason ? input.reason : null,
          occurredAt: occurredIso,
          businessDate,
          createdBy: user.uid,
          createdByName: actorName,
          createdAt: occurredIso,
        },
        newBalance: balanceAfter,
        idempotentReplay: false,
      }
    })
  } catch (err) {
    throw normalizeError(err)
  }
}

/**
 * Reversión compensatoria atómica (`BR-13`, `CL-06`, `CL-07`):
 * - Nunca edita ni borra el asiento original.
 * - Candado `/reversals/{originalEntryId}` impide doble reversión incluso bajo concurrencia.
 * - Prohibido revertir una reversión.
 */
export async function reverseLedgerEntry(params: {
  storeId: string
  originalEntryId: string
  reason: string
  idempotencyKey: string
  actorRole: StoreRole
}): Promise<PostLedgerEntryResult> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const origRef = doc(db, 'stores', params.storeId, 'ledgerEntries', params.originalEntryId)
    const reversalLockRef = doc(db, 'stores', params.storeId, 'reversals', params.originalEntryId)
    const newEntryRef = doc(db, 'stores', params.storeId, 'ledgerEntries', params.idempotencyKey)
    const storeRef = doc(db, 'stores', params.storeId)

    const payloadHash = await computePayloadHash({
      originalEntryId: params.originalEntryId,
      entryType: 'reversal',
    })
    const actorName = user.displayName || user.email?.split('@')[0] || 'Usuario'

    return await runTransaction(db, async (tx) => {
      const [existingSnap, origSnap, lockSnap, storeSnap] = await Promise.all([
        tx.get(newEntryRef),
        tx.get(origRef),
        tx.get(reversalLockRef),
        tx.get(storeRef),
      ])

      if (existingSnap.exists()) {
        const d = existingSnap.data()
        if (String(d.payloadHash ?? '') !== payloadHash) throw { code: 'CU_IDEMPOTENCY_CONFLICT' }
        const item = mapLedgerDoc(existingSnap.id, d, new Set())
        return { entry: item, newBalance: item.balanceAfter, idempotentReplay: true }
      }

      if (!origSnap.exists() || !storeSnap.exists()) throw { code: 'not-found' }
      if (lockSnap.exists()) throw { code: 'CU_ALREADY_REVERSED' }

      const orig = origSnap.data()
      if (orig.entryType === 'reversal') throw { code: 'CU_CANNOT_REVERSE_REVERSAL' }

      const store = storeSnap.data()
      if (params.actorRole === 'employee') {
        const maxMinutes = Number(store.employeeCanReverseMinutes ?? 0)
        if (maxMinutes <= 0 || orig.createdBy !== user.uid) throw { code: 'CU_FORBIDDEN' }
        const createdMs = orig.createdAt instanceof Timestamp ? orig.createdAt.toMillis() : 0
        if (Date.now() - createdMs > maxMinutes * 60_000) throw { code: 'CU_FORBIDDEN' }
      }

      const customerId = String(orig.customerId)
      const customerRef = doc(db, 'stores', params.storeId, 'customers', customerId)
      const customerSnap = await tx.get(customerRef)
      if (!customerSnap.exists()) throw { code: 'not-found' }

      const cust = customerSnap.data()
      if (cust.creditStatus === 'archived') throw { code: 'CU_CUSTOMER_ARCHIVED' }

      const balanceBefore = Number(cust.currentBalance ?? 0)
      const nextSeq = Number(cust.lastLedgerSeq ?? 0) + 1
      const signedAmount = -Number(orig.signedAmount)
      const balanceAfter = balanceBefore + signedAmount

      if (!store.allowNegativeBalance && balanceAfter < 0) {
        throw { code: 'CU_PAYMENT_EXCEEDS_BALANCE' }
      }

      const now = new Date()
      const businessDate = toBogotaBusinessDate(now)
      const nowIso = now.toISOString()

      tx.set(newEntryRef, {
        storeId: params.storeId,
        customerId,
        customerName: String(cust.fullName ?? 'Cliente'),
        customerSeq: nextSeq,
        entryType: 'reversal',
        signedAmount,
        balanceBefore,
        balanceAfter,
        paymentMethod: null,
        reversesEntryId: params.originalEntryId,
        idempotencyKey: params.idempotencyKey,
        payloadHash,
        note: `Anula movimiento #${String(orig.customerSeq ?? '').padStart(3, '0')}`,
        reason: params.reason,
        occurredAt: serverTimestamp(),
        businessDate,
        createdBy: user.uid,
        createdByName: actorName,
        createdAt: serverTimestamp(),
      })

      tx.set(reversalLockRef, {
        originalEntryId: params.originalEntryId,
        reversalEntryId: params.idempotencyKey,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })

      tx.update(customerRef, {
        currentBalance: balanceAfter,
        lastLedgerSeq: nextSeq,
        lastLedgerEntryId: params.idempotencyKey,
        lastActivityAt: serverTimestamp(),
        balanceUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      tx.set(doc(collection(db, 'stores', params.storeId, 'auditLogs')), {
        storeId: params.storeId,
        actorUserId: user.uid,
        actorRole: params.actorRole,
        action: 'ledger.entry_reversed',
        entityType: 'ledger_entry',
        entityId: params.originalEntryId,
        beforeState: { balance: balanceBefore, reversedSeq: orig.customerSeq },
        afterState: { balance: balanceAfter, reversalId: params.idempotencyKey, reason: params.reason },
        createdAt: serverTimestamp(),
      })

      return {
        entry: {
          id: params.idempotencyKey,
          storeId: params.storeId,
          customerId,
          customerName: String(cust.fullName ?? 'Cliente'),
          customerSeq: nextSeq,
          entryType: 'reversal',
          signedAmount,
          balanceBefore,
          balanceAfter,
          paymentMethod: null,
          reversesEntryId: params.originalEntryId,
          reversedByEntryId: null,
          idempotencyKey: params.idempotencyKey,
          payloadHash,
          note: `Anula movimiento #${String(orig.customerSeq ?? '').padStart(3, '0')}`,
          reason: params.reason,
          occurredAt: nowIso,
          businessDate,
          createdBy: user.uid,
          createdByName: actorName,
          createdAt: nowIso,
        },
        newBalance: balanceAfter,
        idempotentReplay: false,
      }
    })
  } catch (err) {
    throw normalizeError(err)
  }
}

/**
 * Migración de cuaderno (`BR-15`): crea cliente y registra atómicamente su `opening_balance` (#001).
 */
export async function createCustomerWithOpeningBalance(params: {
  storeId: string
  fullName: string
  nickname?: string
  phoneRaw?: string
  openingBalance: number
  note?: string
  idempotencyKey: string
}): Promise<{ customer: CustomerItem; entry: LedgerEntryItem }> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const custRef = doc(collection(db, 'stores', params.storeId, 'customers'))
    const entryRef = doc(db, 'stores', params.storeId, 'ledgerEntries', params.idempotencyKey)
    const phoneE164 = params.phoneRaw ? normalizeColombianPhone(params.phoneRaw) : null
    const nickname = params.nickname?.trim() ? params.nickname.trim() : null
    const searchText = normalizeSearchText([params.fullName, nickname ?? '', phoneE164 ?? ''].join(' '))
    const actorName = user.displayName || user.email?.split('@')[0] || 'Usuario'
    const payloadHash = await computePayloadHash({
      fullName: params.fullName,
      openingBalance: params.openingBalance,
      entryType: 'opening_balance',
    })
    const now = new Date()
    const businessDate = toBogotaBusinessDate(now)
    const nowIso = now.toISOString()

    await runTransaction(db, async (tx) => {
      const existingSnap = await tx.get(entryRef)
      if (existingSnap.exists()) throw { code: 'CU_IDEMPOTENCY_CONFLICT' }

      tx.set(custRef, {
        storeId: params.storeId,
        fullName: params.fullName.trim(),
        nickname,
        phoneE164,
        documentNumber: null,
        address: null,
        notes: null,
        whatsappOptOut: false,
        consentRecordedAt: phoneE164 ? serverTimestamp() : null,
        creditStatus: 'active',
        creditLimit: null,
        currentBalance: params.openingBalance,
        lastLedgerSeq: 1,
        lastLedgerEntryId: params.idempotencyKey,
        lastCreditSaleAt: null,
        lastPaymentAt: null,
        lastActivityAt: serverTimestamp(),
        balanceUpdatedAt: serverTimestamp(),
        searchText,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      tx.set(entryRef, {
        storeId: params.storeId,
        customerId: custRef.id,
        customerName: params.fullName.trim(),
        customerSeq: 1,
        entryType: 'opening_balance',
        signedAmount: params.openingBalance,
        balanceBefore: 0,
        balanceAfter: params.openingBalance,
        paymentMethod: null,
        reversesEntryId: null,
        idempotencyKey: params.idempotencyKey,
        payloadHash,
        note: params.note?.trim() || 'Saldo pasado del cuaderno',
        reason: null,
        occurredAt: serverTimestamp(),
        businessDate,
        createdBy: user.uid,
        createdByName: actorName,
        createdAt: serverTimestamp(),
      })
    })

    return {
      customer: {
        id: custRef.id,
        storeId: params.storeId,
        fullName: params.fullName.trim(),
        nickname,
        phoneE164,
        documentNumber: null,
        address: null,
        notes: null,
        whatsappOptOut: false,
        creditStatus: 'active',
        creditLimit: null,
        currentBalance: params.openingBalance,
        lastLedgerSeq: 1,
        lastCreditSaleAt: null,
        lastPaymentAt: null,
        lastActivityAt: nowIso,
        searchText,
        createdBy: user.uid,
        createdAt: nowIso,
      },
      entry: {
        id: params.idempotencyKey,
        storeId: params.storeId,
        customerId: custRef.id,
        customerName: params.fullName.trim(),
        customerSeq: 1,
        entryType: 'opening_balance',
        signedAmount: params.openingBalance,
        balanceBefore: 0,
        balanceAfter: params.openingBalance,
        paymentMethod: null,
        reversesEntryId: null,
        reversedByEntryId: null,
        idempotencyKey: params.idempotencyKey,
        payloadHash,
        note: params.note?.trim() || 'Saldo pasado del cuaderno',
        reason: null,
        occurredAt: nowIso,
        businessDate,
        createdBy: user.uid,
        createdByName: actorName,
        createdAt: nowIso,
      },
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

/**
 * Verificador puro de las 4 invariantes de conciliación contable (`BR-08`):
 * 1. `currentBalance === SUM(signedAmount)` y `lastLedgerSeq === entriesAsc.length`
 * 2. Continuidad estricta sin huecos ni duplicados de `customerSeq` (`1..N`)
 * 3. Cadena exacta `balanceBefore[i] === balanceAfter[i-1]` y `balanceAfter[i] === balanceBefore[i] + signedAmount[i]`
 * 4. Paridad exacta de reversiones (`reversal.signedAmount === -orig.signedAmount`, prohibido revertir una reversión y prohibida la doble reversión).
 */
export function reconcileCustomerEntries(
  customerBalance: number,
  customerLastSeq: number,
  entriesAsc: LedgerEntryItem[],
): { ok: boolean; expectedBalance: number; issues: string[] } {
  const issues: string[] = []
  let running = 0
  const byId = new Map<string, LedgerEntryItem>()
  const reversedOriginals = new Set<string>()

  for (let i = 0; i < entriesAsc.length; i++) {
    const entry = entriesAsc[i]!
    byId.set(entry.id, entry)
    const expectedSeq = i + 1
    if (entry.customerSeq !== expectedSeq) {
      issues.push(`Salto de secuencia: esperado #${expectedSeq}, encontrado #${entry.customerSeq}`)
    }
    if (entry.balanceBefore !== running) {
      issues.push(`balanceBefore inconsistente en #${entry.customerSeq}`)
    }
    running += entry.signedAmount
    if (entry.balanceAfter !== running) {
      issues.push(`balanceAfter inconsistente en #${entry.customerSeq}`)
    }

    if (entry.entryType === 'reversal') {
      if (!entry.reversesEntryId) {
        issues.push(`Reversión #${entry.customerSeq} sin reversesEntryId`)
      } else {
        if (reversedOriginals.has(entry.reversesEntryId)) {
          issues.push(`Doble reversión detectada sobre el asiento ${entry.reversesEntryId}`)
        }
        reversedOriginals.add(entry.reversesEntryId)
        const original = byId.get(entry.reversesEntryId)
        if (!original) {
          issues.push(`Reversión #${entry.customerSeq} apunta a asiento inexistente o futuro (${entry.reversesEntryId})`)
        } else {
          if (original.entryType === 'reversal') {
            issues.push(`Prohibido revertir una reversión (#${entry.customerSeq} -> #${original.customerSeq})`)
          }
          if (entry.signedAmount !== -original.signedAmount) {
            issues.push(
              `Paridad de reversión inválida en #${entry.customerSeq}: esperado ${-original.signedAmount}, encontrado ${entry.signedAmount}`,
            )
          }
        }
      }
    }
  }

  if (running !== customerBalance) {
    issues.push(`Saldo materializado (${customerBalance}) != suma ledger (${running})`)
  }
  if (entriesAsc.length !== customerLastSeq) {
    issues.push(`lastLedgerSeq (${customerLastSeq}) != total asientos (${entriesAsc.length})`)
  }

  return { ok: issues.length === 0, expectedBalance: running, issues }
}

export interface StorePortfolioReconciliationReport {
  ok: boolean
  checkedCustomers: number
  checkedEntries: number
  totalReceivable: number
  totalCustomerFavor: number
  discrepancies: Array<{ customerId: string; customerName: string; issues: string[] }>
}

/**
 * Concilia toda la cartera de una tienda verificando las 4 invariantes sobre cada cliente
 * y separando `SUM(GREATEST(currentBalance, 0))` (Por cobrar) de saldos a favor (`Escenario #10`).
 */
export function reconcileStorePortfolio(
  customers: Array<{ id: string; fullName: string; currentBalance: number; lastLedgerSeq: number }>,
  allEntries: LedgerEntryItem[],
): StorePortfolioReconciliationReport {
  const entriesByCustomer = new Map<string, LedgerEntryItem[]>()
  for (const entry of allEntries) {
    const list = entriesByCustomer.get(entry.customerId) ?? []
    list.push(entry)
    entriesByCustomer.set(entry.customerId, list)
  }

  const discrepancies: Array<{ customerId: string; customerName: string; issues: string[] }> = []
  let totalReceivable = 0
  let totalCustomerFavor = 0

  for (const cust of customers) {
    if (cust.currentBalance > 0) {
      totalReceivable += cust.currentBalance
    } else if (cust.currentBalance < 0) {
      totalCustomerFavor += Math.abs(cust.currentBalance)
    }

    const custEntriesAsc = [...(entriesByCustomer.get(cust.id) ?? [])].sort(
      (a, b) => a.customerSeq - b.customerSeq,
    )
    const result = reconcileCustomerEntries(cust.currentBalance, cust.lastLedgerSeq, custEntriesAsc)
    if (!result.ok) {
      discrepancies.push({
        customerId: cust.id,
        customerName: cust.fullName,
        issues: result.issues,
      })
    }
  }

  return {
    ok: discrepancies.length === 0,
    checkedCustomers: customers.length,
    checkedEntries: allEntries.length,
    totalReceivable,
    totalCustomerFavor,
    discrepancies,
  }
}

/**
 * Simulacro de restauración y registro Tombstone Habeas Data (`Escenarios #12 y #16`):
 * Al restaurar un backup histórico, re-aplica las anonimizaciones ARCO solicitadas después del backup
 * sin alterar saldos ni asientos del libro mayor.
 */
export function applyHabeasDataTombstonesToSnapshot<
  T extends {
    id: string
    fullName: string
    nickname: string | null
    phoneE164: string | null
    documentNumber: string | null
    address: string | null
    notes: string | null
    whatsappOptOut: boolean
    currentBalance: number
    lastLedgerSeq: number
  },
>(customersSnapshot: T[], tombstoneCustomerIds: Iterable<string>): T[] {
  const tombstones = new Set(tombstoneCustomerIds)
  return customersSnapshot.map((c) => {
    if (!tombstones.has(c.id)) return c
    return {
      ...c,
      fullName: 'Cliente anonimizado (Habeas Data)',
      nickname: null,
      phoneE164: null,
      documentNumber: null,
      address: null,
      notes: null,
      whatsappOptOut: true,
    }
  })
}

export { CO_TIMEZONE }
