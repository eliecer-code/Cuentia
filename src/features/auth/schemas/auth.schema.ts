import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre completo (mínimo 2 letras).')
    .max(100, 'El nombre es demasiado largo.'),
  email: z.string().trim().email('Ingresa un correo electrónico válido.'),
  password: z
    .string()
    .min(10, 'Usa una contraseña segura de al menos 10 caracteres.')
    .max(128, 'La contraseña es demasiado larga.'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Ingresa un correo electrónico válido.'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
