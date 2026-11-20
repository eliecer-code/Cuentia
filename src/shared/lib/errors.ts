import type { AppError, AppErrorCode } from '@/shared/types/appError'

interface RawErrorShape {
  code?: string
  message?: string
}

const DOMAIN_ERRORS: Record<string, { code: AppErrorCode; userMessage: string; retryable: boolean }> = {
  CU_CREDIT_LIMIT_EXCEEDED: {
    code: 'CREDIT_LIMIT_EXCEEDED',
    userMessage: 'Este fiado supera el tope autorizado para este cliente.',
    retryable: false,
  },
  CU_PAYMENT_EXCEEDS_BALANCE: {
    code: 'PAYMENT_EXCEEDS_BALANCE',
    userMessage: 'El abono supera el saldo pendiente de la cuenta.',
    retryable: false,
  },
  CU_ALREADY_REVERSED: {
    code: 'ALREADY_REVERSED',
    userMessage: 'Este movimiento ya fue anulado anteriormente.',
    retryable: false,
  },
  CU_CANNOT_REVERSE_REVERSAL: {
    code: 'CANNOT_REVERSE_REVERSAL',
    userMessage: 'No se puede anular una anulación. Registra un movimiento nuevo si hace falta.',
    retryable: false,
  },
  CU_IDEMPOTENCY_CONFLICT: {
    code: 'IDEMPOTENCY_CONFLICT',
    userMessage: 'Esta operación ya se envió con otros datos. Recarga e intenta de nuevo.',
    retryable: false,
  },
  CU_CUSTOMER_FROZEN: {
    code: 'CUSTOMER_FROZEN',
    userMessage: 'Este cliente está bloqueado para nuevos fiados. Solo puede registrar abonos.',
    retryable: false,
  },
  CU_CUSTOMER_ARCHIVED: {
    code: 'CUSTOMER_ARCHIVED',
    userMessage: 'Este cliente está archivado. Reactívalo primero para registrar movimientos.',
    retryable: false,
  },
  CU_CUSTOMER_HAS_BALANCE: {
    code: 'CUSTOMER_HAS_BALANCE',
    userMessage: 'No puedes archivar un cliente con saldo pendiente. Bloquéalo o salda su cuenta primero.',
    retryable: false,
  },
  CU_INVITATION_INVALID: {
    code: 'INVITATION_INVALID',
    userMessage: 'Esta invitación ya venció, fue cancelada o ya fue utilizada.',
    retryable: false,
  },
  CU_INVITATION_EMAIL_MISMATCH: {
    code: 'INVITATION_EMAIL_MISMATCH',
    userMessage: 'Esta invitación corresponde a otro correo. Entra con el correo al que fue enviada.',
    retryable: false,
  },
  CU_LAST_OWNER: {
    code: 'LAST_OWNER',
    userMessage: 'La tienda siempre debe tener un propietario. Transfiere la propiedad antes de salir.',
    retryable: false,
  },
  CU_FORBIDDEN: {
    code: 'FORBIDDEN',
    userMessage: 'No tienes permisos para realizar esta acción en esta tienda.',
    retryable: false,
  },
}

const FIREBASE_ERRORS: Record<string, AppError> = {
  'auth/invalid-credential': {
    code: 'INVALID_CREDENTIALS',
    userMessage: 'El correo o la contraseña no coinciden. Revisa e intenta de nuevo.',
    retryable: false,
  },
  'auth/wrong-password': {
    code: 'INVALID_CREDENTIALS',
    userMessage: 'El correo o la contraseña no coinciden. Revisa e intenta de nuevo.',
    retryable: false,
  },
  'auth/user-not-found': {
    code: 'INVALID_CREDENTIALS',
    userMessage: 'El correo o la contraseña no coinciden. Revisa e intenta de nuevo.',
    retryable: false,
  },
  'auth/email-already-in-use': {
    code: 'EMAIL_ALREADY_REGISTERED',
    userMessage: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    retryable: false,
  },
  'auth/weak-password': {
    code: 'VALIDATION_ERROR',
    userMessage: 'Usa una contraseña más segura (mínimo 10 caracteres).',
    retryable: false,
  },
  'auth/too-many-requests': {
    code: 'NETWORK_UNAVAILABLE',
    userMessage: 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.',
    retryable: true,
  },
  'auth/network-request-failed': {
    code: 'NETWORK_UNAVAILABLE',
    userMessage: 'Sin conexión estable. Tus datos siguen aquí; intenta de nuevo cuando vuelva la señal.',
    retryable: true,
  },
  'auth/configuration-not-found': {
    code: 'VALIDATION_ERROR',
    userMessage: 'Falta activar Authentication (Correo y contraseña) en la consola de Firebase.',
    retryable: false,
  },
  'auth/user-token-expired': {
    code: 'SESSION_EXPIRED',
    userMessage: 'Tu sesión expiró. Vuelve a entrar para continuar.',
    retryable: false,
  },
  'permission-denied': DOMAIN_ERRORS.CU_FORBIDDEN!,
  'unauthenticated': {
    code: 'SESSION_EXPIRED',
    userMessage: 'Tu sesión expiró. Vuelve a entrar para continuar.',
    retryable: false,
  },
  'not-found': {
    code: 'NOT_FOUND',
    userMessage: 'No encontramos el registro solicitado.',
    retryable: false,
  },
  'already-exists': {
    code: 'CONFLICT_DUPLICATE',
    userMessage: 'Ya existe un registro con ese dato en tu tienda. Verifica antes de guardar.',
    retryable: false,
  },
  'failed-precondition': {
    code: 'VALIDATION_ERROR',
    userMessage: 'No se pudo completar la operación por una condición del negocio. Recarga e intenta de nuevo.',
    retryable: false,
  },
  'aborted': {
    code: 'NETWORK_UNAVAILABLE',
    userMessage: 'La tienda está procesando otro movimiento de este cliente. Intenta de nuevo en un segundo.',
    retryable: true,
  },
  'unavailable': {
    code: 'NETWORK_UNAVAILABLE',
    userMessage: 'Sin conexión estable. Tus datos siguen aquí; intenta de nuevo cuando vuelva la señal.',
    retryable: true,
  },
}

