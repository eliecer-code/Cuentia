import type { CustomerItem } from '@/features/customers/services/customers.service'
import type { LedgerEntryItem } from '@/features/ledger/services/ledger.service'
import { normalizeError } from '@/shared/lib/errors'
import { PAYMENT_METHOD_LABELS } from '@/shared/lib/whatsapp'
import type { PaymentMethodType, StoreRole } from '@/shared/types/domain.types'
import { daysSinceBogotaDate, formatBogotaDateTime } from '@/shared/utils/datesCO'

export type OverdueTier = 'all' | '15+' | '30+' | '60+'

export interface PaymentMethodBreakdownItem {
  method: PaymentMethodType
  label: string
  amount: number
  count: number
  sharePercent: number
}

export interface PeriodReportSummary {
  businessDateFrom: string
  businessDateTo: string
  creditSalesTotal: number
  creditSalesCount: number
  paymentsTotal: number
  paymentsCount: number
  openingBalanceTotal: number
  openingBalanceCount: number
  adjustmentsNet: number
  adjustmentsCount: number
  reversalsCount: number
  netPortfolioDelta: number
  byPaymentMethod: PaymentMethodBreakdownItem[]
}

export interface OverdueCustomerItem {
  customer: CustomerItem
  daysWithoutPayment: number
  tier: 'recent' | '15+' | '30+' | '60+'
  seqLabel: string
}

const ORDERED_METHODS: PaymentMethodType[] = ['cash', 'nequi', 'daviplata', 'bank_transfer', 'other']

/**
 * Calcula el reporte de flujo del período en fechas comerciales de Colombia (`YYYY-MM-DD`).
 * Reglas contables críticas (`BR-04`, `BR-09`):
 * - `opening_balance` (saldos migrados de cuaderno) NUNCA se suma a `creditSalesTotal` ("Fiado del período").
 * - `adjustment` (descuentos/ajustes) NUNCA se suma a `paymentsTotal` ("Abonos recaudados").
 * - Los asientos anulados (`isReversed === true`) no inflan el flujo ni el cuadre de caja.
 */
export function computePeriodReport(
  entries: LedgerEntryItem[],
  businessDateFrom: string,
  businessDateTo: string,
): PeriodReportSummary {
  let creditSalesTotal = 0
  let creditSalesCount = 0
  let paymentsTotal = 0
  let paymentsCount = 0
  let openingBalanceTotal = 0
  let openingBalanceCount = 0
  let adjustmentsNet = 0
  let adjustmentsCount = 0
  let reversalsCount = 0

  const methodTotals: Record<PaymentMethodType, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    nequi: { amount: 0, count: 0 },
    daviplata: { amount: 0, count: 0 },
    bank_transfer: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  }

  for (const entry of entries) {
    if (entry.businessDate < businessDateFrom || entry.businessDate > businessDateTo) {
      continue
    }

    if (entry.entryType === 'reversal') {
      reversalsCount += 1
      continue
    }

    if (entry.reversedByEntryId !== null) {
      continue
    }

    if (entry.entryType === 'credit_sale') {
      const amount = Math.abs(entry.signedAmount)
      creditSalesTotal += amount
      creditSalesCount += 1
    } else if (entry.entryType === 'payment') {
      const amount = Math.abs(entry.signedAmount)
      paymentsTotal += amount
      paymentsCount += 1
      const method: PaymentMethodType = entry.paymentMethod ?? 'cash'
      methodTotals[method].amount += amount
      methodTotals[method].count += 1
    } else if (entry.entryType === 'opening_balance') {
      openingBalanceTotal += entry.signedAmount
      openingBalanceCount += 1
    } else if (entry.entryType === 'adjustment') {
      adjustmentsNet += entry.signedAmount
      adjustmentsCount += 1
    }
  }

  const byPaymentMethod: PaymentMethodBreakdownItem[] = ORDERED_METHODS.map((method) => {
    const { amount, count } = methodTotals[method]
    const sharePercent = paymentsTotal > 0 ? Math.round((amount / paymentsTotal) * 100) : 0
    return {
      method,
      label: PAYMENT_METHOD_LABELS[method],
      amount,
      count,
      sharePercent,
    }
  })

  return {
    businessDateFrom,
    businessDateTo,
    creditSalesTotal,
    creditSalesCount,
    paymentsTotal,
    paymentsCount,
    openingBalanceTotal,
    openingBalanceCount,
    adjustmentsNet,
    adjustmentsCount,
    reversalsCount,
    netPortfolioDelta: creditSalesTotal - paymentsTotal + adjustmentsNet,
    byPaymentMethod,
  }
}

/**
 * Clasifica los clientes con saldo pendiente (`currentBalance > 0`) por antigüedad sin abono en hora Bogotá.
 */
