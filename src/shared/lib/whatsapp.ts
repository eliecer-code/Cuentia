import type { PaymentMethodType } from '@/shared/types/domain.types'
import { formatCOP } from '@/shared/utils/cop'
import { formatBogotaDateTime, isWithinColombianCollectionHours } from '@/shared/utils/datesCO'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bank_transfer: 'Transferencia',
  other: 'Otro',
}

export function buildWhatsAppUrl(phoneE164: string | null, message: string): string {
  const encoded = encodeURIComponent(message)
  if (!phoneE164) {
    return `https://wa.me/?text=${encoded}`
  }
  const digits = phoneE164.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encoded}`
}

export function buildPaymentReceiptMessage(params: {
  storeName: string
  customerName: string
  amount: number
  paymentMethod: PaymentMethodType
  balanceAfter: number
  occurredAt: string | Date
  seqLabel?: string
}): string {
  const dateStr = formatBogotaDateTime(params.occurredAt)
  const methodLabel = PAYMENT_METHOD_LABELS[params.paymentMethod]
  const seqText = params.seqLabel ? ` (${params.seqLabel})` : ''

  if (params.balanceAfter === 0) {
    return [
      `Hola ${params.customerName}, muchas gracias por su pago en *${params.storeName}*`,
      '',
      `• Abono recibido: *${formatCOP(params.amount)}* (${methodLabel})${seqText}`,
      `• Fecha: ${dateStr}`,
      `• Estado actual: *¡Al día / Paz y salvo ($ 0)!*`,
      '',
      '¡Gracias por comprar siempre en nuestra tienda!',
    ].join('\n')
  }

  return [
    `Hola ${params.customerName}, muchas gracias por su abono en *${params.storeName}*`,
    '',
    `• Abono recibido: *${formatCOP(params.amount)}* (${methodLabel})${seqText}`,
    `• Fecha: ${dateStr}`,
    `• Saldo pendiente: *${formatCOP(params.balanceAfter)}*`,
    '',
    '¡Gracias por su confianza!',
  ].join('\n')
}

export function buildCreditSaleMessage(params: {
  storeName: string
  customerName: string
  amount: number
  balanceAfter: number
  note?: string | null
  occurredAt: string | Date
  seqLabel?: string
}): string {
  const dateStr = formatBogotaDateTime(params.occurredAt)
  const lines = [
    `Hola ${params.customerName}, le compartimos el registro de su compra en *${params.storeName}*`,
    '',
    `• Compra fiada: *${formatCOP(params.amount)}*${params.seqLabel ? ` (${params.seqLabel})` : ''}`,
  ]
  if (params.note) lines.push(`• Detalle: ${params.note}`)
  lines.push(`• Fecha: ${dateStr}`)
  lines.push(`• Saldo actualizado: *${formatCOP(params.balanceAfter)}*`)
  lines.push('', '¡Muchas gracias!')
  return lines.join('\n')
}

export const DEFAULT_WHATSAPP_REMINDER_TEMPLATE =
  'Hola {cliente}, ¿cómo está? Le saludamos de *{tienda}*.\n\nLe compartimos el resumen actualizado de su cuenta:\n• Saldo pendiente: *{saldo}*\n\nCuando pueda pasar o abonar por Nequi/Daviplata, con mucho gusto le atendemos. ¡Feliz día!'

export function buildBalanceReminderMessage(params: {
  storeName: string
  customerName: string
  currentBalance: number
  customTemplate?: string | null
}): string {
  const tpl = params.customTemplate?.trim()
  if (tpl) {
    return tpl
      .replaceAll('{cliente}', params.customerName)
      .replaceAll('{tienda}', params.storeName)
      .replaceAll('{saldo}', formatCOP(params.currentBalance))
  }
  return [
    `Hola ${params.customerName}, ¿cómo está? Le saludamos de *${params.storeName}*`,
    '',
    'Le compartimos el resumen actualizado de su cuenta:',
    `• Saldo pendiente: *${formatCOP(params.currentBalance)}*`,
    '',
    'Cuando pueda pasar o abonar por Nequi/Daviplata, con mucho gusto le atendemos. ¡Feliz día!',
  ].join('\n')
}

export function shouldShowCollectionHoursWarning(now: Date = new Date()): boolean {
  return !isWithinColombianCollectionHours(now)
}

/**
 * Genera una imagen PNG limpia estilo tirilla de mostrador usando Canvas HTML5 nativo (sin dependencias).
 */
export async function renderReceiptPngBlob(params: {
  storeName: string
  customerName: string
  title: string
  amountLabel: string
  subtitle: string
  balanceAfter: number
  dateLabel: string
  seqLabel?: string
}): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 520
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Fondo cal mate
  ctx.fillStyle = '#FAF9F6'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Banda superior Zócalo verde esmalte
  ctx.fillStyle = '#145343'
  ctx.fillRect(0, 0, canvas.width, 130)
  ctx.fillStyle = '#0E3B30'
  ctx.fillRect(0, 124, canvas.width, 6)

  ctx.fillStyle = '#CBEAD9'
  ctx.font = 'bold 20px "Public Sans", system-ui, sans-serif'
  ctx.fillText('COMPROBANTE DE CUENTA · CUENTIA', 40, 48)

  ctx.fillStyle = '#FAF9F6'
  ctx.font = '800 32px "Public Sans", system-ui, sans-serif'
  ctx.fillText(params.storeName.slice(0, 34), 40, 96)

  // Tarjeta blanca plana
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = '#E2DFD5'
  ctx.lineWidth = 2
  ctx.fillRect(40, 162, 640, 318)
  ctx.strokeRect(40, 162, 640, 318)

  ctx.fillStyle = '#4A5954'
  ctx.font = 'bold 20px "Public Sans", system-ui, sans-serif'
  ctx.fillText(`${params.title}${params.seqLabel ? ` · ${params.seqLabel}` : ''}`, 72, 210)

  ctx.fillStyle = '#18211E'
  ctx.font = '800 54px "Public Sans", system-ui, sans-serif'
  ctx.fillText(params.amountLabel, 72, 276)

  ctx.fillStyle = '#4A5954'
  ctx.font = '600 22px "Public Sans", system-ui, sans-serif'
  ctx.fillText(`Cliente: ${params.customerName.slice(0, 36)}`, 72, 330)
  ctx.fillText(params.subtitle.slice(0, 48), 72, 366)
  ctx.fillText(`Fecha: ${params.dateLabel}`, 72, 402)

  ctx.fillStyle = params.balanceAfter === 0 ? '#157A4A' : '#18211E'
  ctx.font = '800 24px "Public Sans", system-ui, sans-serif'
  ctx.fillText(
    params.balanceAfter === 0 ? 'Estado: ¡Paz y salvo ($ 0)!' : `Nuevo saldo: ${formatCOP(params.balanceAfter)}`,
    72,
    450,
  )

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
