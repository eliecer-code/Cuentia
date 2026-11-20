import { z } from 'zod'
import { MAX_SINGLE_TX_COP, normalizeColombianPhone, parseCOPInput } from '@/shared/utils/cop'

export const customerFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre del cliente (mínimo 2 letras).')
    .max(120, 'El nombre es demasiado largo.'),
  nickname: z.string().trim().max(80, 'El apodo es demasiado largo.').optional().default(''),
  phoneRaw: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((val) => val === '' || normalizeColombianPhone(val) !== null, {
      message: 'Ingresa un celular colombiano válido de 10 dígitos (ej. 312 456 7890).',
    }),
  documentNumber: z
    .string()
    .trim()
    .max(30, 'Número de identificación demasiado largo.')
    .optional()
    .default(''),
  address: z.string().trim().max(160, 'Dirección demasiado larga.').optional().default(''),
  notes: z.string().trim().max(300, 'Nota demasiado larga.').optional().default(''),
  creditLimitRaw: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine(
      (val) => {
        if (val === '') return true
        const parsed = parseCOPInput(val)
        return parsed !== null && parsed >= 0 && parsed <= MAX_SINGLE_TX_COP
      },
      { message: 'Ingresa un tope de fiado entero en pesos (sin centavos).' },
    ),
})

export type CustomerFormInput = z.infer<typeof customerFormSchema>

export function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