export function computeOverdueCustomers(
  customers: CustomerItem[],
  now: Date = new Date(),
): OverdueCustomerItem[] {
  return customers
    .filter((c) => c.currentBalance > 0 && c.creditStatus !== 'archived')
    .map((customer, idx) => {
      const referenceIso =
        customer.lastPaymentAt ??
        customer.lastCreditSaleAt ??
        customer.lastActivityAt ??
        customer.createdAt
      const days = daysSinceBogotaDate(referenceIso, now)
      const tier: OverdueCustomerItem['tier'] =
        days >= 60 ? '60+' : days >= 30 ? '30+' : days >= 15 ? '15+' : 'recent'

      return {
        customer,
        daysWithoutPayment: days,
        tier,
        seqLabel: `#${String(customer.lastLedgerSeq || idx + 1).padStart(3, '0')}`,
      }
    })
    .sort((a, b) => {
      if (b.daysWithoutPayment !== a.daysWithoutPayment) {
        return b.daysWithoutPayment - a.daysWithoutPayment
      }
      return b.customer.currentBalance - a.customer.currentBalance
    })
}

export function filterOverdueByTier(items: OverdueCustomerItem[], tier: OverdueTier): OverdueCustomerItem[] {
  if (tier === 'all') return items
  if (tier === '15+') return items.filter((i) => i.daysWithoutPayment >= 15)
  if (tier === '30+') return items.filter((i) => i.daysWithoutPayment >= 30)
  return items.filter((i) => i.daysWithoutPayment >= 60)
}

/**
 * Escapa celdas CSV y protege contra CSV Formula Injection (`=`, `+`, `-`, `@`).
 */
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  let str = String(value)
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`
  }
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

export function buildCustomersCsv(
  customers: CustomerItem[],
  actorRole: StoreRole | null,
  now: Date = new Date(),
): string {
  if (actorRole !== 'owner') {
    throw normalizeError({ code: 'CU_FORBIDDEN' })
  }

  const header = [
    'Folio',
    'Nombre completo',
    'Apodo o referencia',
    'WhatsApp',
    'Estado',
    'Saldo pendiente COP',
    'Tope de fiado COP',
    'Dias sin abono',
  ].join(',')

  const rows = customers
    .filter((c) => c.creditStatus !== 'archived')
    .sort((a, b) => b.currentBalance - a.currentBalance)
    .map((c, idx) => {
      const refIso = c.lastPaymentAt ?? c.lastCreditSaleAt ?? c.lastActivityAt ?? c.createdAt
      const days = c.currentBalance > 0 ? daysSinceBogotaDate(refIso, now) : 0
      const seq = `#${String(c.lastLedgerSeq || idx + 1).padStart(3, '0')}`
      return [
        escapeCsvCell(seq),
        escapeCsvCell(c.fullName),
        escapeCsvCell(c.nickname ?? ''),
        escapeCsvCell(c.phoneE164 ?? ''),
        escapeCsvCell(c.creditStatus === 'frozen' ? 'Bloqueado' : 'Activo'),
        String(c.currentBalance),
        c.creditLimit !== null ? String(c.creditLimit) : '""',
        String(days),
      ].join(',')
    })

  return `\uFEFF${[header, ...rows].join('\r\n')}`
}

export function buildLedgerCsv(
  entries: LedgerEntryItem[],
  actorRole: StoreRole | null,
): string {
  if (actorRole !== 'owner') {
    throw normalizeError({ code: 'CU_FORBIDDEN' })
  }

  const typeLabels: Record<LedgerEntryItem['entryType'], string> = {
    credit_sale: 'Fiado',
    payment: 'Abono',
    opening_balance: 'Saldo cuaderno',
    adjustment: 'Ajuste',
    reversal: 'Anulacion',
  }

  const header = [
    'Folio',
    'Fecha comercial Bogota',
    'Hora Bogota',
    'Cliente',
    'Tipo',
    'Metodo de pago',
    'Monto con signo COP',
    'Saldo resultante COP',
    'Estado',
    'Detalle',
  ].join(',')

  const rows = entries.map((e) => [
    escapeCsvCell(`#${String(e.customerSeq).padStart(3, '0')}`),
    escapeCsvCell(e.businessDate),
    escapeCsvCell(formatBogotaDateTime(e.occurredAt)),
    escapeCsvCell(e.customerName ?? e.customerId),
    escapeCsvCell(typeLabels[e.entryType]),
    escapeCsvCell(e.paymentMethod ? PAYMENT_METHOD_LABELS[e.paymentMethod] : ''),
    String(e.signedAmount),
    String(e.balanceAfter),
    escapeCsvCell(e.reversedByEntryId !== null ? 'Anulado' : 'Vigente'),
    escapeCsvCell(e.note ?? ''),
  ].join(','))

  return `\uFEFF${[header, ...rows].join('\r\n')}`
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
