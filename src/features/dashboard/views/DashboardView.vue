<script setup lang="ts">
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Plus,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { useUiStore } from '@/app/stores/ui.store'
import { listCustomers, type CustomerItem } from '@/features/customers/services/customers.service'
import LedgerActionDrawer, { type LedgerDrawerMode } from '@/features/ledger/components/LedgerActionDrawer.vue'
import WhatsAppReceiptDrawer from '@/features/ledger/components/WhatsAppReceiptDrawer.vue'
import { listStoreLedger, type LedgerEntryItem } from '@/features/ledger/services/ledger.service'
import { computePeriodReport } from '@/features/reports/services/reports.service'
import { useOnlineStatus } from '@/shared/composables/useOnlineStatus'
import {
  buildCreditSaleMessage,
  buildPaymentReceiptMessage,
  PAYMENT_METHOD_LABELS,
} from '@/shared/lib/whatsapp'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import { formatCOP } from '@/shared/utils/cop'
import {
  daysSinceBogotaDate,
  formatBogotaDateTime,
  getBogotaPeriodRange,
  type DashboardPeriod,
} from '@/shared/utils/datesCO'

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const uiStore = useUiStore()
const { isOnline } = useOnlineStatus()

const customers = ref<CustomerItem[]>([])
const ledgerEntries = ref<LedgerEntryItem[]>([])
const waOpen = ref(false)
const waConfig = ref<{
  title: string
  phoneE164: string | null
  message: string
  receiptPayload: {
    storeName: string
    customerName: string
    title: string
    amountLabel: string
    subtitle: string
    balanceAfter: number
    dateLabel: string
    seqLabel?: string
  } | null
}>({
  title: 'Comprobante WhatsApp',
  phoneE164: null,
  message: '',
  receiptPayload: null,
})

// ponytail: datos demostrativos locales cuando .env no tiene Firebase configurado;
// en Fase 5 se reemplazan las agregaciones de flujo por el reporte completo del período.
const DEMO_CUSTOMERS: CustomerItem[] = [
  {
    id: 'c1',
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
    lastLedgerSeq: 42,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'don carlos perez',
    createdBy: 'demo',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'c2',
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
    lastLedgerSeq: 39,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'dona marta gomez',
    createdBy: 'demo',
    createdAt: '2026-11-02T10:00:00.000Z',
  },
  {
    id: 'c3',
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
    lastLedgerSeq: 31,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'luis fernando diaz',
    createdBy: 'demo',
    createdAt: '2026-11-03T10:00:00.000Z',
  },
]

const DEMO_FLOWS: Record<'today' | 'week' | 'month', { creditSales: number; creditCount: number; payments: number; paymentCount: number; label: string }> = {
  today: { creditSales: 125_000, creditCount: 7, payments: 90_000, paymentCount: 5, label: 'hoy' },
  week: { creditSales: 642_000, creditCount: 34, payments: 515_000, paymentCount: 21, label: 'esta semana' },
  month: { creditSales: 2_310_000, creditCount: 129, payments: 1_980_000, paymentCount: 84, label: 'este mes' },
}

const periods: Array<{ id: Extract<DashboardPeriod, 'today' | 'week' | 'month'>; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

async function loadDashboardData() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    customers.value = DEMO_CUSTOMERS
    ledgerEntries.value = []
    return
  }
  try {
    const [custList, entriesList] = await Promise.all([
      listCustomers(storeId),
      listStoreLedger(storeId, 300),
    ])
    customers.value = custList
    ledgerEntries.value = entriesList
  } catch {
    customers.value = []
    ledgerEntries.value = []
  }
}

watch(() => tenantStore.tenantEpoch, () => {
  void loadDashboardData()
})

onMounted(() => {
  void loadDashboardData()
})

const totalReceivable = computed(() => {
  if (!authStore.backendReady) return 1_845_000
  return customers.value.reduce((acc, c) => acc + Math.max(0, c.currentBalance), 0)
})

const debtorCount = computed(() => {
  if (!authStore.backendReady) return 18
  return customers.value.filter((c) => c.currentBalance > 0).length
})

const topDebtors = computed(() => {
  const withDebt = customers.value
    .filter((c) => c.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance)
    .slice(0, 3)

  return withDebt.map((c, idx) => {
    const refIso = c.lastPaymentAt ?? c.lastCreditSaleAt ?? c.lastActivityAt ?? c.createdAt
    return {
      id: c.id,
      seq: `#${String(c.lastLedgerSeq || idx + 1).padStart(3, '0')}`,
      name: c.fullName,
      ref: c.nickname || c.phoneE164?.replace(/^\+57/, '') || 'Sin referencia',
      balance: c.currentBalance,
      maxRef: c.creditLimit ?? Math.max(200_000, c.currentBalance),
      daysWithoutPayment: !authStore.backendReady ? ([28, 4, 19][idx] ?? 0) : daysSinceBogotaDate(refIso),
    }
  })
})

