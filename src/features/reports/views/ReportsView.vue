<script setup lang="ts">
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Download,
  Lock,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { useUiStore } from '@/app/stores/ui.store'
import { listCustomers, type CustomerItem } from '@/features/customers/services/customers.service'
import WhatsAppReceiptDrawer from '@/features/ledger/components/WhatsAppReceiptDrawer.vue'
import {
  listStoreLedger,
  reconcileStorePortfolio,
  type LedgerEntryItem,
  type StorePortfolioReconciliationReport,
} from '@/features/ledger/services/ledger.service'
import {
  buildCustomersCsv,
  buildLedgerCsv,
  computeOverdueCustomers,
  computePeriodReport,
  downloadCsvFile,
  filterOverdueByTier,
  type OverdueCustomerItem,
  type OverdueTier,
} from '@/features/reports/services/reports.service'
import { buildBalanceReminderMessage } from '@/shared/lib/whatsapp'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import { formatCOP } from '@/shared/utils/cop'
import {
  getBogotaPeriodRange,
  toBogotaBusinessDate,
  type DashboardPeriod,
} from '@/shared/utils/datesCO'

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const uiStore = useUiStore()

type ReportPeriodOption = DashboardPeriod | 'custom'

const selectedPeriod = ref<ReportPeriodOption>('today')
const todayYmd = toBogotaBusinessDate()
const customFrom = ref(getBogotaPeriodRange('month').businessDateFrom)
const customTo = ref(todayYmd)
const selectedOverdueTier = ref<OverdueTier>('15+')
const exportNotice = ref<string | null>(null)
const loading = ref(false)

const customers = ref<CustomerItem[]>([])
const entries = ref<LedgerEntryItem[]>([])

// Vista previa de recordatorio WhatsApp
const waOpen = ref(false)
const waCustomer = ref<CustomerItem | null>(null)
const waMessage = ref('')

// ponytail: datos demostrativos deterministas cuando .env no tiene Firebase configurado
const DEMO_CUSTOMERS: CustomerItem[] = [
  {
    id: 'demo-c1',
    storeId: 'demo',
    fullName: 'Don Carlos Pérez',
    nickname: 'El del taller',
    phoneE164: '+573124567890',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: 200_000,
    currentBalance: 185_000,
    lastLedgerSeq: 2,
    lastCreditSaleAt: new Date(Date.now() - 34 * 86_400_000).toISOString(),
    lastPaymentAt: new Date(Date.now() - 34 * 86_400_000).toISOString(),
    lastActivityAt: new Date(Date.now() - 34 * 86_400_000).toISOString(),
    searchText: 'don carlos perez',
    createdBy: 'demo',
    createdAt: '2026-09-15T10:00:00.000Z',
  },
  {
    id: 'demo-c2',
    storeId: 'demo',
    fullName: 'Doña Marta Gómez',
    nickname: 'Casa reja verde',
    phoneE164: '+573105558899',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: 200_000,
    currentBalance: 128_500,
    lastLedgerSeq: 2,
    lastCreditSaleAt: new Date(Date.now() - 18 * 86_400_000).toISOString(),
    lastPaymentAt: new Date(Date.now() - 18 * 86_400_000).toISOString(),
    lastActivityAt: new Date(Date.now() - 18 * 86_400_000).toISOString(),
    searchText: 'dona marta gomez',
    createdBy: 'demo',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'demo-c3',
    storeId: 'demo',
    fullName: 'Luis Fernando Díaz',
    nickname: 'Taxista · 312···84',
    phoneE164: '+573120000084',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: 200_000,
    currentBalance: 92_000,
    lastLedgerSeq: 2,
    lastCreditSaleAt: new Date(Date.now() - 65 * 86_400_000).toISOString(),
    lastPaymentAt: new Date(Date.now() - 65 * 86_400_000).toISOString(),
    lastActivityAt: new Date(Date.now() - 65 * 86_400_000).toISOString(),
    searchText: 'luis fernando diaz',
    createdBy: 'demo',
    createdAt: '2026-08-20T10:00:00.000Z',
  },
]

