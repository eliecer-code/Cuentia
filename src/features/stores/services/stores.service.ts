import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { CreateStoreInput, UpdateStoreSettingsInput } from '@/features/stores/schemas/store.schema'
import { normalizeError } from '@/shared/lib/errors'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/shared/lib/firebase'
import { DEFAULT_WHATSAPP_REMINDER_TEMPLATE } from '@/shared/lib/whatsapp'
import type { StoreRole, StoreStatus } from '@/shared/types/domain.types'
import { normalizeColombianPhone } from '@/shared/utils/cop'
import { CO_TIMEZONE } from '@/shared/utils/datesCO'

export interface UserStoreSummary {
  storeId: string
  name: string
  slug: string
  phoneE164: string | null
  currencyCode: string
  timezone: string
  status: StoreStatus
  role: StoreRole
  defaultCreditLimit?: number | null
  allowOverLimit?: boolean
  employeeCanReverseMinutes?: number
  whatsappReminderTemplate?: string
}

export interface StoreAuditLogItem {
  id: string
  action: string
  actorRole: StoreRole
  entityType: string
  createdAt: string
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}

function slugifyStoreName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const suffix = crypto.randomUUID().slice(0, 6)
  return `${base || 'tienda'}-${suffix}`
}

export async function fetchMyStores(): Promise<UserStoreSummary[]> {
  if (!isFirebaseConfigured()) return []
  const user = getFirebaseAuth().currentUser
  if (!user) return []

  try {
    const db = getFirebaseDb()
    const membershipsSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'memberships'), where('status', '==', 'active')),
    )

    const results: UserStoreSummary[] = []
    for (const mDoc of membershipsSnap.docs) {
      const storeId = mDoc.id
      const role = mDoc.data().role as StoreRole
      const storeSnap = await getDoc(doc(db, 'stores', storeId))
      if (!storeSnap.exists()) continue
      const s = storeSnap.data()
      const settingsObj = (typeof s.settings === 'object' && s.settings !== null ? s.settings : {}) as Record<string, unknown>
      results.push({
        storeId,
        name: String(s.name ?? ''),
        slug: String(s.slug ?? ''),
        phoneE164: (s.phoneE164 as string | null) ?? null,
        currencyCode: String(s.currencyCode ?? 'COP'),
        timezone: String(s.timezone ?? CO_TIMEZONE),
        status: (s.status as StoreStatus) ?? 'active',
        role,
        defaultCreditLimit: typeof s.defaultCreditLimit === 'number' && s.defaultCreditLimit > 0 ? s.defaultCreditLimit : null,
        allowOverLimit: typeof s.allowOverLimit === 'boolean' ? s.allowOverLimit : true,
        employeeCanReverseMinutes: typeof s.employeeCanReverseMinutes === 'number' ? s.employeeCanReverseMinutes : 0,
        whatsappReminderTemplate:
          typeof settingsObj.whatsappReminderTemplate === 'string' && settingsObj.whatsappReminderTemplate.trim()
            ? settingsObj.whatsappReminderTemplate
            : DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      })
    }
    return results
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function createStoreWithOwner(input: CreateStoreInput): Promise<UserStoreSummary> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const storeRef = doc(collection(db, 'stores'))
    const storeId = storeRef.id
    const slug = slugifyStoreName(input.name)
    const phoneE164 = input.phoneRaw ? normalizeColombianPhone(input.phoneRaw) : null

    // Batch atómico validado por `firestore.rules` (exige tienda + miembro owner + índice + auditoría)
    const userDocRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userDocRef)
    const batch = writeBatch(db)
    if (!userSnap.exists()) {
      batch.set(userDocRef, {
        fullName: user.displayName || user.email?.split('@')[0] || 'Propietario',
        email: (user.email ?? '').toLowerCase(),
        phoneE164: null,
        status: 'active',
        anonymizedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    batch.set(storeRef, {
      ownerUserId: user.uid,
      name: input.name,
      slug,
      phoneE164,
      currencyCode: 'COP',
      currencyMinorExponent: 0,
      timezone: CO_TIMEZONE,
      defaultCreditLimit: null,
      allowOverLimit: true,
      allowNegativeBalance: false,
      employeeCanReverseMinutes: 0,
      status: 'active',
      settings: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    batch.set(doc(db, 'stores', storeId, 'members', user.uid), {
      storeId,
      userId: user.uid,
      fullName: user.displayName || user.email?.split('@')[0] || 'Propietario',
      email: (user.email ?? '').toLowerCase(),
      role: 'owner',
      status: 'active',
      invitedBy: user.uid,
      revokedAt: null,
      revokedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    batch.set(doc(db, 'users', user.uid, 'memberships', storeId), {
      storeId,
      role: 'owner',
      status: 'active',
      updatedAt: serverTimestamp(),
    })

    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole: 'owner',
      action: 'store.created',
      entityType: 'store',
      entityId: storeId,
      beforeState: null,
      afterState: { name: input.name, slug },
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      storeId,
      name: input.name,
      slug,
      phoneE164,
      currencyCode: 'COP',
      timezone: CO_TIMEZONE,
      status: 'active',
      role: 'owner',
      defaultCreditLimit: null,
      allowOverLimit: true,
      employeeCanReverseMinutes: 0,
      whatsappReminderTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function updateStoreSettings(
  storeId: string,
  actorRole: StoreRole,
  input: UpdateStoreSettingsInput,
): Promise<{
  name: string
  phoneE164: string | null
  defaultCreditLimit: number | null
  allowOverLimit: boolean
  employeeCanReverseMinutes: number
  whatsappReminderTemplate: string
}> {
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw normalizeError({ code: 'CU_FORBIDDEN' })
  }
  const phoneE164 = input.phoneRaw ? normalizeColombianPhone(input.phoneRaw) : null

  if (!isFirebaseConfigured()) {
    return {
      name: input.name,
      phoneE164,
      defaultCreditLimit: input.defaultCreditLimit,
      allowOverLimit: input.allowOverLimit,
      employeeCanReverseMinutes: input.employeeCanReverseMinutes,
      whatsappReminderTemplate: input.whatsappReminderTemplate,
    }
  }

  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const storeRef = doc(db, 'stores', storeId)
    const batch = writeBatch(db)

    batch.update(storeRef, {
      name: input.name,
      phoneE164,
      defaultCreditLimit: input.defaultCreditLimit,
      allowOverLimit: input.allowOverLimit,
      employeeCanReverseMinutes: input.employeeCanReverseMinutes,
      'settings.whatsappReminderTemplate': input.whatsappReminderTemplate,
      updatedAt: serverTimestamp(),
    })

    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole,
      action: 'store.settings_updated',
      entityType: 'store',
      entityId: storeId,
      beforeState: null,
      afterState: {
        name: input.name,
        phoneE164,
        defaultCreditLimit: input.defaultCreditLimit,
        allowOverLimit: input.allowOverLimit,
        employeeCanReverseMinutes: input.employeeCanReverseMinutes,
      },
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      name: input.name,
      phoneE164,
      defaultCreditLimit: input.defaultCreditLimit,
      allowOverLimit: input.allowOverLimit,
      employeeCanReverseMinutes: input.employeeCanReverseMinutes,
      whatsappReminderTemplate: input.whatsappReminderTemplate,
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function listStoreAuditLogs(storeId: string, maxRows = 10): Promise<StoreAuditLogItem[]> {
  if (!isFirebaseConfigured()) return []
  try {
    const db = getFirebaseDb()
    const snap = await getDocs(
      query(
        collection(db, 'stores', storeId, 'auditLogs'),
        orderBy('createdAt', 'desc'),
        limit(maxRows),
      ),
    )
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        action: String(data.action ?? ''),
        actorRole: (data.actorRole as StoreRole) ?? 'owner',
        entityType: String(data.entityType ?? 'store'),
        createdAt: toIso(data.createdAt),
      }
    })
  } catch {
    return []
  }
}