const activePeriod = computed(() =>
  uiStore.selectedPeriod === 'yesterday' ? 'today' : uiStore.selectedPeriod,
)

const activeFlow = computed(() => {
  const labelMap: Record<'today' | 'week' | 'month', string> = {
    today: 'hoy',
    week: 'esta semana',
    month: 'este mes',
  }
  if (!authStore.backendReady) {
    return DEMO_FLOWS[activePeriod.value]
  }
  const range = getBogotaPeriodRange(activePeriod.value)
  const report = computePeriodReport(ledgerEntries.value, range.businessDateFrom, range.businessDateTo)
  return {
    creditSales: report.creditSalesTotal,
    creditCount: report.creditSalesCount,
    payments: report.paymentsTotal,
    paymentCount: report.paymentsCount,
    label: labelMap[activePeriod.value],
  }
})

const drawerMode = computed<LedgerDrawerMode>(() =>
  uiStore.quickActionSheet === 'abono' ? 'payment' : 'credit_sale',
)

function handleLedgerCompleted(payload: { entry: LedgerEntryItem; newBalance: number; customer: CustomerItem }) {
  customers.value = customers.value.map((c) =>
    c.id === payload.customer.id
      ? { ...c, currentBalance: payload.newBalance, lastLedgerSeq: payload.entry.customerSeq }
      : c,
  )
  ledgerEntries.value = [payload.entry, ...ledgerEntries.value]
}

