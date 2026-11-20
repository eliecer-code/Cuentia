export const CO_TIMEZONE = 'America/Bogota' as const

// Colombia no tiene cambio horario (DST): desplazamiento fijo UTC-5.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000

export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month'

export interface PeriodUtcRange {
  businessDateFrom: string
  businessDateTo: string
  startUtcIso: string
  endUtcIso: string
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

function toBogotaParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const shifted = new Date(date.getTime() - BOGOTA_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay(), // 0 = domingo, 6 = sábado
  }
}

function bogotaMidnightToUtcIso(year: number, month: number, day: number): string {
  const utcMs = Date.UTC(year, month - 1, day, 5, 0, 0, 0)
  return new Date(utcMs).toISOString()
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Devuelve la fecha comercial local (`YYYY-MM-DD`) en `America/Bogota` para cualquier instante UTC.
 * Independiente de la zona horaria del navegador o del servidor.
 */
export function toBogotaBusinessDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) throw new RangeError('Fecha inválida')
  const { year, month, day } = toBogotaParts(d)
  return formatYmd(year, month, day)
}

/**
 * Calcula rangos `[startUtcIso, endUtcIso)` exactos en hora de Bogotá para consultas `TIMESTAMPTZ` y `business_date`.
 */
export function getBogotaPeriodRange(period: DashboardPeriod, now: Date = new Date()): PeriodUtcRange {
  const { year, month, day, dayOfWeek } = toBogotaParts(now)
  const todayUtc = Date.UTC(year, month - 1, day)
  const oneDayMs = 24 * 60 * 60 * 1000

  let startDate: Date
  let endExclusiveDate: Date

  if (period === 'today') {
    startDate = new Date(todayUtc)
    endExclusiveDate = new Date(todayUtc + oneDayMs)
  } else if (period === 'yesterday') {
    startDate = new Date(todayUtc - oneDayMs)
    endExclusiveDate = new Date(todayUtc)
  } else if (period === 'week') {
    // Semana comercial lunes a domingo en Colombia
    const daysSinceMonday = (dayOfWeek + 6) % 7
    startDate = new Date(todayUtc - daysSinceMonday * oneDayMs)
    endExclusiveDate = new Date(todayUtc + oneDayMs)
  } else {
    startDate = new Date(Date.UTC(year, month - 1, 1))
    endExclusiveDate = new Date(todayUtc + oneDayMs)
  }

  const endInclusive = new Date(endExclusiveDate.getTime() - oneDayMs)

  return {
    businessDateFrom: formatYmd(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate()),
    businessDateTo: formatYmd(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth() + 1, endInclusive.getUTCDate()),
    startUtcIso: bogotaMidnightToUtcIso(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate()),
    endUtcIso: bogotaMidnightToUtcIso(
      endExclusiveDate.getUTCFullYear(),
      endExclusiveDate.getUTCMonth() + 1,
      endExclusiveDate.getUTCDate(),
    ),
  }
}

const bogotaDateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: CO_TIMEZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatBogotaDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return bogotaDateTimeFormatter.format(d)
}

/**
 * Guardrail preventivo Ley 2300 de 2023 (Colombia):
 * Lunes a viernes 7:00 a.m. - 7:00 p.m., sábados 8:00 a.m. - 3:00 p.m., sin domingos.
 * (No bloquea, solo permite mostrar aviso preventivo al enviar recordatorios por WhatsApp).
 */
export function isWithinColombianCollectionHours(now: Date = new Date()): boolean {
  const { hour, dayOfWeek } = toBogotaParts(now)
  if (dayOfWeek === 0) return false
  if (dayOfWeek === 6) return hour >= 8 && hour < 15
  return hour >= 7 && hour < 19
}

/**
 * Calcula los días calendario enteros transcurridos en `America/Bogota` entre `from` y `now`.
 */
export function daysSinceBogotaDate(from: Date | string | null | undefined, now: Date = new Date()): number {
  if (!from) return 0
  const d = typeof from === 'string' ? new Date(from) : from
  if (Number.isNaN(d.getTime())) return 0
  const fromParts = toBogotaParts(d)
  const nowParts = toBogotaParts(now)
  const fromUtcDay = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day)
  const nowUtcDay = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day)
  const diffDays = Math.floor((nowUtcDay - fromUtcDay) / (24 * 60 * 60 * 1000))
  return Math.max(0, diffDays)
}
