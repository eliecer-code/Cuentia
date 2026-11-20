import { describe, expect, it } from 'vitest'
import { createActionAttempt, createIdempotencyKey } from '@/shared/utils/idempotency'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('idempotency.ts — llaves UUID estables en reintentos', () => {
  it('genera UUID v4 válidos y únicos', () => {
    const a = createIdempotencyKey()
    const b = createIdempotencyKey()
    expect(a).toMatch(UUID_V4_RE)
    expect(b).toMatch(UUID_V4_RE)
    expect(a).not.toBe(b)
  })

  it('reutiliza la misma llave en reintentos hasta llamar reset()', () => {
    const attempt = createActionAttempt()
    const first = attempt.getKey()
    expect(attempt.getKey()).toBe(first)
    expect(attempt.getKey()).toBe(first)

    attempt.reset()
    const second = attempt.getKey()
    expect(second).toMatch(UUID_V4_RE)
    expect(second).not.toBe(first)
  })
})
