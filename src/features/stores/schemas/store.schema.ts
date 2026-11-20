import { z } from 'zod'
import { normalizeColombianPhone } from '@/shared/utils/cop'

export const createStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre de tu tienda (mínimo 2 letras).')
    .max(120, 'El nombre de la tienda es demasiado largo.'),
  phoneRaw: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((val) => val === '' || normalizeColombianPhone(val) !== null, {
      message: 'Ingresa un celular colombiano válido de 10 dígitos (ej. 312 456 7890).',
    }),
})

export type CreateStoreInput = z.infer<typeof createStoreSchema>

export const updateStoreSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre de tu tienda (mínimo 2 letras).')
    .max(120, 'El nombre de la tienda es demasiado largo.'),
  phoneRaw: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((val) => val === '' || normalizeColombianPhone(val) !== null, {
      message: 'Ingresa un celular colombiano válido de 10 dígitos (ej. 312 456 7890).',
    }),
  defaultCreditLimit: z
    .number()
    .int('El tope debe ser en pesos enteros sin centavos.')
    .nonnegative('El tope no puede ser negativo.')
    .max(50_000_000, 'El tope máximo permitido es $ 50.000.000.')
    .nullable(),
  allowOverLimit: z.boolean(),
  employeeCanReverseMinutes: z
    .number()
    .int()
    .min(0)
    .max(240),
  whatsappReminderTemplate: z
    .string()
    .trim()
    .min(10, 'La plantilla de WhatsApp debe tener al menos 10 caracteres.')
    .max(600, 'La plantilla no puede superar 600 caracteres.'),
})

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>
