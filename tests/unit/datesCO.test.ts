import { describe, expect, it } from 'vitest'
import {
  formatBogotaDateTime,
  getBogotaPeriodRange,
  isWithinColombianCollectionHours,
  toBogotaBusinessDate,
} from '@/shared/utils/datesCO'

describe('datesCO.ts — cortes exactos en America/Bogota (UTC-5)', () => {
  it('clasifica correctamente transacciones cerca de medianoche COT (CL-14)', () => {
    // 2026-05-10 23:55:00 COT === 2026-05-11T04:55:00.000Z
    expect(toBogotaBusinessDate('2026-05-11T04:55:00.000Z')).toBe('2026-05-10')
    // 2026-05-11 00:05:00 COT === 2026-05-11T05:05:00.000Z
    expect(toBogotaBusinessDate('2026-05-11T05:05:00.000Z')).toBe('2026-05-11')
    // 2026-05-10 19:30:00 COT === 2026-05-11T00:30:00.000Z (no salta de día a las 7 p. m.)
    expect(toBogotaBusinessDate('2026-05-11T00:30:00.000Z')).toBe('2026-05-10')
  })

  it('calcula rangos UTC exactos para Hoy, Ayer, Semana y Mes', () => {
    // Miércoles 2026-05-13 22:30 COT === 2026-05-14T03:30:00.000Z
    const now = new Date('2026-05-14T03:30:00.000Z')

    const today = getBogotaPeriodRange('today', now)
    expect(today).toEqual({
      businessDateFrom: '2026-05-13',
      businessDateTo: '2026-05-13',
      startUtcIso: '2026-05-13T05:00:00.000Z',
      endUtcIso: '2026-05-14T05:00:00.000Z',
    })

    const yesterday = getBogotaPeriodRange('yesterday', now)
    expect(yesterday).toEqual({
      businessDateFrom: '2026-05-12',
      businessDateTo: '2026-05-12',
      startUtcIso: '2026-05-12T05:00:00.000Z',
      endUtcIso: '2026-05-13T05:00:00.000Z',
    })

    const week = getBogotaPeriodRange('week', now)
    expect(week.businessDateFrom).toBe('2026-05-11') // Lunes
    expect(week.businessDateTo).toBe('2026-05-13')

    const month = getBogotaPeriodRange('month', now)
    expect(month.businessDateFrom).toBe('2026-05-01')
    expect(month.businessDateTo).toBe('2026-05-13')
  })

  it('valida horarios hábiles preventivos Ley 2300 de 2023', () => {
    // Lunes 10:00 COT (15:00Z) -> permitido
    expect(isWithinColombianCollectionHours(new Date('2026-05-11T15:00:00.000Z'))).toBe(true)
    // Lunes 20:00 COT (01:00Z día siguiente) -> fuera de horario
    expect(isWithinColombianCollectionHours(new Date('2026-05-12T01:00:00.000Z'))).toBe(false)
    // Sábado 10:00 COT (15:00Z) -> permitido
    expect(isWithinColombianCollectionHours(new Date('2026-05-16T15:00:00.000Z'))).toBe(true)
    // Sábado 16:00 COT (21:00Z) -> fuera de horario
    expect(isWithinColombianCollectionHours(new Date('2026-05-16T21:00:00.000Z'))).toBe(false)
    // Domingo 10:00 COT (15:00Z) -> fuera de horario
    expect(isWithinColombianCollectionHours(new Date('2026-05-17T15:00:00.000Z'))).toBe(false)
  })

  it('formatea fecha/hora en español colombiano y tolera fecha inválida', () => {
    expect(formatBogotaDateTime('2026-05-11T15:00:00.000Z')).toMatch(/11/)
    expect(formatBogotaDateTime('no-es-fecha')).toBe('')
  })
})
