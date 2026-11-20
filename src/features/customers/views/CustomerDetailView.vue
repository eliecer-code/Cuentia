<script setup lang="ts">
import {
  AlertCircle,
  Archive,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Unlock,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import CustomerFormDrawer from '@/features/customers/components/CustomerFormDrawer.vue'
import type { CustomerFormInput } from '@/features/customers/schemas/customer.schema'
import {
  getCustomerById,
  listCustomers,
  updateCustomer,
  updateCustomerStatus,
  type CustomerItem,
} from '@/features/customers/services/customers.service'
import LedgerActionDrawer, { type LedgerDrawerMode } from '@/features/ledger/components/LedgerActionDrawer.vue'
import WhatsAppReceiptDrawer from '@/features/ledger/components/WhatsAppReceiptDrawer.vue'
import { reversalInputSchema } from '@/features/ledger/schemas/ledger.schema'
import {
  listCustomerLedger,
  reverseLedgerEntry,
  type LedgerEntryItem,
} from '@/features/ledger/services/ledger.service'
import { useOnlineStatus } from '@/shared/composables/useOnlineStatus'
import { normalizeError } from '@/shared/lib/errors'
import {
  buildBalanceReminderMessage,
  buildCreditSaleMessage,
  buildPaymentReceiptMessage,
  PAYMENT_METHOD_LABELS,
} from '@/shared/lib/whatsapp'
import type { CustomerCreditStatus, LedgerEntryType } from '@/shared/types/domain.types'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import UiDrawer from '@/shared/ui/UiDrawer.vue'
import { formatCOP } from '@/shared/utils/cop'
import { formatBogotaDateTime } from '@/shared/utils/datesCO'
import { createIdempotencyKey } from '@/shared/utils/idempotency'

const route = useRoute()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const { isOnline } = useOnlineStatus()

const customerId = computed(() => String(route.params.id ?? ''))
const customer = ref<CustomerItem | null>(null)
const allCustomers = ref<CustomerItem[]>([])
const ledgerEntries = ref<LedgerEntryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const feedbackMessage = ref('')

const editOpen = ref(false)
const saving = ref(false)
const saveError = ref('')
const changingStatus = ref(false)

// Drawer financiero (Fiar / Abonar / Ajuste)
const actionDrawerOpen = ref(false)
const actionMode = ref<LedgerDrawerMode>('credit_sale')

// Drawer de detalle / anulación de un asiento
const selectedEntry = ref<LedgerEntryItem | null>(null)
const reverseReason = ref('')
const reverseError = ref('')
const reversing = ref(false)

// Drawer de WhatsApp
const waOpen = ref(false)
const waConfig = ref<{
  title: string
  message: string
  isReminder: boolean
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
  title: 'Enviar por WhatsApp',
  message: '',
  isReminder: false,
  receiptPayload: null,
})

const entryLabels: Record<LedgerEntryType, string> = {
  credit_sale: 'Fiado',
  payment: 'Abono',
  opening_balance: 'Saldo cuaderno',
  adjustment: 'Ajuste',
  reversal: 'Anulación',
}

async function loadDetail() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    customer.value = {
      id: customerId.value,
      storeId: 'demo',
      fullName: 'Don Carlos Pérez',
      nickname: 'El del taller',
      phoneE164: '+573124567890',
      documentNumber: null,
      address: 'Calle 12 # 4-18',
      notes: 'Paga los sábados',
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
      createdAt: new Date().toISOString(),
    }
    ledgerEntries.value = [
      {
        id: 'demo-e1',
        storeId: 'demo',
        customerId: customerId.value,
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
    ]
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const [found, list, entries] = await Promise.all([
      getCustomerById(storeId, customerId.value),
      listCustomers(storeId),
      listCustomerLedger(storeId, customerId.value),
    ])
    customer.value = found
    allCustomers.value = list
    ledgerEntries.value = entries
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    loading.value = false
  }
}

watch(() => [tenantStore.tenantEpoch, customerId.value], () => {
  void loadDetail()
})

