import { z } from 'zod'
import { copAmountSchema } from '@/shared/utils/cop'

export const paymentMethodSchema = z.enum(['cash', 'nequi', 'daviplata', 'bank_transfer', 'other'])

export const creditSaleInputSchema = z.object({
  amount: copAmountSchema,
  note: z.string().trim().max(150, 'La descripción no puede superar 150 caracteres.').optional().default(''),
  confirmOverLimit: z.boolean().optional().default(false),
})

export const paymentInputSchema = z.object({
  amount: copAmountSchema,
  paymentMethod: paymentMethodSchema,
  note: z.string().trim().max(150, 'La nota no puede superar 150 caracteres.').optional().default(''),
})

export const reversalInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Escribe el motivo de la anulación (mínimo 5 letras).')
    .max(200, 'El motivo es demasiado largo.'),
})

export const adjustmentInputSchema = z.object({
  direction: z.enum(['decrease', 'increase']),
  amount: copAmountSchema,
  reason: z
    .string()
    .trim()
    .min(5, 'Escribe el motivo del ajuste o descuento (mínimo 5 letras).')
    .max(200, 'El motivo es demasiado largo.'),
})

export const migrateNotebookSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre del cliente (mínimo 2 letras).')
    .max(120, 'El nombre es demasiado largo.'),
  nickname: z.string().trim().max(80, 'El apodo es demasiado largo.').optional().default(''),
  phoneRaw: z.string().trim().optional().default(''),
  openingBalance: copAmountSchema,
  note: z.string().trim().max(150, 'La nota es demasiado larga.').optional().default(''),
})
