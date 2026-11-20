/**
 * Genera una llave UUID v4 criptográfica para idempotencia de operaciones financieras (`BR-06`).
 */
export function createIdempotencyKey(): string {
  return crypto.randomUUID()
}

export interface ActionAttempt {
  /** Devuelve la llave vigente para esta intención (la misma ante reintentos por error de red). */
  getKey: () => string
  /** Rota la llave únicamente tras confirmar éxito o iniciar una nueva intención del usuario. */
  reset: () => void
}

/**
 * Mantiene estable la `idempotency_key` a través de reintentos de una misma operación
 * hasta que el intento se completa o el usuario cancela explícitamente.
 */
export function createActionAttempt(): ActionAttempt {
  let currentKey: string | null = null
  return {
    getKey() {
      if (!currentKey) currentKey = createIdempotencyKey()
      return currentKey
    },
    reset() {
      currentKey = null
    },
  }
}