const DEMO_ENTRIES: LedgerEntryItem[] = [
  {
    id: 'demo-r4',
    storeId: 'demo',
    customerId: 'demo-c1',
    customerName: 'Don Carlos Pérez',
    customerSeq: 1,
    entryType: 'opening_balance',
    signedAmount: 150_000,
    balanceBefore: 0,
    balanceAfter: 150_000,
    paymentMethod: null,
    note: 'Cuaderno azul pág. 14',
    reason: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-r4',
    payloadHash: 'hash-4',
    occurredAt: new Date().toISOString(),
    businessDate: todayYmd,
    createdBy: 'demo',
    createdByName: 'Propietario',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-r1',
    storeId: 'demo',
    customerId: 'demo-c1',
    customerName: 'Don Carlos Pérez',
    customerSeq: 2,
    entryType: 'credit_sale',
    signedAmount: 35_000,
    balanceBefore: 150_000,
    balanceAfter: 185_000,
    paymentMethod: null,
    note: 'Arroz, 6 huevos y aceite',
    reason: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-r1',
    payloadHash: 'hash-1',
    occurredAt: new Date().toISOString(),
    businessDate: todayYmd,
    createdBy: 'demo',
    createdByName: 'Propietario',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-r2-open',
    storeId: 'demo',
    customerId: 'demo-c2',
    customerName: 'Doña Marta Gómez',
    customerSeq: 1,
    entryType: 'opening_balance',
    signedAmount: 178_500,
    balanceBefore: 0,
    balanceAfter: 178_500,
    paymentMethod: null,
    note: 'Cuaderno pág. 8',
    reason: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-r2-open',
    payloadHash: 'hash-2o',
    occurredAt: '2026-10-01T10:00:00.000Z',
    businessDate: '2026-10-01',
    createdBy: 'demo',
    createdByName: 'Propietario',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'demo-r2',
    storeId: 'demo',
    customerId: 'demo-c2',
    customerName: 'Doña Marta Gómez',
    customerSeq: 2,
    entryType: 'payment',
    signedAmount: -50_000,
    balanceBefore: 178_500,
    balanceAfter: 128_500,
    paymentMethod: 'nequi',
    note: 'Abono por Nequi',
    reason: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-r2',
    payloadHash: 'hash-2',
    occurredAt: new Date().toISOString(),
    businessDate: todayYmd,
    createdBy: 'demo',
    createdByName: 'Propietario',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-r3-open',
    storeId: 'demo',
    customerId: 'demo-c3',
    customerName: 'Luis Fernando Díaz',
    customerSeq: 1,
    entryType: 'opening_balance',
    signedAmount: 132_000,
    balanceBefore: 0,
    balanceAfter: 132_000,
    paymentMethod: null,
    note: 'Cuaderno pág. 3',
    reason: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-r3-open',
    payloadHash: 'hash-3o',
    occurredAt: '2026-08-20T10:00:00.000Z',
    businessDate: '2026-08-20',
    createdBy: 'demo',
    createdByName: 'Propietario',
    createdAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'demo-r3',
    storeId: 'demo',
    customerId: 'demo-c3',
    customerName: 'Luis Fernando Díaz',
    customerSeq: 2,
    entryType: 'payment',
    signedAmount: -40_000,
    balanceBefore: 132_000,
    balanceAfter: 92_000,
    paymentMethod: 'cash',
    note: 'Abono en efectivo en mostrador',
    reason: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-r3',
    payloadHash: 'hash-3',
    occurredAt: new Date().toISOString(),
    businessDate: todayYmd,
    createdBy: 'demo',
    createdByName: 'Propietario',
    createdAt: new Date().toISOString(),
  },
]

const periodTabs: Array<{ id: ReportPeriodOption; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'custom', label: 'Rango' },
]

const overdueTabs: Array<{ id: OverdueTier; label: string }> = [
  { id: '15+', label: '+15 días' },
  { id: '30+', label: '+30 días' },
  { id: '60+', label: '+60 días' },
  { id: 'all', label: 'Todos con deuda' },
]

async function loadReportData() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    customers.value = DEMO_CUSTOMERS
    entries.value = DEMO_ENTRIES
    return
  }

  loading.value = true
  try {
    const [custList, ledgerList] = await Promise.all([
      listCustomers(storeId),
      listStoreLedger(storeId, 500),
    ])
    customers.value = custList
    entries.value = ledgerList
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenantEpoch, () => {
  void loadReportData()
})

