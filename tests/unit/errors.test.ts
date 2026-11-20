import { describe, expect, it } from 'vitest'
import { normalizeError } from '@/shared/lib/errors'

describe('errors.ts — normalización segura de errores Firebase y dominio', () => {
  it('mapea códigos de dominio CU_* a mensajes claros en español colombiano', () => {
    expect(normalizeError({ message: 'CU_CREDIT_LIMIT_EXCEEDED' })).toMatchObject({
      code: 'CREDIT_LIMIT_EXCEEDED',
      retryable: false,
    })
    expect(normalizeError({ message: 'CU_PAYMENT_EXCEEDS_BALANCE' })).toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      retryable: false,
    })
    expect(normalizeError({ message: 'CU_IDEMPOTENCY_CONFLICT' })).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      retryable: false,
    })
  })

  it('mapea códigos de Firebase Auth y Cloud Firestore sin filtrar detalles internos', () => {
    const perm = normalizeError({ code: 'permission-denied', message: 'Missing or insufficient permissions at stores/abc/members' })
    expect(perm.code).toBe('FORBIDDEN')
    expect(perm.userMessage).not.toContain('stores/abc')

    expect(normalizeError({ code: 'auth/invalid-credential' }).code).toBe('INVALID_CREDENTIALS')
    expect(normalizeError({ code: 'auth/email-already-in-use' }).code).toBe('EMAIL_ALREADY_REGISTERED')
    expect(normalizeError({ code: 'auth/user-token-expired' }).code).toBe('SESSION_EXPIRED')
    expect(normalizeError({ code: 'not-found' }).code).toBe('NOT_FOUND')
    expect(normalizeError({ code: 'already-exists' }).code).toBe('CONFLICT_DUPLICATE')
    expect(normalizeError({ code: 'aborted' })).toMatchObject({ code: 'NETWORK_UNAVAILABLE', retryable: true })
    expect(normalizeError({ code: 'unavailable' })).toMatchObject({ code: 'NETWORK_UNAVAILABLE', retryable: true })
  })

  it('es idempotente: no degrada un AppError ya normalizado a UNKNOWN_ERROR', () => {
    const first = normalizeError({ code: 'permission-denied' })
    expect(first.code).toBe('FORBIDDEN')
    const second = normalizeError(first)
    expect(second).toEqual(first)
  })

  it('clasifica fallos de red como reintentables', () => {
    const net = normalizeError(new TypeError('Failed to fetch'))
    expect(net.code).toBe('NETWORK_UNAVAILABLE')
    expect(net.retryable).toBe(true)
  })
})
