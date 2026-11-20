<script setup lang="ts">
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { reversalInputSchema } from '@/features/ledger/schemas/ledger.schema'
import {
  listStoreLedger,
  reverseLedgerEntry,
  type LedgerEntryItem,
} from '@/features/ledger/services/ledger.service'
import { normalizeError } from '@/shared/lib/errors'
import { PAYMENT_METHOD_LABELS } from '@/shared/lib/whatsapp'
import type { LedgerEntryType } from '@/shared/types/domain.types'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import UiDrawer from '@/shared/ui/UiDrawer.vue'
import { formatCOP } from '@/shared/utils/cop'
import { formatBogotaDateTime, getBogotaPeriodRange } from '@/shared/utils/datesCO'
import { createIdempotencyKey } from '@/shared/utils/idempotency'

const authStore = useAuthStore()
const tenantStore = useTenantStore()

const entries = ref<LedgerEntryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const dateFilter = ref<'today' | 'week' | 'month' | 'all'>('all')
const typeFilter = ref<'all' | LedgerEntryType>('all')

const selectedEntry = ref<LedgerEntryItem | null>(null)
const reverseReason = ref('')
const reverseError = ref('')
const reversing = ref(false)

const DEMO_ENTRIES: LedgerEntryItem[] = [
  {
    id: 'demo-e1',
    storeId: 'demo',
    customerId: 'demo-c1',
    customerName: 'Don Carlos Pérez',
    customerSeq: 42,
    entryType: 'credit_sale',
    signedAmount: 15_000,
    balanceBefore: 170_000,
    balanceAfter: 185_000,
    paymentMethod: null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-e1',
    payloadHash: 'demo',
    note: 'Arroz, 6 huevos y leche',
    reason: null,
    occurredAt: new Date().toISOString(),
    businessDate: new Date().toISOString().slice(0, 10),
    createdBy: 'demo',
    createdByName: 'Dueño',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-e2',
    storeId: 'demo',
    customerId: 'demo-c2',
    customerName: 'Doña Marta Gómez',
    customerSeq: 39,
    entryType: 'payment',
    signedAmount: -20_000,
    balanceBefore: 148_500,
    balanceAfter: 128_500,
    paymentMethod: 'nequi',
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: 'demo-e2',
    payloadHash: 'demo',
    note: 'Abono por Nequi',
    reason: null,
    occurredAt: new Date().toISOString(),
    businessDate: new Date().toISOString().slice(0, 10),
    createdBy: 'demo',
    createdByName: 'Dueño',
    createdAt: new Date().toISOString(),
  },
]

async function loadEntries() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    entries.value = DEMO_ENTRIES
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    entries.value = await listStoreLedger(storeId)
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenantEpoch, () => {
  void loadEntries()
})