onMounted(() => {
  void loadReportData()
})

const effectiveDateRange = computed(() => {
  if (selectedPeriod.value === 'custom') {
    const from = customFrom.value <= customTo.value ? customFrom.value : customTo.value
    const to = customFrom.value <= customTo.value ? customTo.value : customFrom.value
    return { businessDateFrom: from, businessDateTo: to }
  }
  const range = getBogotaPeriodRange(selectedPeriod.value)
  return {
    businessDateFrom: range.businessDateFrom,
    businessDateTo: range.businessDateTo,
  }
})

const periodReport = computed(() =>
  computePeriodReport(
    entries.value,
    effectiveDateRange.value.businessDateFrom,
    effectiveDateRange.value.businessDateTo,
  ),
)

const totalReceivable = computed(() =>
  customers.value.reduce((acc, c) => acc + Math.max(0, c.currentBalance), 0),
)

const debtorCount = computed(() =>
  customers.value.filter((c) => c.currentBalance > 0 && c.creditStatus !== 'archived').length,
)

const allOverdueItems = computed(() => computeOverdueCustomers(customers.value))
const overdue15Count = computed(() => allOverdueItems.value.filter((i) => i.daysWithoutPayment >= 15).length)

const visibleOverdueItems = computed(() =>
  filterOverdueByTier(allOverdueItems.value, selectedOverdueTier.value),
)

const effectiveRole = computed(() => {
  if (!authStore.backendReady) return tenantStore.activeRole ?? 'owner'
  return tenantStore.activeRole
})

const canExportCsv = computed(() => effectiveRole.value === 'owner')

function openReminderWhatsApp(item: OverdueCustomerItem) {
  const storeName = tenantStore.activeStore?.name ?? uiStore.activeStoreName
  const customTemplate = tenantStore.activeStore?.whatsappReminderTemplate ?? null
  waCustomer.value = item.customer
  waMessage.value = buildBalanceReminderMessage({
    storeName,
    customerName: item.customer.fullName,
    currentBalance: item.customer.currentBalance,
    customTemplate,
  })
  waOpen.value = true
}

function handleExportCustomersCsv() {
  exportNotice.value = null
  try {
    const csv = buildCustomersCsv(customers.value, effectiveRole.value)
    downloadCsvFile(`cuentia-cartera-${todayYmd}.csv`, csv)
    exportNotice.value = 'Archivo CSV de cartera descargado correctamente.'
  } catch (err) {
    exportNotice.value = err instanceof Error ? err.message : 'Solo el propietario puede exportar la base.'
  }
}

const reconciliationReport = ref<StorePortfolioReconciliationReport | null>(null)

function handleVerifyReconciliation() {
  reconciliationReport.value = reconcileStorePortfolio(customers.value, entries.value)
}

