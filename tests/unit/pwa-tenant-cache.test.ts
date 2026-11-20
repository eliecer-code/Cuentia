import { beforeEach, describe, expect, it } from 'vitest'
import {
  hasSessionExpiredByInactivity,
  isFinancialOrAuthApiUrl,
  SHARED_DEVICE_IDLE_TIMEOUT_MS,
} from '@/shared/lib/pwa'
import {
  getLastTenantSyncIso,
  purgeAllTenantCaches,
  readTenantCache,
  TENANT_CACHE_PREFIX,
  writeTenantCache,
} from '@/shared/utils/tenantCache'

describe('Fase 6 — PWA NetworkOnly y caché seguro particionado por userId + storeId', () => {
  beforeEach(() => {
    purgeAllTenantCaches()
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('clasifica el 100 % de los endpoints financieros y de autenticación como NetworkOnly (jamás cacheados por SW)', () => {
    expect(
      isFinancialOrAuthApiUrl(
        'https://firestore.googleapis.com/v1/projects/cuentia-55460/databases/(default)/documents/stores/s1/ledgerEntries',
      ),
    ).toBe(true)
    expect(
      isFinancialOrAuthApiUrl(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyTest',
      ),
    ).toBe(true)
    expect(isFinancialOrAuthApiUrl('https://securetoken.googleapis.com/v1/token')).toBe(true)
    expect(isFinancialOrAuthApiUrl('https://cuentia.app/rest/v1/ledger_entries')).toBe(true)
    expect(isFinancialOrAuthApiUrl('https://cuentia.app/auth/v1/token')).toBe(true)
    expect(isFinancialOrAuthApiUrl('https://cuentia.app/rpc/post_ledger_entry')).toBe(true)

    // Assets estáticos del App Shell sí están permitidos
    expect(isFinancialOrAuthApiUrl('https://cuentia.app/index.html')).toBe(false)
    expect(isFinancialOrAuthApiUrl('https://cuentia.app/assets/index-abc123.js')).toBe(false)
    expect(isFinancialOrAuthApiUrl('https://cuentia.app/manifest.webmanifest')).toBe(false)
  })

  it('particiona estrictamente el caché de lectura por (userId, storeId) e impide fugas entre tiendas o usuarios', () => {
    const now = new Date('2026-11-19T14:00:00.000Z')
    writeTenantCache('user-a', 'store-a', 'customers:list', [{ id: 'c1', fullName: 'Don Carlos' }], now)

    const hit = readTenantCache<Array<{ id: string; fullName: string }>>('user-a', 'store-a', 'customers:list', {
      nowMs: now.getTime() + 30_000,
    })
    expect(hit?.data).toEqual([{ id: 'c1', fullName: 'Don Carlos' }])
    expect(getLastTenantSyncIso('user-a', 'store-a')).toBe('2026-11-19T14:00:00.000Z')

    // Otra tienda del mismo usuario o un segundo usuario en el mismo celular NO ven los datos
    expect(readTenantCache('user-a', 'store-b', 'customers:list', { nowMs: now.getTime() + 30_000 })).toBeNull()
    expect(readTenantCache('user-b', 'store-a', 'customers:list', { nowMs: now.getTime() + 30_000 })).toBeNull()
  })

  it('expira entradas vencidas por TTL y purga el 100 % de residuos en dispositivo compartido', () => {
    const t0 = new Date('2026-11-19T14:00:00.000Z')
    writeTenantCache('user-a', 'store-a', 'ledger:store:120', [{ id: 'e1' }], t0)

    // Expirado tras 16 minutos
    const expired = readTenantCache('user-a', 'store-a', 'ledger:store:120', {
      nowMs: t0.getTime() + 16 * 60 * 1000,
    })
    expect(expired).toBeNull()

    // Escribir múltiples tiendas y purgar al cerrar sesión / cambiar turno
    writeTenantCache('user-a', 'store-a', 'customers:list', [{ id: 'c1' }], t0)
    writeTenantCache('user-a', 'store-b', 'customers:list', [{ id: 'c2' }], t0)
    window.localStorage.setItem(`${TENANT_CACHE_PREFIX}user-a:store-a:stale`, '1')

    purgeAllTenantCaches()

    expect(readTenantCache('user-a', 'store-a', 'customers:list', { nowMs: t0.getTime() })).toBeNull()
    expect(readTenantCache('user-a', 'store-b', 'customers:list', { nowMs: t0.getTime() })).toBeNull()
    expect(getLastTenantSyncIso('user-a', 'store-a')).toBeNull()
    expect(window.localStorage.getItem(`${TENANT_CACHE_PREFIX}user-a:store-a:stale`)).toBeNull()
  })

  it('detecta expiración de sesión por inactividad en dispositivo compartido (15 min)', () => {
    const startMs = 1_000_000
    expect(hasSessionExpiredByInactivity(startMs, startMs + 5 * 60 * 1000)).toBe(false)
    expect(hasSessionExpiredByInactivity(startMs, startMs + SHARED_DEVICE_IDLE_TIMEOUT_MS)).toBe(true)
  })
})
