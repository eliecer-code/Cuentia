import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { forgotPasswordSchema, loginSchema, registerSchema } from '@/features/auth/schemas/auth.schema'
import { createStoreSchema } from '@/features/stores/schemas/store.schema'
import { createInvitationSchema } from '@/features/team/schemas/team.schema'
import { normalizeError } from '@/shared/lib/errors'
import { generateSecureTokenHex, sha256Hex } from '@/shared/utils/crypto'

describe('Fase 2 — Schemas Zod y Crypto de Invitaciones', () => {
  it('valida contraseñas fuertes (>= 10 caracteres) en registro', () => {
    expect(
      registerSchema.safeParse({ fullName: 'Marta Ruiz', email: 'marta@tienda.co', password: 'corta' }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({ fullName: 'Marta Ruiz', email: 'marta@tienda.co', password: 'ClaveSegura2026!' }).success,
    ).toBe(true)
    expect(loginSchema.safeParse({ email: 'invalido', password: '123' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'marta@tienda.co' }).success).toBe(true)
  })

  it('valida nombre de tienda y celular colombiano opcional en onboarding', () => {
    expect(createStoreSchema.safeParse({ name: 'Tienda La Esquina', phoneRaw: '' }).success).toBe(true)
    expect(createStoreSchema.safeParse({ name: 'Tienda La Esquina', phoneRaw: '312 456 7890' }).success).toBe(true)
    expect(createStoreSchema.safeParse({ name: 'A', phoneRaw: '' }).success).toBe(false)
    expect(createStoreSchema.safeParse({ name: 'Tienda La Esquina', phoneRaw: '6012345678' }).success).toBe(false)
  })

  it('impide invitar con rol owner desde el schema del cliente', () => {
    expect(createInvitationSchema.safeParse({ email: 'emp@tienda.co', role: 'employee' }).success).toBe(true)
    expect(createInvitationSchema.safeParse({ email: 'admin@tienda.co', role: 'admin' }).success).toBe(true)
    expect(createInvitationSchema.safeParse({ email: 'otro@tienda.co', role: 'owner' }).success).toBe(false)
  })

  it('genera tokens criptográficos de 256 bits y hash SHA-256 determinista', async () => {
    const token = generateSecureTokenHex(32)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const hash1 = await sha256Hex(token)
    const hash2 = await sha256Hex(token)
    expect(hash1).toMatch(/^[0-9a-f]{64}$/)
    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(token)
  })
})

describe('Fase 2 — Aislamiento de estado en Pinia (switchStore y logout)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('purga sessionStorage e incrementa tenantEpoch al cambiar de tienda', () => {
    const tenant = useTenantStore()
    tenant.stores = [
      { storeId: 's1', name: 'Tienda A', slug: 'tienda-a', phoneE164: null, currencyCode: 'COP', timezone: 'America/Bogota', status: 'active', role: 'owner' },
      { storeId: 's2', name: 'Tienda B', slug: 'tienda-b', phoneE164: null, currencyCode: 'COP', timezone: 'America/Bogota', status: 'active', role: 'employee' },
    ]
    tenant.activeStoreId = 's1'
    window.sessionStorage.setItem('draft_fiado', '50000')

    const epochBefore = tenant.tenantEpoch
    expect(tenant.isOwner).toBe(true)
    expect(tenant.canManageTeam).toBe(true)

    expect(tenant.switchStore('s2')).toBe(true)
    expect(tenant.activeStoreId).toBe('s2')
    expect(tenant.tenantEpoch).toBe(epochBefore + 1)
    expect(window.sessionStorage.getItem('draft_fiado')).toBeNull()
    expect(window.localStorage.getItem('cuentia.activeStoreId')).toBe('s2')
    expect(tenant.isOwner).toBe(false)
    expect(tenant.canManageTeam).toBe(false)

    // No permite cambiar a un storeId ajeno que no pertenece al usuario
    expect(tenant.switchStore('store-ajena')).toBe(false)
    expect(tenant.activeStoreId).toBe('s2')
  })

  it('logout limpia por completo auth, tenant y storage del navegador', async () => {
    const auth = useAuthStore()
    const tenant = useTenantStore()
    auth.user = { id: 'u1', email: 'dueno@tienda.co', fullName: 'Dueño' }
    tenant.stores = [
      { storeId: 's1', name: 'Tienda A', slug: 'tienda-a', phoneE164: null, currencyCode: 'COP', timezone: 'America/Bogota', status: 'active', role: 'owner' },
    ]
    tenant.activeStoreId = 's1'
    window.localStorage.setItem('cuentia.activeStoreId', 's1')
    window.sessionStorage.setItem('temp', '1')

    await auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(tenant.stores).toHaveLength(0)
    expect(tenant.activeStoreId).toBeNull()
    expect(window.localStorage.getItem('cuentia.activeStoreId')).toBeNull()
    expect(window.sessionStorage.getItem('temp')).toBeNull()
  })

  it('traduce códigos de error de invitaciones y credenciales Firebase', () => {
    expect(normalizeError({ message: 'CU_INVITATION_INVALID' }).code).toBe('INVITATION_INVALID')
    expect(normalizeError({ message: 'CU_INVITATION_EMAIL_MISMATCH' }).code).toBe('INVITATION_EMAIL_MISMATCH')
    expect(normalizeError({ message: 'CU_LAST_OWNER' }).code).toBe('LAST_OWNER')
    expect(normalizeError({ code: 'auth/invalid-credential' }).code).toBe('INVALID_CREDENTIALS')
    expect(normalizeError({ code: 'auth/email-already-in-use' }).code).toBe('EMAIL_ALREADY_REGISTERED')
  })
})
