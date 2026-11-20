// ponytail: caché de lectura seguro particionado estrictamente por (userId, storeId)
// en memoria + sessionStorage con TTL corto (15 min) y purga síncrona en logout / switchStore.

export const TENANT_CACHE_PREFIX = 'cuentia.cache.v1:'
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000

export interface TenantCacheEnvelope<T> {
  userId: string
  storeId: string
  resourceKey: string
  updatedAtIso: string
  updatedAtMs: number
  data: T
}

const memoryCache = new Map<string, TenantCacheEnvelope<unknown>>()
const lastSyncByTenant = new Map<string, string>()

export function buildTenantCacheKey(userId: string, storeId: string, resourceKey: string): string {
  const u = userId.trim()
  const s = storeId.trim()
  const r = resourceKey.trim()
  if (!u || !s || !r) {
    throw new Error('CU_INVALID_CACHE_SCOPE')
  }
  return `${TENANT_CACHE_PREFIX}${u}:${s}:${r}`
}

export function writeTenantCache<T>(
  userId: string | null | undefined,
  storeId: string | null | undefined,
  resourceKey: string,
  data: T,
  now: Date = new Date(),
): TenantCacheEnvelope<T> | null {
  if (!userId || !storeId) return null
  const key = buildTenantCacheKey(userId, storeId, resourceKey)
  const envelope: TenantCacheEnvelope<T> = {
    userId,
    storeId,
    resourceKey,
    updatedAtIso: now.toISOString(),
    updatedAtMs: now.getTime(),
    data,
  }

  memoryCache.set(key, envelope)
  lastSyncByTenant.set(`${userId}:${storeId}`, envelope.updatedAtIso)

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(envelope))
    } catch {
      // Ignorar cuota llena en sessionStorage de gama baja
    }
  }

  return envelope
}

export function readTenantCache<T>(
  userId: string | null | undefined,
  storeId: string | null | undefined,
  resourceKey: string,
  options: { maxAgeMs?: number; nowMs?: number } = {},
): TenantCacheEnvelope<T> | null {
  if (!userId || !storeId) return null
  const key = buildTenantCacheKey(userId, storeId, resourceKey)
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_CACHE_TTL_MS
  const nowMs = options.nowMs ?? Date.now()

  let envelope = memoryCache.get(key) as TenantCacheEnvelope<T> | undefined

  if (!envelope && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as TenantCacheEnvelope<T>
        if (parsed.userId === userId && parsed.storeId === storeId) {
          envelope = parsed
          memoryCache.set(key, parsed)
        }
      }
    } catch {
      envelope = undefined
    }
  }

  if (!envelope) return null
  if (envelope.userId !== userId || envelope.storeId !== storeId) return null
  if (nowMs - envelope.updatedAtMs > maxAgeMs) {
    memoryCache.delete(key)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key)
    }
    return null
  }

  return envelope
}

export function getLastTenantSyncIso(
  userId: string | null | undefined,
  storeId: string | null | undefined,
): string | null {
  if (!userId || !storeId) return null
  return lastSyncByTenant.get(`${userId}:${storeId}`) ?? null
}

/**
 * Purga síncrona de todos los cachés de lectura al cambiar de tienda, cerrar sesión
 * o bloquear el mostrador en un dispositivo compartido (`SEC-02`, `RF-03`).
 */
export function purgeAllTenantCaches(): void {
  memoryCache.clear()
  lastSyncByTenant.clear()

  if (typeof window !== 'undefined') {
    for (const storage of [window.sessionStorage, window.localStorage]) {
      if (!storage) continue
      const keysToRemove: string[] = []
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i)
        if (k && k.startsWith(TENANT_CACHE_PREFIX)) {
          keysToRemove.push(k)
        }
      }
      for (const k of keysToRemove) {
        storage.removeItem(k)
      }
    }
  }
}