onMounted(() => {
  void loadDetail()
})

const limitProgress = computed(() => {
  if (!customer.value?.creditLimit || customer.value.creditLimit <= 0) return null
  return Math.min(100, Math.round((customer.value.currentBalance / customer.value.creditLimit) * 100))
})

function openAction(mode: LedgerDrawerMode) {
  actionMode.value = mode
  actionDrawerOpen.value = true
}

function handleActionCompleted(payload: { entry: LedgerEntryItem; newBalance: number; customer: CustomerItem }) {
  if (customer.value) {
    customer.value = {
      ...customer.value,
      currentBalance: payload.newBalance,
      lastLedgerSeq: payload.entry.customerSeq,
    }
  }
  ledgerEntries.value = [payload.entry, ...ledgerEntries.value]
}

function openWhatsAppForEntry(entry: LedgerEntryItem, cust: CustomerItem) {
  const storeName = tenantStore.activeStore?.name ?? 'Tienda La Esquina'
  const seqLabel = `#${String(entry.customerSeq).padStart(3, '0')}`
  const isPayment = entry.entryType === 'payment'
  const methodLabel = entry.paymentMethod ? PAYMENT_METHOD_LABELS[entry.paymentMethod] : 'Fiado'

  waConfig.value = {
    title: isPayment ? 'Comprobante de abono' : 'Comprobante de movimiento',
    isReminder: false,
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
      subtitle: isPayment ? `Método: ${methodLabel}` : entry.note || 'Compra fiada en mostrador',
      balanceAfter: entry.balanceAfter,
      dateLabel: formatBogotaDateTime(entry.occurredAt),
      seqLabel,
    },
  }
  actionDrawerOpen.value = false
  selectedEntry.value = null
  waOpen.value = true
}

function openBalanceSummaryWhatsApp() {
  if (!customer.value) return
  const storeName = tenantStore.activeStore?.name ?? 'Tienda La Esquina'
  waConfig.value = {
    title: customer.value.currentBalance > 0 ? 'Recordatorio de saldo' : 'Enviar paz y salvo',
    isReminder: customer.value.currentBalance > 0,
    message: buildBalanceReminderMessage({
      storeName,
      customerName: customer.value.fullName,
      currentBalance: customer.value.currentBalance,
    }),
    receiptPayload: {
      storeName,
      customerName: customer.value.fullName,
      title: 'RESUMEN DE CUENTA',
      amountLabel: formatCOP(customer.value.currentBalance),
      subtitle: customer.value.currentBalance === 0 ? 'Cuenta al día' : 'Saldo pendiente por cobrar',
      balanceAfter: customer.value.currentBalance,
      dateLabel: formatBogotaDateTime(new Date()),
    },
  }
  waOpen.value = true
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
    feedbackMessage.value = 'Movimiento anulado mediante contra-asiento auditable.'
    await loadDetail()
  } catch (err) {
    reverseError.value = normalizeError(err).userMessage
  } finally {
    reversing.value = false
  }
}

async function handleEdit(payload: CustomerFormInput) {
  if (!customer.value || !tenantStore.activeStoreId || !tenantStore.activeRole) return
  saving.value = true
  saveError.value = ''
  try {
    customer.value = await updateCustomer(
      tenantStore.activeStoreId,
      customer.value,
      payload,
      tenantStore.activeRole,
    )
    editOpen.value = false
    feedbackMessage.value = 'Datos del cliente actualizados.'
  } catch (err) {
    saveError.value = normalizeError(err).userMessage
  } finally {
    saving.value = false
  }
}