const KNOWN_APP_ERROR_CODES = new Set<AppErrorCode>([
  'CREDIT_LIMIT_EXCEEDED',
  'PAYMENT_EXCEEDS_BALANCE',
  'ALREADY_REVERSED',
  'CANNOT_REVERSE_REVERSAL',
  'IDEMPOTENCY_CONFLICT',
  'CUSTOMER_FROZEN',
  'CUSTOMER_ARCHIVED',
  'CUSTOMER_HAS_BALANCE',
  'INVITATION_INVALID',
  'INVITATION_EMAIL_MISMATCH',
  'LAST_OWNER',
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_REGISTERED',
  'FORBIDDEN',
  'CONFLICT_DUPLICATE',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'SESSION_EXPIRED',
  'NETWORK_UNAVAILABLE',
  'UNKNOWN_ERROR',
])

const SENSITIVE_FIELD_PATTERN =
  /^(?:password|passwd|secret|token|accessToken|refreshToken|idToken|apiKey|invitationToken|phone|phoneRaw|phoneE164|email|invitedEmail|documentNumber|address|fullName|nickname)$/i

/**
 * Redacta correos, celulares colombianos (+57 / 3xx), tokens Bearer, llaves API y secretos en texto libre
 * antes de enviar eventos a observabilidad o logs (`SEC-07`, Ley 1581).
 */
export function scrubPiiText(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [TOKEN_REDACTED]')
    .replace(/\b(?:AIza[0-9A-Za-z_-]{20,}|sbp_[0-9a-fA-F]{20,})\b/g, '[KEY_REDACTED]')
    .replace(/(?:\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE_REDACTED]')
}

/**
 * Limpia recursivamente objetos de error o telemetría para garantizar 0 fugas de PII o credenciales.
 */
export function scrubTelemetryPayload(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return scrubPiiText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubPiiText(value.message),
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubTelemetryPayload(item, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_PATTERN.test(k)) {
        out[k] = '[PII_REDACTED]'
      } else {
        out[k] = scrubTelemetryPayload(v, depth + 1)
      }
    }
    return out
  }
  return '[UNSERIALIZABLE]'
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<AppError>
  return (
    typeof v.code === 'string'
    && KNOWN_APP_ERROR_CODES.has(v.code as AppErrorCode)
    && typeof v.userMessage === 'string'
    && typeof v.retryable === 'boolean'
  )
}

/**
 * Traduce errores de dominio (`CU_*`), Firebase Auth, Cloud Firestore o red a un `AppError` seguro en español colombiano.
 * Es idempotente: si recibe un `AppError` ya normalizado, lo devuelve intacto sin degradarlo a `UNKNOWN_ERROR`.
 * Nunca filtra reglas internas ni detalles técnicos crudos hacia la interfaz.
 */
export function normalizeError(raw: unknown): AppError {
  if (isAppError(raw)) {
    return raw
  }

  if (import.meta.env.DEV) {
    console.error('[Cuentia error]', scrubTelemetryPayload(raw))
  }

  if (raw instanceof TypeError && /fetch|network|load failed/i.test(raw.message)) {
    return {
      code: 'NETWORK_UNAVAILABLE',
      userMessage: 'Sin conexión estable. Tus datos siguen aquí; intenta de nuevo cuando vuelva la señal.',
      retryable: true,
    }
  }

  const err = (typeof raw === 'object' && raw !== null ? raw : {}) as RawErrorShape
  const msg = typeof err.message === 'string' ? err.message : ''
  const code = typeof err.code === 'string' ? err.code : ''

  for (const [domainKey, mapped] of Object.entries(DOMAIN_ERRORS)) {
    if (msg.includes(domainKey) || code === domainKey) {
      return mapped
    }
  }

  if (code && FIREBASE_ERRORS[code]) {
    return FIREBASE_ERRORS[code]
  }

  return {
    code: 'UNKNOWN_ERROR',
    userMessage: 'Ocurrió un problema inesperado. Tus datos siguen seguros; intenta de nuevo.',
    retryable: true,
  }
}