function handleExportLedgerCsv() {
  exportNotice.value = null
  try {
    const csv = buildLedgerCsv(entries.value, effectiveRole.value)
    downloadCsvFile(`cuentia-movimientos-${todayYmd}.csv`, csv)
    exportNotice.value = 'Archivo CSV de movimientos descargado correctamente.'
  } catch (err) {
    exportNotice.value = err instanceof Error ? err.message : 'Solo el propietario puede exportar movimientos.'
  }
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 lg:mt-0">
        <div class="flex items-center gap-2.5">
          <RouterLink
            to="/mas"
            class="inline-flex size-12 items-center justify-center rounded-xl border border-zocalo-border bg-zocalo-deep text-ground hover:bg-zocalo"
            aria-label="Volver a Más opciones"
          >
            <ArrowLeft class="size-5" :stroke-width="2.2" aria-hidden="true" />
          </RouterLink>
          <div>
            <h1 class="text-xl font-extrabold tracking-tight text-ground">
              Reportes y morosos
            </h1>
            <p class="text-xs font-medium text-zocalo-on-muted">
              Corte en hora de Bogotá (UTC-5) · Stock vs flujo del período
            </p>
          </div>
        </div>

        <div class="rounded-xl border border-zocalo-border bg-zocalo-deep px-3 py-2 text-right">
          <p class="text-xs font-bold text-zocalo-on-muted">
            Cartera total hoy (stock)
          </p>
          <p class="text-lg font-extrabold text-ground tabular-cop">
            {{ formatCOP(totalReceivable) }}
          </p>
          <p class="text-xs font-medium text-zocalo-on-muted tabular-cop">
            {{ debtorCount }} con deuda · {{ overdue15Count }} en mora (+15d)
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <!-- Selector de período -->
      <section aria-labelledby="report-period-heading" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="report-period-heading" class="text-sm font-extrabold text-ink">
            Flujo del período ({{ effectiveDateRange.businessDateFrom }} a {{ effectiveDateRange.businessDateTo }})
          </h2>

          <div role="tablist" aria-label="Período del reporte" class="flex flex-wrap gap-1.5">
            <button
              v-for="tab in periodTabs"
              :key="tab.id"
              role="tab"
              type="button"
              :aria-selected="selectedPeriod === tab.id"
              :class="[
                'min-h-12 rounded-xl border px-3 text-xs font-bold cursor-pointer',
                selectedPeriod === tab.id
                  ? 'border-zocalo bg-zocalo text-ground'
                  : 'border-border-strong bg-surface text-ink hover:bg-surface-muted',
              ]"
              @click="selectedPeriod = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div v-if="selectedPeriod === 'custom'" class="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-3.5">
          <div>
            <label for="report-date-from" class="block text-xs font-bold text-ink">Desde (Bogotá)</label>
            <input
              id="report-date-from"
              v-model="customFrom"
              type="date"
              class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-semibold text-ink tabular-cop"
            />
          </div>
          <div>
            <label for="report-date-to" class="block text-xs font-bold text-ink">Hasta (Bogotá)</label>
            <input
              id="report-date-to"
              v-model="customTo"
              type="date"
              class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-semibold text-ink tabular-cop"
            />
          </div>
        </div>

        <!-- Tarjetas gemelas de flujo: Fiado vs Abonos recaudados -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-border bg-surface p-4">
            <div class="flex items-center gap-1.5 text-xs font-bold text-fiado">
              <ArrowUpRight class="size-4 shrink-0" :stroke-width="2.4" aria-hidden="true" />
              <span>Fiado en el período</span>
            </div>
            <p class="mt-1 text-3xl font-extrabold tracking-tight text-ink tabular-cop">
              {{ formatCOP(periodReport.creditSalesTotal) }}
            </p>
            <p class="mt-1 text-xs text-ink-subtle tabular-cop">
              {{ periodReport.creditSalesCount }} compras fiadas nuevas (sin contar saldos migrados del cuaderno)
            </p>
          </div>

          <div class="rounded-xl border border-border bg-surface p-4">
            <div class="flex items-center gap-1.5 text-xs font-bold text-abono">
              <ArrowDownLeft class="size-4 shrink-0" :stroke-width="2.4" aria-hidden="true" />
              <span>Abonos recaudados</span>
            </div>
            <p class="mt-1 text-3xl font-extrabold tracking-tight text-ink tabular-cop">
              {{ formatCOP(periodReport.paymentsTotal) }}
            </p>
            <p class="mt-1 text-xs text-ink-subtle tabular-cop">
              {{ periodReport.paymentsCount }} pagos recibidos · Plata que entró al cajón o celular (no es ganancia)
            </p>
          </div>
        </div>

        <!-- Separación contable explícita de saldos de cuaderno y ajustes -->
        <div class="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs text-ink-muted sm:grid-cols-2">
          <div class="flex items-center justify-between gap-2">
            <span>Saldos migrados del cuaderno ({{ periodReport.openingBalanceCount }}):</span>
            <strong class="font-extrabold text-ink tabular-cop">{{ formatCOP(periodReport.openingBalanceTotal) }}</strong>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Ajustes / descuentos gerenciales ({{ periodReport.adjustmentsCount }}):</span>
            <strong class="font-extrabold text-ink tabular-cop">{{ formatCOP(periodReport.adjustmentsNet) }}</strong>
          </div>
        </div>
      </section>

      <!-- Desglose de abonos por método de pago (para cuadrar cajón vs Nequi/Daviplata) -->
      <section aria-labelledby="payment-breakdown-heading" class="rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Wallet class="size-5 text-abono" :stroke-width="2" aria-hidden="true" />
            <h2 id="payment-breakdown-heading" class="text-sm font-extrabold text-ink">
              Cuadre de abonos por medio de pago
            </h2>
          </div>
          <span class="text-xs font-bold text-ink-muted tabular-cop">
            Total recaudado: {{ formatCOP(periodReport.paymentsTotal) }}
          </span>
        </div>

        <ul class="mt-3.5 space-y-3">
          <li
            v-for="item in periodReport.byPaymentMethod"
            :key="item.method"
            class="space-y-1"
          >
            <div class="flex items-baseline justify-between gap-2 text-xs">
              <span class="font-bold text-ink">
                {{ item.label }}
                <span class="font-normal text-ink-subtle tabular-cop">({{ item.count }} abonos)</span>
              </span>
              <span class="font-extrabold text-ink tabular-cop">
                {{ formatCOP(item.amount) }}
                <span class="ml-1 font-semibold text-ink-subtle">({{ item.sharePercent }}%)</span>
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-sm bg-surface-muted" aria-hidden="true">
              <div
                class="h-full bg-abono"
                :style="{ width: `${item.sharePercent}%` }"
              />
            </div>
          </li>
        </ul>
      </section>

      <!-- Listado de clientes morosos (+15d, +30d, +60d) -->
      <section aria-labelledby="overdue-heading" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="overdue-heading" class="text-sm font-extrabold text-ink">
            Cartera atrasada y recordatorios por WhatsApp
          </h2>

          <div role="tablist" aria-label="Tramo de mora" class="flex flex-wrap gap-1.5">
            <button
              v-for="t in overdueTabs"
              :key="t.id"
              role="tab"
              type="button"
              :aria-selected="selectedOverdueTier === t.id"
              :class="[
                'min-h-12 rounded-xl border px-3 text-xs font-bold cursor-pointer',
                selectedOverdueTier === t.id
                  ? 'border-fiado bg-fiado-soft text-fiado'
                  : 'border-border-strong bg-surface text-ink hover:bg-surface-muted',
              ]"
              @click="selectedOverdueTier = t.id"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <div
          v-if="visibleOverdueItems.length === 0"
          class="rounded-xl border border-border bg-surface p-5 text-center text-sm text-ink-muted"
        >
          No hay clientes en el tramo <strong>{{ selectedOverdueTier }}</strong>. ¡Tu cartera está al día en este corte!
        </div>

        <ul v-else class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          <li
            v-for="item in visibleOverdueItems"
            :key="item.customer.id"
            class="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-extrabold text-ink-muted tabular-cop">
                  {{ item.seqLabel }}
                </span>
                <RouterLink
                  :to="`/clientes/${item.customer.id}`"
                  class="truncate text-sm font-bold text-ink hover:underline"
                >
                  {{ item.customer.fullName }}
                </RouterLink>
                <UiBadge :tone="item.daysWithoutPayment >= 30 ? 'danger' : item.daysWithoutPayment >= 15 ? 'fiado' : 'neutral'">
                  {{ item.daysWithoutPayment }}d sin abono
                </UiBadge>
              </div>
              <p class="mt-0.5 text-xs text-ink-muted">
                {{ item.customer.nickname || item.customer.phoneE164?.replace(/^\+57/, '') || 'Sin referencia' }}
              </p>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
              <p class="text-base font-extrabold text-ink tabular-cop">
                {{ formatCOP(item.customer.currentBalance) }}
              </p>

              <UiButton
                variant="secondary"
                size="md"
                @click="openReminderWhatsApp(item)"
              >
                <MessageCircle class="size-4 text-abono" :stroke-width="2.2" aria-hidden="true" />
                <span>Recordar por WhatsApp</span>
              </UiButton>

              <RouterLink
                :to="`/clientes/${item.customer.id}`"
                class="inline-flex size-12 items-center justify-center rounded-xl border border-border-strong bg-surface text-ink hover:bg-surface-muted"
                :aria-label="`Ver perfil de ${item.customer.fullName}`"
              >
                <ChevronRight class="size-5" :stroke-width="2" aria-hidden="true" />
              </RouterLink>
            </div>
          </li>
        </ul>
      </section>

      <!-- Exportación CSV controlada por rol (solo propietario) -->
      <section aria-labelledby="csv-export-heading" class="rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="csv-export-heading" class="text-sm font-extrabold text-ink">
              Respaldo y exportación en Excel (CSV)
            </h2>
            <p class="mt-0.5 text-xs text-ink-muted">
              Tus datos son tuyos siempre. Descarga la cartera completa o los movimientos con formato compatible con Excel en Colombia.
            </p>
          </div>
          <UiBadge :tone="canExportCsv ? 'abono' : 'neutral'">
            {{ canExportCsv ? 'Propietario autorizado' : 'Solo propietario' }}
          </UiBadge>
        </div>

        <div v-if="exportNotice" role="status" class="mt-3 rounded-xl border border-border bg-surface-muted p-3 text-xs font-bold text-ink">
          {{ exportNotice }}
        </div>

        <div v-if="canExportCsv" class="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <UiButton variant="secondary" size="md" block @click="handleExportCustomersCsv">
            <Download class="size-4" :stroke-width="2.2" aria-hidden="true" />
            <span>Exportar cartera CSV</span>
          </UiButton>
          <UiButton variant="secondary" size="md" block @click="handleExportLedgerCsv">
            <Download class="size-4" :stroke-width="2.2" aria-hidden="true" />
            <span>Exportar movimientos CSV</span>
          </UiButton>
        </div>
        <div v-else class="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs text-ink-muted">
          <Lock class="size-4 shrink-0 text-ink-subtle" :stroke-width="2" aria-hidden="true" />
          <span>Por seguridad de la tienda, solo el propietario (`owner`) puede descargar la base completa de clientes en CSV.</span>
        </div>
      </section>

      <!-- Verificación de integridad contable y 4 invariantes del libro mayor (Fase 7) -->
      <section aria-labelledby="reconcile-heading" class="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="flex items-center gap-2">
            <ShieldCheck class="size-5 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <h2 id="reconcile-heading" class="text-sm font-extrabold text-ink">
              Verificación de integridad contable (Conciliación)
            </h2>
          </div>
          <UiBadge v-if="reconciliationReport" :tone="reconciliationReport.ok ? 'abono' : 'danger'">
            {{ reconciliationReport.ok ? '0 discrepancias · OK' : 'Discrepancia detectada' }}
          </UiBadge>
        </div>

        <p class="text-xs text-ink-muted">
          Audita en vivo las 4 invariantes del libro mayor: suma exacta de saldos por cliente, continuidad de secuencia <code>#seq</code>, cadena <code>balanceAfter</code> y paridad de anulaciones.
        </p>

        <div
          v-if="reconciliationReport"
          role="status"
          :class="[
            'rounded-xl border p-3 text-xs font-bold tabular-cop',
            reconciliationReport.ok
              ? 'border-abono bg-abono-soft text-abono'
              : 'border-danger bg-danger-soft text-danger',
          ]"
        >
          {{
            reconciliationReport.ok
              ? `Conciliación verificada: ${reconciliationReport.checkedCustomers} clientes y ${reconciliationReport.checkedEntries} asientos auditados con 0 discrepancias. Total por cobrar: ${formatCOP(reconciliationReport.totalReceivable)}.`
              : `Se detectaron ${reconciliationReport.discrepancies.length} clientes con diferencias en la auditoría.`
          }}
        </div>

        <UiButton variant="secondary" size="md" block @click="handleVerifyReconciliation">
          <ShieldCheck class="size-4" :stroke-width="2.2" aria-hidden="true" />
          <span>Verificar conciliación del libro mayor</span>
        </UiButton>
      </section>
    </div>

    <WhatsAppReceiptDrawer
      :open="waOpen"
      title="Recordatorio de saldo por WhatsApp"
      :phone-e164="waCustomer?.phoneE164 ?? null"
      :whatsapp-opt-out="waCustomer?.whatsappOptOut ?? false"
      :initial-message="waMessage"
      is-collection-reminder
      :receipt-image-payload="null"
      @update:open="waOpen = $event"
    />
  </AppShellLayout>
</template>