function openWhatsAppFromDrawer(entry: LedgerEntryItem, cust: CustomerItem) {
  const storeName = tenantStore.activeStore?.name ?? uiStore.activeStoreName
  const seqLabel = `#${String(entry.customerSeq).padStart(3, '0')}`
  const isPayment = entry.entryType === 'payment'

  waConfig.value = {
    title: isPayment ? 'Comprobante de abono' : 'Comprobante de fiado',
    phoneE164: cust.phoneE164,
    message: isPayment
      ? buildPaymentReceiptMessage({
          storeName,
          customerName: cust.fullName,
          amount: Math.abs(entry.signedAmount),
          paymentMethod: entry.paymentMethod ?? 'cash',
          balanceAfter: entry.balanceAfter,
          occurredAt: entry.occurredAt,
          seqLabel,
        })
      : buildCreditSaleMessage({
          storeName,
          customerName: cust.fullName,
          amount: Math.abs(entry.signedAmount),
          balanceAfter: entry.balanceAfter,
          note: entry.note,
          occurredAt: entry.occurredAt,
          seqLabel,
        }),
    receiptPayload: {
      storeName,
      customerName: cust.fullName,
      title: isPayment ? 'ABONO RECIBIDO' : 'COMPRA FIADA',
      amountLabel: formatCOP(Math.abs(entry.signedAmount)),
      subtitle: isPayment ? `Método: ${PAYMENT_METHOD_LABELS[entry.paymentMethod ?? 'cash']}` : entry.note || 'Compra fiada',
      balanceAfter: entry.balanceAfter,
      dateLabel: formatBogotaDateTime(entry.occurredAt),
      seqLabel,
    },
  }
  uiStore.closeQuickAction()
  waOpen.value = true
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 lg:mt-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h1 class="text-xs font-extrabold uppercase tracking-wider text-zocalo-on-muted">
            Total por cobrar hoy
          </h1>
          <span class="rounded-md bg-zocalo-deep px-2.5 py-1 text-xs font-bold text-ground tabular-cop">
            {{ debtorCount }} clientes
          </span>
        </div>

        <p class="mt-1 text-4xl font-extrabold tracking-tight text-ground tabular-cop lg:text-5xl">
          {{ formatCOP(totalReceivable) }}
        </p>

        <p class="mt-1 text-xs font-medium text-zocalo-on-muted">
          Plata en la calle acumulada · No es ganancia del día
        </p>
      </div>
    </template>

    <div class="space-y-4 lg:space-y-5">
      <!-- Acciones primarias gemelas en zona de pulgar -->
      <div class="grid grid-cols-2 gap-3">
        <UiButton variant="fiado" size="lg" block :disabled="!isOnline" @click="uiStore.openQuickAction('fiado')">
          <Plus class="size-5 shrink-0" :stroke-width="2.5" aria-hidden="true" />
          <span>Fiar</span>
        </UiButton>
        <UiButton variant="abono" size="lg" block :disabled="!isOnline" @click="uiStore.openQuickAction('abono')">
          <Banknote class="size-5 shrink-0" :stroke-width="2.2" aria-hidden="true" />
          <span>Abonar</span>
        </UiButton>
      </div>

      <!-- Flujos del período (separados estrictamente del Stock) -->
      <section aria-labelledby="period-heading">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h2 id="period-heading" class="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
            Movimiento del período
          </h2>
          <div role="tablist" aria-label="Período de consulta" class="inline-flex rounded-xl bg-surface-muted p-0.5">
            <button
              v-for="p in periods"
              :key="p.id"
              role="tab"
              type="button"
              :aria-selected="activePeriod === p.id"
              :class="[
                'min-h-12 rounded-lg px-3 text-xs font-bold transition-colors duration-150 cursor-pointer',
                activePeriod === p.id ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink',
              ]"
              @click="uiStore.selectedPeriod = p.id"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-border bg-surface p-3 sm:p-3.5">
            <div class="flex items-center gap-1.5 text-xs font-bold text-fiado">
              <ArrowUpRight class="size-4 shrink-0" :stroke-width="2.4" aria-hidden="true" />
              <span>Fiado {{ activeFlow.label }}</span>
            </div>
            <p class="mt-1 text-2xl font-extrabold tracking-tight text-ink tabular-cop">
              {{ formatCOP(activeFlow.creditSales) }}
            </p>
            <p class="mt-0.5 text-xs text-ink-subtle tabular-cop">
              {{ activeFlow.creditCount }} compras registradas
            </p>
          </div>

          <div class="rounded-xl border border-border bg-surface p-3 sm:p-3.5">
            <div class="flex items-center gap-1.5 text-xs font-bold text-abono">
              <ArrowDownLeft class="size-4 shrink-0" :stroke-width="2.4" aria-hidden="true" />
              <span>Abonos {{ activeFlow.label }}</span>
            </div>
            <p class="mt-1 text-2xl font-extrabold tracking-tight text-ink tabular-cop">
              {{ formatCOP(activeFlow.payments) }}
            </p>
            <p class="mt-0.5 text-xs text-ink-subtle">
              Plata que entró · No es ganancia
            </p>
          </div>
        </div>

        <div class="mt-2 flex justify-end">
          <RouterLink
            to="/reportes"
            class="inline-flex min-h-12 items-center gap-1 px-2 text-xs font-bold text-zocalo hover:underline"
          >
            <span>Ver cuadre de caja y morosos</span>
            <ChevronRight class="size-4" :stroke-width="2.2" aria-hidden="true" />
          </RouterLink>
        </div>
      </section>

      <!-- Lista de mayores deudores con folio secuencial y barra proporcional -->
      <section aria-labelledby="debtors-heading">
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <h2 id="debtors-heading" class="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
            Los que más deben
          </h2>
          <RouterLink
            to="/clientes"
            class="inline-flex min-h-12 items-center gap-1 px-1 text-xs font-bold text-zocalo hover:underline"
          >
            <span>Ver todos</span>
            <ChevronRight class="size-4" :stroke-width="2.2" aria-hidden="true" />
          </RouterLink>
        </div>

        <div v-if="topDebtors.length === 0" class="rounded-xl border border-border bg-surface p-5 text-center text-sm text-ink-muted">
          Ningún cliente tiene saldo pendiente en este momento.
        </div>

        <ul v-else class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          <li v-for="debtor in topDebtors" :key="debtor.id">
            <RouterLink
              :to="authStore.backendReady ? `/clientes/${debtor.id}` : '/clientes'"
              class="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-ground sm:px-4 sm:py-3"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-extrabold text-ink sm:text-base">
                  {{ debtor.name }}
                </p>
                <div class="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
                  <UiBadge tone="zocalo">{{ debtor.seq }}</UiBadge>
                  <span class="truncate">{{ debtor.ref }}</span>
                </div>
                <div class="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                  <div
                    class="h-full rounded-full bg-fiado"
                    :style="{ width: `${Math.min(100, Math.round((debtor.balance / debtor.maxRef) * 100))}%` }"
                  />
                </div>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-base font-extrabold text-ink tabular-cop sm:text-lg">
                  {{ formatCOP(debtor.balance) }}
                </p>
                <p
                  :class="[
                    'mt-0.5 text-xs font-bold tabular-cop',
                    debtor.daysWithoutPayment >= 15 ? 'text-fiado' : 'text-ink-subtle font-semibold',
                  ]"
                >
                  {{ debtor.daysWithoutPayment >= 15 ? `${debtor.daysWithoutPayment} días sin abonar` : `Abonó hace ${debtor.daysWithoutPayment} días` }}
                </p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>

    <LedgerActionDrawer
      :open="uiStore.quickActionSheet !== null"
      :mode="drawerMode"
      :store-id="tenantStore.activeStoreId"
      :actor-role="tenantStore.activeRole"
      :backend-ready="authStore.backendReady"
      :customers="customers"
      @update:open="(val) => { if (!val) uiStore.closeQuickAction() }"
      @completed="handleLedgerCompleted"
      @open-whatsapp="openWhatsAppFromDrawer"
    />

    <WhatsAppReceiptDrawer
      :open="waOpen"
      :title="waConfig.title"
      :phone-e164="waConfig.phoneE164"
      :initial-message="waConfig.message"
      :receipt-image-payload="waConfig.receiptPayload"
      @update:open="waOpen = $event"
    />
  </AppShellLayout>
</template>
