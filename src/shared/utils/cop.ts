import { z } from 'zod'

/** Tope máximo razonable de una sola transacción en tienda de barrio (COP enteros). */
export const MAX_SINGLE_TX_COP = 50_000_000

/** Umbral a partir del cual la UI pide confirmación extra contra errores de ceros. */
export const HIGH_AMOUNT_COP_THRESHOLD = 200_000

const copNumberFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/**
 * Formatea un monto entero en pesos colombianos (`$ 15.000`).
 * Nunca usa decimales ni acepta punto flotante no entero.
 */
export function formatCOP(amount: number, options?: { signed?: boolean }): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Monto COP inválido (se esperaba entero seguro): ${String(amount)}`)
  }
  const absFormatted = copNumberFormatter.format(Math.abs(amount))
  if (amount < 0) return `- $ ${absFormatted}`
  if (options?.signed && amount > 0) return `+ $ ${absFormatted}`
  return `$ ${absFormatted}`
}

/**
 * Convierte la entrada de texto de un input monetario a entero COP.
 * Acepta separadores de miles `.` o espacios (`"15.000"`, `"$ 15 000"`).
 * Rechaza decimales ambiguos con coma (`,50`) o letras devolviendo `null`.
 */
export function parseCOPInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes(',') || trimmed.includes('-')) return null

  const stripped = trimmed.replace(/[$\s.]/g, '')
  if (!/^\d+$/.test(stripped)) return null

  const value = Number(stripped)
  if (!Number.isSafeInteger(value)) return null
  return value
}

export const copAmountSchema = z
  .number({
    required_error: 'Ingresa un monto en pesos.',
    invalid_type_error: 'El monto debe ser un número entero en pesos.',
  })
  .int('No uses centavos ni decimales en pesos colombianos.')
  .positive('El monto debe ser mayor a $ 0.')
  .max(MAX_SINGLE_TX_COP, `El monto máximo por movimiento es ${formatCOP(MAX_SINGLE_TX_COP)}.`)

/**
 * Normaliza un número móvil colombiano (10 dígitos iniciando en 3, con o sin +57) a E.164 (`+573XXXXXXXXX`).
 * Devuelve `null` si el número es inválido.
 */
export function normalizeColombianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+57${digits}`
  }
  if (digits.length === 12 && digits.startsWith('573')) {
    return `+${digits}`
  }
  return null
}

export function isHighAmountCOP(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount >= HIGH_AMOUNT_COP_THRESHOLD
}
