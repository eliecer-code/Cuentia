import { describe, expect, it } from 'vitest'
import {
  copAmountSchema,
  formatCOP,
  isHighAmountCOP,
  MAX_SINGLE_TX_COP,
  normalizeColombianPhone,
  parseCOPInput,
} from '@/shared/utils/cop'

describe('cop.ts — precisión entera y formateo COP', () => {
  it('formatea pesos colombianos enteros sin decimales', () => {
    expect(formatCOP(0)).toBe('$ 0')
    expect(formatCOP(15_000)).toBe('$ 15.000')
    expect(formatCOP(1_845_000)).toBe('$ 1.845.000')
    expect(formatCOP(15_000, { signed: true })).toBe('+ $ 15.000')
    expect(formatCOP(-10_000)).toBe('- $ 10.000')
  })

  it('rechaza valores no enteros seguros en formatCOP', () => {
    expect(() => formatCOP(15_000.5)).toThrow(RangeError)
    expect(() => formatCOP(Number.NaN)).toThrow(RangeError)
    expect(() => formatCOP(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('parsea entradas de mostrador y rechaza comas decimales o negativos', () => {
    expect(parseCOPInput('15000')).toBe(15_000)
    expect(parseCOPInput('$ 15.000')).toBe(15_000)
    expect(parseCOPInput('  1.845.000 ')).toBe(1_845_000)
    expect(parseCOPInput('')).toBeNull()
    expect(parseCOPInput('15000,50')).toBeNull()
    expect(parseCOPInput('-5000')).toBeNull()
    expect(parseCOPInput('abc')).toBeNull()
  })

  it('valida estrictamente montos COP con Zod', () => {
    expect(copAmountSchema.safeParse(15_000).success).toBe(true)
    expect(copAmountSchema.safeParse(MAX_SINGLE_TX_COP).success).toBe(true)
    expect(copAmountSchema.safeParse(0).success).toBe(false)
    expect(copAmountSchema.safeParse(-1_000).success).toBe(false)
    expect(copAmountSchema.safeParse(1_000.25).success).toBe(false)
    expect(copAmountSchema.safeParse(MAX_SINGLE_TX_COP + 1).success).toBe(false)
  })

  it('normaliza números móviles colombianos a E.164', () => {
    expect(normalizeColombianPhone('312 456 7890')).toBe('+573124567890')
    expect(normalizeColombianPhone('+57 310-555-1234')).toBe('+573105551234')
    expect(normalizeColombianPhone('573001112233')).toBe('+573001112233')
    expect(normalizeColombianPhone('6012345678')).toBeNull()
    expect(normalizeColombianPhone('31245')).toBeNull()
  })

  it('detecta montos altos para prevención de errores de ceros', () => {
    expect(isHighAmountCOP(199_999)).toBe(false)
    expect(isHighAmountCOP(200_000)).toBe(true)
    expect(isHighAmountCOP(250_000)).toBe(true)
  })
})