async function handleStatusChange(nextStatus: CustomerCreditStatus) {
  if (!customer.value || !tenantStore.activeStoreId || !tenantStore.activeRole) return
  changingStatus.value = true
  errorMessage.value = ''
  feedbackMessage.value = ''
  try {
    customer.value = await updateCustomerStatus(
      tenantStore.activeStoreId,
      customer.value,
      nextStatus,
      tenantStore.activeRole,
    )
    const labels: Record<CustomerCreditStatus, string> = {
      active: 'Cliente reactivado para fiar.',
      frozen: 'Cliente bloqueado para nuevos fiados. Aún puede registrar abonos.',
      archived: 'Cliente archivado.',
    }
    feedbackMessage.value = labels[nextStatus]
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    changingStatus.value = false
  }
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 lg:mt-0">
        <div class="flex items-center gap-2 min-w-0">
          <RouterLink
            to="/clientes"
            class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-zocalo-deep text-ground hover:opacity-90"
            aria-label="Volver a clientes"
          >
            <ArrowLeft class="size-5" :stroke-width="2.2" />
          </RouterLink>
          <div class="min-w-0">
            <h1 class="truncate text-xl font-extrabold tracking-tight text-ground">
              {{ customer?.fullName ?? 'Perfil de cliente' }}
            </h1>
            <p v-if="customer?.nickname" class="truncate text-xs font-medium text-zocalo-on-muted">
              {{ customer.nickname }}
            </p>
          </div>
        </div>

        <UiButton
          v-if="customer"
          variant="secondary"
          size="md"
          :disabled="!isOnline"
          @click="editOpen = true"
        >
          <Pencil class="size-4" :stroke-width="2" aria-hidden="true" />
          <span>Editar</span>
        </UiButton>
      </div>
    </template>

    <div v-if="loading" class="space-y-3">
      <div class="h-36 animate-pulse rounded-xl border border-border bg-surface" />
      <div class="h-28 animate-pulse rounded-xl border border-border bg-surface" />
    </div>

    <div v-else-if="!customer" class="rounded-xl border border-border bg-surface p-6 text-center">
      <p class="text-base font-extrabold text-ink">No encontramos este cliente</p>
      <RouterLink to="/clientes" class="mt-3 inline-flex min-h-12 items-center text-sm font-bold text-zocalo hover:underline">
        Volver al listado de clientes
      </RouterLink>
    </div>

    <div v-else class="space-y-4">
      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>

      <div
        v-if="feedbackMessage"
        role="status"
        class="rounded-xl border border-abono bg-abono-soft px-3.5 py-2.5 text-sm font-bold text-abono"
      >
        {{ feedbackMessage }}
      </div>

      <!-- Tarjeta principal de saldo -->
      <section class="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-extrabold uppercase tracking-wider text-ink-muted">Saldo pendiente</span>
          <UiBadge v-if="customer.creditStatus === 'frozen'" tone="danger">Bloqueado para fiar</UiBadge>
          <UiBadge v-else-if="customer.creditStatus === 'archived'" tone="neutral">Archivado</UiBadge>
          <UiBadge v-else-if="customer.currentBalance > 0" tone="fiado">Debe</UiBadge>
          <UiBadge v-else tone="abono">Paz y salvo</UiBadge>
        </div>

        <p class="mt-2 text-4xl font-extrabold tracking-tight text-ink tabular-cop">
          {{ formatCOP(customer.currentBalance) }}
        </p>

        <div v-if="customer.creditLimit !== null && limitProgress !== null" class="mt-3 space-y-1">
          <div class="flex justify-between text-xs font-bold text-ink-muted tabular-cop">
            <span>Tope de fiado: {{ formatCOP(customer.creditLimit) }}</span>
            <span>Disponible: {{ formatCOP(Math.max(0, customer.creditLimit - customer.currentBalance)) }}</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              :class="['h-full rounded-full', customer.currentBalance > customer.creditLimit ? 'bg-danger' : 'bg-fiado']"
              :style="{ width: `${limitProgress}%` }"
            />
          </div>
        </div>

        <div class="mt-4">
          <button
            type="button"
            class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-abono bg-abono-soft px-4 text-sm font-extrabold text-abono hover:opacity-90 cursor-pointer"
            @click="openBalanceSummaryWhatsApp"
          >
            <MessageCircle class="size-4" :stroke-width="2.2" aria-hidden="true" />
            <span>{{ customer.currentBalance > 0 ? 'Enviar resumen por WhatsApp' : 'Enviar paz y salvo por WhatsApp' }}</span>
          </button>
        </div>

        <div v-if="customer.phoneE164 || customer.address || customer.notes" class="mt-4 space-y-1 border-t border-border pt-3 text-xs text-ink-muted">
          <p v-if="customer.phoneE164" class="flex items-center gap-1.5 font-bold text-ink tabular-cop">
            <Phone class="size-3.5 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <span>{{ customer.phoneE164 }}</span>
          </p>
          <p v-if="customer.address">Dirección: {{ customer.address }}</p>
          <p v-if="customer.notes">Nota: {{ customer.notes }}</p>
        </div>
      </section>

      <!-- Acciones de cuenta (+ Fiar / $ Abonar) -->
      <div class="grid grid-cols-2 gap-3">
        <UiButton
          variant="fiado"
          size="lg"
          block
          :disabled="!isOnline || customer.creditStatus !== 'active'"
          @click="openAction('credit_sale')"
        >
          <Plus class="size-5 shrink-0" :stroke-width="2.4" aria-hidden="true" />
          <span>Fiar</span>
        </UiButton>
        <UiButton
          variant="abono"
          size="lg"
          block
          :disabled="!isOnline || customer.creditStatus === 'archived' || customer.currentBalance <= 0"
          @click="openAction('payment')"
        >
          <Banknote class="size-5 shrink-0" :stroke-width="2.2" aria-hidden="true" />
          <span>{{ customer.currentBalance <= 0 ? 'Al día' : 'Abonar' }}</span>
        </UiButton>
      </div>

      <!-- Controles de estado y ajuste para Dueño / Administrador -->
      <section v-if="tenantStore.canManageTeam && authStore.backendReady" class="rounded-xl border border-border bg-surface p-4">
        <h2 class="text-xs font-extrabold uppercase tracking-wider text-ink-muted">Control de cuenta</h2>
        <div class="mt-2.5 flex flex-wrap gap-2">
          <UiButton
            v-if="customer.creditStatus !== 'archived'"
            variant="secondary"
            size="md"
            :disabled="!isOnline"
            @click="openAction('adjustment')"
          >
            <SlidersHorizontal class="size-4 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <span>Ajuste / Descuento</span>
          </UiButton>

          <UiButton
            v-if="customer.creditStatus === 'active'"
            variant="secondary"
            size="md"
            :loading="changingStatus"
            @click="handleStatusChange('frozen')"
          >
            <Lock class="size-4 text-fiado" :stroke-width="2" aria-hidden="true" />
            <span>Bloquear para fiar</span>
          </UiButton>

          <UiButton
            v-if="customer.creditStatus !== 'active'"
            variant="secondary"
            size="md"
            :loading="changingStatus"
            @click="handleStatusChange('active')"
          >
            <Unlock class="size-4 text-abono" :stroke-width="2" aria-hidden="true" />
            <span>Reactivar cliente</span>
          </UiButton>

          <UiButton
            v-if="customer.creditStatus !== 'archived' && tenantStore.isOwner"
            variant="secondary"
            size="md"
            :disabled="customer.currentBalance !== 0"
            :loading="changingStatus"
            @click="handleStatusChange('archived')"
          >
            <Archive class="size-4 text-ink-muted" :stroke-width="2" aria-hidden="true" />
            <span>Archivar (solo en $ 0)</span>
          </UiButton>
        </div>
      </section>

      <!-- Extracto cronológico inmutable -->
      <section aria-labelledby="cust-ledger-heading">
        <h2 id="cust-ledger-heading" class="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
          Historial de movimientos
        </h2>

        <div v-if="ledgerEntries.length === 0" class="rounded-xl border border-border bg-surface p-5 text-center text-sm text-ink-muted">
          Todavía no hay fiados ni abonos registrados para {{ customer.fullName }}.
        </div>

        <ul v-else class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          <li v-for="entry in ledgerEntries" :key="entry.id">
            <button
              type="button"
              class="flex min-h-[72px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ground cursor-pointer"
              @click="selectedEntry = entry; reverseReason = ''; reverseError = ''"
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

                <p class="mt-1 truncate text-xs font-medium text-ink-muted">
                  {{ entry.note || entry.reason || 'Sin descripción' }} · {{ formatBogotaDateTime(entry.occurredAt) }}
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
      </section>
    </div>

    <!-- Drawer de acción financiera -->
    <LedgerActionDrawer
      v-if="customer"
      :open="actionDrawerOpen"
      :mode="actionMode"
      :store-id="tenantStore.activeStoreId"
      :actor-role="tenantStore.activeRole"
      :backend-ready="authStore.backendReady"
      :customers="[customer]"
      :preselected-customer-id="customer.id"
      @update:open="actionDrawerOpen = $event"
      @completed="handleActionCompleted"
      @open-whatsapp="openWhatsAppForEntry"
    />

    <!-- Drawer de detalle y anulación de asiento -->
    <UiDrawer
      :open="selectedEntry !== null"
      :title="selectedEntry ? `Movimiento #${String(selectedEntry.customerSeq).padStart(3, '0')}` : 'Detalle'"
      @update:open="(val) => { if (!val) selectedEntry = null }"
    >
      <div v-if="selectedEntry && customer" class="space-y-4">
        <div class="rounded-xl border border-border bg-surface p-3.5 text-sm space-y-1">
          <p class="text-xl font-extrabold tabular-cop text-ink">
            {{ formatCOP(selectedEntry.signedAmount, { signed: true }) }}
          </p>
          <p class="text-xs text-ink-muted">
            {{ entryLabels[selectedEntry.entryType] }}
            {{ selectedEntry.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[selectedEntry.paymentMethod]}` : '' }}
            · {{ formatBogotaDateTime(selectedEntry.occurredAt) }} · Por {{ selectedEntry.createdByName }}
          </p>
          <p v-if="selectedEntry.note" class="text-xs text-ink">Detalle: {{ selectedEntry.note }}</p>
          <p v-if="selectedEntry.reason" class="text-xs text-ink">Motivo: {{ selectedEntry.reason }}</p>
          <p class="text-xs font-bold text-ink-muted tabular-cop">
            Antes: {{ formatCOP(selectedEntry.balanceBefore) }} → Quedó en: {{ formatCOP(selectedEntry.balanceAfter) }}
          </p>
        </div>

        <UiButton
          v-if="selectedEntry.entryType !== 'reversal'"
          variant="abono"
          size="lg"
          block
          @click="openWhatsAppForEntry(selectedEntry, customer)"
        >
          <MessageCircle class="size-5" :stroke-width="2.2" aria-hidden="true" />
          <span>Compartir comprobante por WhatsApp</span>
        </UiButton>

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
            placeholder="Motivo obligatorio (mín. 5 letras)"
            class="min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-zocalo focus:outline-none"
          />
          <UiButton variant="fiado" size="lg" block :loading="reversing" @click="handleReverse">
            <RotateCcw class="size-4" :stroke-width="2.2" aria-hidden="true" />
            <span>Confirmar anulación</span>
          </UiButton>
        </div>
      </div>
    </UiDrawer>

    <WhatsAppReceiptDrawer
      :open="waOpen"
      :title="waConfig.title"
      :phone-e164="customer?.phoneE164 ?? null"
      :whatsapp-opt-out="customer?.whatsappOptOut"
      :initial-message="waConfig.message"
      :is-collection-reminder="waConfig.isReminder"
      :receipt-image-payload="waConfig.receiptPayload"
      @update:open="waOpen = $event"
    />

    <CustomerFormDrawer
      :open="editOpen"
      mode="edit"
      :existing-customers="allCustomers"
      :initial-customer="customer"
      :can-edit-limit="tenantStore.canManageTeam || !authStore.backendReady"
      :loading="saving"
      :server-error="saveError"
      @update:open="editOpen = $event"
      @submit="handleEdit"
    />
  </AppShellLayout>
</template>