onMounted(() => {
  void loadEntries()
})

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase()
  const range = dateFilter.value === 'all' ? null : getBogotaPeriodRange(dateFilter.value)

  return entries.value.filter((e) => {
    if (range && (e.businessDate < range.businessDateFrom || e.businessDate > range.businessDateTo)) {
      return false
    }
    if (typeFilter.value !== 'all' && e.entryType !== typeFilter.value) {
      return false
    }
    if (q) {
      const hay = `${e.customerName} ${e.note ?? ''} ${e.reason ?? ''} ${e.createdByName}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

const summaryTotals = computed(() => {
  let fiado = 0
  let abonos = 0
  for (const e of filteredEntries.value) {
    if (e.reversedByEntryId) continue
    if (e.entryType === 'credit_sale') fiado += e.signedAmount
    if (e.entryType === 'payment') abonos += Math.abs(e.signedAmount)
  }
  return { fiado, abonos, count: filteredEntries.value.length }
})

const entryLabels: Record<LedgerEntryType, string> = {
  credit_sale: 'Fiado',
  payment: 'Abono',
  opening_balance: 'Saldo cuaderno',
  adjustment: 'Ajuste',
  reversal: 'Anulación',
}

function openEntryDetail(entry: LedgerEntryItem) {
  selectedEntry.value = entry
  reverseReason.value = ''
  reverseError.value = ''
}

async function handleReverse() {
  if (!selectedEntry.value) return
  reverseError.value = ''
  const parsed = reversalInputSchema.safeParse({ reason: reverseReason.value })
  if (!parsed.success) {
    reverseError.value = parsed.error.issues[0]?.message ?? 'Motivo inválido.'
    return
  }

  if (!tenantStore.activeStoreId || !authStore.backendReady || !tenantStore.activeRole) {
    reverseError.value = 'Conecta Firebase en .env para anular movimientos reales.'
    return
  }

  reversing.value = true
  try {
    await reverseLedgerEntry({
      storeId: tenantStore.activeStoreId,
      originalEntryId: selectedEntry.value.id,
      reason: parsed.data.reason,
      idempotencyKey: createIdempotencyKey(),
      actorRole: tenantStore.activeRole,
    })
    selectedEntry.value = null
    await loadEntries()
  } catch (err) {
    reverseError.value = normalizeError(err).userMessage
  } finally {
    reversing.value = false
  }
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 lg:mt-0">
        <h1 class="text-xl font-extrabold tracking-tight text-ground">Movimientos</h1>
        <p class="mt-0.5 text-xs font-medium text-zocalo-on-muted tabular-cop">
          Libro mayor inmutable · {{ summaryTotals.count }} registros visibles
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Búsqueda y filtros -->
      <div class="relative">
        <Search class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-5 text-ink-muted" :stroke-width="2" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          aria-label="Buscar movimiento"
          placeholder="Buscar por cliente, nota o responsable..."
          :class="[
            'min-h-12 w-full rounded-xl border border-border-strong bg-surface pl-11 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none',
            search ? 'pr-12' : 'pr-3.5',
          ]"
        />
        <button
          v-if="search"
          type="button"
          aria-label="Limpiar búsqueda"
          class="absolute inset-y-0 right-0 inline-flex size-12 items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
          @click="search = ''"
        >
          <X class="size-5" :stroke-width="2" />
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filtrar por fecha" class="flex flex-wrap gap-1.5">
          <button
            v-for="p in ([
              { id: 'all', label: 'Todos' },
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
            ] as const)"
            :key="p.id"
            role="tab"
            type="button"
            :aria-selected="dateFilter === p.id"
            :class="[
              'min-h-12 rounded-xl border px-3 text-xs font-bold cursor-pointer',
              dateFilter === p.id
                ? 'border-zocalo bg-zocalo text-ground'
                : 'border-border-strong bg-surface text-ink-muted hover:text-ink',
            ]"
            @click="dateFilter = p.id"
          >
            {{ p.label }}
          </button>
        </div>

        <select
          v-model="typeFilter"
          aria-label="Filtrar por tipo de movimiento"
          class="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold text-ink focus:border-zocalo focus:outline-none"
        >
          <option value="all">Todos los tipos</option>
          <option value="credit_sale">Solo fiados</option>
          <option value="payment">Solo abonos</option>
          <option value="opening_balance">Saldos de cuaderno</option>
          <option value="adjustment">Ajustes</option>
          <option value="reversal">Anulaciones</option>
        </select>
      </div>

      <!-- Tira resumen del filtro activo -->
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs font-bold tabular-cop">
        <span class="text-fiado">Fiado neto: {{ formatCOP(summaryTotals.fiado) }}</span>
        <span class="text-abono">Abonos: {{ formatCOP(summaryTotals.abonos) }}</span>
      </div>

      <div v-if="loading" class="space-y-2.5">
        <div v-for="n in 4" :key="n" class="h-18 animate-pulse rounded-xl border border-border bg-surface" />
      </div>

      <div v-else-if="filteredEntries.length === 0" class="rounded-xl border border-border bg-surface p-6 text-center">
        <p class="text-base font-extrabold text-ink">No hay movimientos en este filtro</p>
        <p class="mt-1 text-xs text-ink-muted">Prueba cambiando el período o el buscador.</p>
      </div>

      <ul v-else class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        <li v-for="entry in filteredEntries" :key="entry.id">
          <button
            type="button"
            class="flex min-h-[72px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ground cursor-pointer"
            @click="openEntryDetail(entry)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <UiBadge tone="zocalo">#{{ String(entry.customerSeq).padStart(3, '0') }}</UiBadge>
                <UiBadge
                  :tone="
                    entry.reversedByEntryId
                      ? 'neutral'
                      : entry.entryType === 'payment'
                        ? 'abono'
                        : entry.entryType === 'reversal'
                          ? 'danger'
                          : 'fiado'
                  "
                >
                  <ArrowUpRight v-if="entry.signedAmount > 0 && entry.entryType !== 'reversal'" class="size-3" :stroke-width="2.4" />
                  <ArrowDownLeft v-else-if="entry.entryType === 'payment'" class="size-3" :stroke-width="2.4" />
                  <BookOpen v-else-if="entry.entryType === 'opening_balance'" class="size-3" :stroke-width="2.2" />
                  <SlidersHorizontal v-else-if="entry.entryType === 'adjustment'" class="size-3" :stroke-width="2.2" />
                  <RotateCcw v-else class="size-3" :stroke-width="2.2" />
                  <span>
                    {{ entryLabels[entry.entryType] }}{{ entry.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[entry.paymentMethod]}` : '' }}
                  </span>
                </UiBadge>
                <UiBadge v-if="entry.reversedByEntryId" tone="danger">Anulado</UiBadge>
              </div>

              <p class="mt-1 truncate text-sm font-extrabold text-ink">
                {{ entry.customerName }}
              </p>
              <p class="truncate text-xs text-ink-subtle">
                {{ entry.note || entry.reason || 'Sin nota' }} · {{ formatBogotaDateTime(entry.occurredAt) }} · {{ entry.createdByName }}
              </p>
            </div>

            <div class="shrink-0 text-right">
              <p
                :class="[
                  'text-base font-extrabold tabular-cop',
                  entry.reversedByEntryId
                    ? 'line-through text-ink-subtle'
                    : entry.signedAmount < 0
                      ? 'text-abono'
                      : 'text-ink',
                ]"
              >
                {{ formatCOP(entry.signedAmount, { signed: true }) }}
              </p>
              <p class="mt-0.5 text-xs text-ink-subtle tabular-cop">
                Quedó en {{ formatCOP(entry.balanceAfter) }}
              </p>
            </div>
          </button>
        </li>
      </ul>
    </div>

    <!-- Drawer de detalle y anulación auditable -->
    <UiDrawer
      :open="selectedEntry !== null"
      :title="selectedEntry ? `Movimiento #${String(selectedEntry.customerSeq).padStart(3, '0')}` : 'Detalle'"
      @update:open="(val) => { if (!val) selectedEntry = null }"
    >
      <div v-if="selectedEntry" class="space-y-4">
        <div class="rounded-xl border border-border bg-surface p-3.5 text-sm space-y-1">
          <p class="font-extrabold text-ink">{{ selectedEntry.customerName }}</p>
          <p class="text-xl font-extrabold tabular-cop text-ink">
            {{ formatCOP(selectedEntry.signedAmount, { signed: true }) }}
          </p>
          <p class="text-xs text-ink-muted">
            {{ entryLabels[selectedEntry.entryType] }}
            {{ selectedEntry.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[selectedEntry.paymentMethod]}` : '' }}
            · {{ formatBogotaDateTime(selectedEntry.occurredAt) }}
          </p>
          <p v-if="selectedEntry.note" class="text-xs text-ink">Detalle: {{ selectedEntry.note }}</p>
          <p v-if="selectedEntry.reason" class="text-xs text-ink">Motivo: {{ selectedEntry.reason }}</p>
          <p class="text-xs font-bold text-ink-muted tabular-cop">
            Saldo anterior: {{ formatCOP(selectedEntry.balanceBefore) }} → Nuevo saldo: {{ formatCOP(selectedEntry.balanceAfter) }}
          </p>
        </div>

        <RouterLink
          :to="`/clientes/${selectedEntry.customerId}`"
          class="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-surface px-4 text-sm font-bold text-zocalo hover:bg-surface-muted"
          @click="selectedEntry = null"
        >
          Ver perfil de {{ selectedEntry.customerName }}
        </RouterLink>

        <!-- Formulario de anulación si no ha sido anulado y no es una anulación -->
        <div
          v-if="!selectedEntry.reversedByEntryId && selectedEntry.entryType !== 'reversal' && (tenantStore.canManageTeam || !authStore.backendReady)"
          class="space-y-2.5 border-t border-border pt-3"
        >
          <p class="text-xs font-extrabold uppercase tracking-wider text-danger">Anular este movimiento</p>
          <div v-if="reverseError" role="alert" class="rounded-xl border border-danger bg-danger-soft p-2.5 text-xs font-bold text-danger">
            {{ reverseError }}
          </div>
          <input
            v-model="reverseReason"
            type="text"
            placeholder="Motivo obligatorio (ej. Error de digitación)"
            class="min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-zocalo focus:outline-none"
          />
          <UiButton variant="fiado" size="lg" block :loading="reversing" @click="handleReverse">
            <RotateCcw class="size-4" :stroke-width="2.2" aria-hidden="true" />
            <span>Confirmar anulación</span>
          </UiButton>
        </div>
      </div>
    </UiDrawer>
  </AppShellLayout>
</template>
