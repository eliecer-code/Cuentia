import { z } from 'zod'

export const createInvitationSchema = z.object({
  email: z.string().trim().email('Ingresa el correo válido del colaborador.'),
  role: z.enum(['admin', 'employee'], {
    errorMap: () => ({ message: 'Selecciona un rol válido (Administrador o Empleado).' }),
  }),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
