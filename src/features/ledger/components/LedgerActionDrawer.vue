<script setup lang="ts">
import { AlertCircle, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import type { CustomerItem } from '@/features/customers/services/customers.service'
import {
  adjustmentInputSchema,
  creditSaleInputSchema,
  migrateNotebookSchema,
  paymentInputSchema,
} from '@/features/ledger/schemas/ledger.schema'
import {
  createCustomerWithOpeningBalance,
  postLedgerEntry,
  type LedgerEntryItem,
} from '@/features/ledger/services/ledger.service'
import { PAYMENT_METHOD_LABELS } from '@/shared/lib/whatsapp'
import { normalizeError } from '@/shared/lib/errors'
import type { PaymentMethodType, StoreRole } from '@/shared/types/domain.types'
import UiButton from '@/shared/ui/UiButton.vue'
import UiDrawer from '@/shared/ui/UiDrawer.vue'
import { formatCOP, isHighAmountCOP, parseCOPInput } from '@/shared/utils/cop'
import { createActionAttempt } from '@/shared/utils/idempotency'

export type LedgerDrawerMode = 'credit_sale' | 'payment' | 'adjustment' | 'opening_balance'

const props = defineProps<{
  open: boolean
  mode: LedgerDrawerMode
  storeId: string | null
  actorRole: StoreRole | null
  backendReady: boolean
  customers: CustomerItem[]
  preselectedCustomerId?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  completed: [payload: { entry: LedgerEntryItem; newBalance: number; customer: CustomerItem }]
  'open-whatsapp': [entry: LedgerEntryItem, customer: CustomerItem]
}>()

const attempt = createActionAttempt()
const selectedCustomerId = ref<string>('')
const rawAmount = ref('')
const note = ref('')
const reason = ref('')
const paymentMethod = ref<PaymentMethodType>('cash')
const adjustmentDirection = ref<'decrease' | 'increase'>('decrease')
const confirmOverLimit = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successState = ref<{ entry: LedgerEntryItem; customer: CustomerItem } | null>(null)

// Campos exclusivos de migración de cuaderno
const notebookForm = reactive({
  fullName: '',
  nickname: '',
  phoneRaw: '',
})

const paymentMethods: Array<{ id: PaymentMethodType; label: string }> = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'other', label: 'Otro' },
]

const quickChips = computed(() =>
  props.mode === 'payment' ? [5_000, 10_000, 20_000, 50_000] : [1_000, 5_000, 10_000, 20_000],
)

const availableCustomers = computed(() => {
  if (props.mode === 'payment') {
    return props.customers.filter((c) => c.creditStatus !== 'archived' && c.currentBalance > 0)
  }
  if (props.mode === 'credit_sale') {
    return props.customers.filter((c) => c.creditStatus === 'active')
  }
  return props.customers.filter((c) => c.creditStatus !== 'archived')
})

const activeCustomer = computed<CustomerItem | null>(
  () => props.customers.find((c) => c.id === selectedCustomerId.value) ?? null,
)

const parsedAmount = computed(() => parseCOPInput(rawAmount.value) ?? 0)

const projectedBalance = computed<number | null>(() => {
  if (!activeCustomer.value) return null
  if (parsedAmount.value <= 0) return activeCustomer.value.currentBalance
  if (props.mode === 'credit_sale') return activeCustomer.value.currentBalance + parsedAmount.value
  if (props.mode === 'payment') return activeCustomer.value.currentBalance - parsedAmount.value
  if (props.mode === 'adjustment') {
    return adjustmentDirection.value === 'decrease'
      ? activeCustomer.value.currentBalance - parsedAmount.value
      : activeCustomer.value.currentBalance + parsedAmount.value
  }
  return parsedAmount.value
})

const exceedsBalance = computed(
  () =>
    props.mode === 'payment'
    && activeCustomer.value !== null
    && parsedAmount.value > activeCustomer.value.currentBalance,
)

const exceedsCreditLimit = computed(
  () =>
    props.mode === 'credit_sale'
    && activeCustomer.value !== null
    && activeCustomer.value.creditLimit !== null
    && projectedBalance.value !== null
    && projectedBalance.value > activeCustomer.value.creditLimit,
)

const drawerTitle = computed(() => {
  if (successState.value) return 'Movimiento guardado'
  if (props.mode === 'credit_sale') return 'Registrar fiado'
  if (props.mode === 'payment') return 'Registrar abono'
  if (props.mode === 'adjustment') return 'Ajuste o descuento'
  return 'Pasar cliente del cuaderno'
})

watch(
  () => [props.open, props.mode, props.preselectedCustomerId],
  ([isOpen]) => {
    if (!isOpen) return
    attempt.reset()
    rawAmount.value = ''
    note.value = ''
    reason.value = ''
    paymentMethod.value = 'cash'
    adjustmentDirection.value = 'decrease'
    confirmOverLimit.value = false
    errorMessage.value = ''
    successState.value = null
    notebookForm.fullName = ''
    notebookForm.nickname = ''
    notebookForm.phoneRaw = ''

    if (props.preselectedCustomerId) {
      selectedCustomerId.value = props.preselectedCustomerId
    } else {
      selectedCustomerId.value = availableCustomers.value[0]?.id ?? ''
    }
  },
)

function formatInputValue(num: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num)
}

function handleAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  if (!digits) {
    rawAmount.value = ''
    return
  }
  const num = Number(digits)
  if (Number.isSafeInteger(num)) {
    rawAmount.value = formatInputValue(num)
  }
}

function addChip(delta: number) {
  rawAmount.value = formatInputValue(parsedAmount.value + delta)
}

function fillFullDebt() {
  if (!activeCustomer.value || activeCustomer.value.currentBalance <= 0) return
  rawAmount.value = formatInputValue(activeCustomer.value.currentBalance)
}

function buildDemoEntry(customer: CustomerItem, signedAmount: number): LedgerEntryItem {
  const nowIso = new Date().toISOString()
  return {
    id: attempt.getKey(),
    storeId: customer.storeId,
    customerId: customer.id,
    customerName: customer.fullName,
    customerSeq: customer.lastLedgerSeq + 1,
    entryType: props.mode === 'opening_balance' ? 'opening_balance' : props.mode,
    signedAmount,
    balanceBefore: customer.currentBalance,
    balanceAfter: customer.currentBalance + signedAmount,
    paymentMethod: props.mode === 'payment' ? paymentMethod.value : null,
    reversesEntryId: null,
    reversedByEntryId: null,
    idempotencyKey: attempt.getKey(),
    payloadHash: 'demo',
    note: note.value.trim() || null,
    reason: reason.value.trim() || null,
    occurredAt: nowIso,
    businessDate: nowIso.slice(0, 10),
    createdBy: 'demo',
    createdByName: 'Dueño',
    createdAt: nowIso,
  }
}

async function handleSubmit() {
  errorMessage.value = ''

  if (props.mode === 'opening_balance') {
    const parsed = migrateNotebookSchema.safeParse({
      fullName: notebookForm.fullName,
      nickname: notebookForm.nickname,
      phoneRaw: notebookForm.phoneRaw,
      openingBalance: parsedAmount.value,
      note: note.value,
    })
    if (!parsed.success) {
      errorMessage.value = parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.'
      return
    }
    if (!props.storeId || !props.backendReady) {
      errorMessage.value = 'Conecta Firebase en .env para guardar clientes reales del cuaderno.'
      return
    }
    submitting.value = true
    try {
      const res = await createCustomerWithOpeningBalance({
        storeId: props.storeId,
        fullName: parsed.data.fullName,
        nickname: parsed.data.nickname,
        phoneRaw: parsed.data.phoneRaw,
        openingBalance: parsed.data.openingBalance,
        note: parsed.data.note,
        idempotencyKey: attempt.getKey(),
      })
      attempt.reset()
      emit('completed', { entry: res.entry, newBalance: res.customer.currentBalance, customer: res.customer })
      // Bucle ultrarrápido de migración: limpia el formulario para pasar otro cliente del cuaderno
      notebookForm.fullName = ''
      notebookForm.nickname = ''
      notebookForm.phoneRaw = ''
      rawAmount.value = ''
      note.value = ''
      successState.value = { entry: res.entry, customer: res.customer }
    } catch (err) {
      errorMessage.value = normalizeError(err).userMessage
    } finally {
      submitting.value = false
    }
    return
  }

  const cust = activeCustomer.value
  if (!cust) {
    errorMessage.value = 'Selecciona un cliente primero.'
    return
  }

  let signedAmount = 0
  if (props.mode === 'credit_sale') {
    const parsed = creditSaleInputSchema.safeParse({
      amount: parsedAmount.value,
      note: note.value,
      confirmOverLimit: confirmOverLimit.value,
    })
    if (!parsed.success) {
      errorMessage.value = parsed.error.issues[0]?.message ?? 'Monto inválido.'
      return
    }
    if (exceedsCreditLimit.value && !confirmOverLimit.value) {
      errorMessage.value = 'Confirma que autorizas superar el tope de fiado de este cliente.'
      return
    }
    signedAmount = parsed.data.amount
  } else if (props.mode === 'payment') {
    const parsed = paymentInputSchema.safeParse({
      amount: parsedAmount.value,
      paymentMethod: paymentMethod.value,
      note: note.value,
    })
    if (!parsed.success) {
      errorMessage.value = parsed.error.issues[0]?.message ?? 'Monto inválido.'
      return
    }
    if (exceedsBalance.value) {
      errorMessage.value = `El abono máximo es ${formatCOP(cust.currentBalance)}.`
      return
    }
    signedAmount = -parsed.data.amount
  } else {
    const parsed = adjustmentInputSchema.safeParse({
      direction: adjustmentDirection.value,
      amount: parsedAmount.value,
      reason: reason.value,
    })
    if (!parsed.success) {
      errorMessage.value = parsed.error.issues[0]?.message ?? 'Revisa los datos del ajuste.'
      return
    }
    signedAmount = parsed.data.direction === 'decrease' ? -parsed.data.amount : parsed.data.amount
  }

  if (!props.storeId || !props.backendReady || !props.actorRole) {
    // Modo demostración local sin backend
    const demoEntry = buildDemoEntry(cust, signedAmount)
    const updatedCustomer = {
      ...cust,
      currentBalance: demoEntry.balanceAfter,
      lastLedgerSeq: demoEntry.customerSeq,
    }
    attempt.reset()
    emit('completed', { entry: demoEntry, newBalance: demoEntry.balanceAfter, customer: updatedCustomer })
    successState.value = { entry: demoEntry, customer: updatedCustomer }
    return
  }

  submitting.value = true
  try {
    const res = await postLedgerEntry({
      storeId: props.storeId,
      customerId: cust.id,
      entryType: props.mode,
      signedAmount,
      paymentMethod: props.mode === 'payment' ? paymentMethod.value : null,
      note: note.value.trim() || null,
      reason: props.mode === 'adjustment' ? reason.value.trim() : null,
      idempotencyKey: attempt.getKey(),
      actorRole: props.actorRole,
      confirmOverLimit: confirmOverLimit.value,
    })
    attempt.reset()
    const updatedCustomer = {
      ...cust,
      currentBalance: res.newBalance,
      lastLedgerSeq: res.entry.customerSeq,
    }
    emit('completed', { entry: res.entry, newBalance: res.newBalance, customer: updatedCustomer })
    successState.value = { entry: res.entry, customer: updatedCustomer }
  } catch (err) {
    // Mantiene la misma `idempotencyKey` intacta si el fallo fue de red para reintentar sin duplicados (`CL-03`)
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    submitting.value = false
  }
}

function resetForAnotherMigration() {
  successState.value = null
  attempt.reset()
}
</script>

<template>
  <UiDrawer
    :open="open"
    :title="drawerTitle"
    @update:open="emit('update:open', $event)"
  >
    <!-- Pantalla de éxito rápida con botón de comprobante WhatsApp -->
    <div v-if="successState" class="space-y-4">
      <div class="rounded-xl border border-abono bg-abono-soft p-4">
        <div class="flex items-start gap-2.5">
          <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-abono" :stroke-width="2.4" aria-hidden="true" />
          <div>
            <p class="text-sm font-extrabold text-abono">
              {{
                successState.entry.entryType === 'payment'
                  ? `Abono de ${formatCOP(Math.abs(successState.entry.signedAmount))} (${PAYMENT_METHOD_LABELS[successState.entry.paymentMethod ?? 'cash']})`
                  : successState.entry.entryType === 'opening_balance'
                    ? `Saldo de cuaderno guardado (${formatCOP(successState.entry.signedAmount)})`
                    : `Movimiento de ${formatCOP(Math.abs(successState.entry.signedAmount))} guardado`
              }}
            </p>
            <p class="mt-1 text-sm font-bold text-ink tabular-cop">
              {{ successState.customer.fullName }} · Saldo actual: {{ formatCOP(successState.entry.balanceAfter) }}
            </p>
          </div>
        </div>
      </div>

      <UiButton
        v-if="mode !== 'adjustment'"
        variant="abono"
        size="lg"
        block
        @click="emit('open-whatsapp', successState.entry, successState.customer)"
      >
        <MessageCircle class="size-5" :stroke-width="2.2" aria-hidden="true" />
        <span>Enviar comprobante por WhatsApp</span>
      </UiButton>

      <div class="flex gap-2.5">
        <UiButton
          v-if="mode === 'opening_balance'"
          variant="secondary"
          size="lg"
          block
          @click="resetForAnotherMigration"
        >
          Pasar otro del cuaderno
        </UiButton>
        <UiButton variant="secondary" size="lg" block @click="emit('update:open', false)">
          Listo, cerrar
        </UiButton>
      </div>
    </div>

    <!-- Formulario transaccional -->
    <form v-else class="max-h-[75dvh] space-y-3.5 overflow-y-auto pr-0.5" novalidate @submit.prevent="handleSubmit">
      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-2 rounded-xl border border-danger bg-danger-soft p-3 text-xs font-bold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Campos para migración de cuaderno -->
      <template v-if="mode === 'opening_balance'">
        <div>
          <label for="nb-name" class="block text-sm font-bold text-ink">Nombre del cliente</label>
          <input
            id="nb-name"
            v-model="notebookForm.fullName"
            type="text"
            placeholder="Ej. Doña Marta del 302"
            class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink focus:border-zocalo focus:outline-none"
          />
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label for="nb-nick" class="block text-xs font-bold text-ink">Apodo (opcional)</label>
            <input
              id="nb-nick"
              v-model="notebookForm.nickname"
              type="text"
              placeholder="Ej. Reja verde"
              class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus:border-zocalo focus:outline-none"
            />
          </div>
          <div>
            <label for="nb-phone" class="block text-xs font-bold text-ink">Celular (opcional)</label>
            <input
              id="nb-phone"
              v-model="notebookForm.phoneRaw"
              type="tel"
              inputmode="tel"
              placeholder="312 456 7890"
              class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink tabular-cop focus:border-zocalo focus:outline-none"
            />
          </div>
        </div>
      </template>

      <!-- Selector de cliente cuando se abre desde Dashboard -->
      <div v-else-if="!preselectedCustomerId">
        <label for="ledger-customer" class="block text-sm font-bold text-ink">Cliente</label>
        <select
          id="ledger-customer"
          v-model="selectedCustomerId"
          class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base font-bold text-ink focus:border-zocalo focus:outline-none"
        >
          <option v-if="availableCustomers.length === 0" value="">
            No hay clientes disponibles
          </option>
          <option v-for="c in availableCustomers" :key="c.id" :value="c.id">
            {{ c.fullName }}{{ c.nickname ? ` (${c.nickname})` : '' }} · Debe {{ formatCOP(c.currentBalance) }}
          </option>
        </select>
      </div>

      <!-- Resumen del cliente elegido + atajo Saldar todo -->
      <div
        v-if="activeCustomer && mode !== 'opening_balance'"
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-extrabold text-ink">{{ activeCustomer.fullName }}</p>
          <p class="text-xs font-bold text-ink-muted tabular-cop">
            Debe hoy: {{ formatCOP(activeCustomer.currentBalance) }}
          </p>
        </div>
        <button
          v-if="mode === 'payment' && activeCustomer.currentBalance > 0"
          type="button"
          class="min-h-12 rounded-xl bg-abono-soft px-3 text-xs font-extrabold text-abono tabular-cop hover:opacity-90 cursor-pointer"
          @click="fillFullDebt"
        >
          Saldar todo ({{ formatCOP(activeCustomer.currentBalance) }})
        </button>
      </div>

      <!-- Dirección si es ajuste -->
      <div v-if="mode === 'adjustment'" class="grid grid-cols-2 gap-2">
        <button
          type="button"
          :class="[
            'min-h-12 rounded-xl border text-xs font-extrabold cursor-pointer',
            adjustmentDirection === 'decrease'
              ? 'border-abono bg-abono-soft text-abono'
              : 'border-border-strong bg-surface text-ink-muted',
          ]"
          @click="adjustmentDirection = 'decrease'"
        >
          Descuento / Condonación (-)
        </button>
        <button
          type="button"
          :class="[
            'min-h-12 rounded-xl border text-xs font-extrabold cursor-pointer',
            adjustmentDirection === 'increase'
              ? 'border-fiado bg-fiado-soft text-fiado'
              : 'border-border-strong bg-surface text-ink-muted',
          ]"
          @click="adjustmentDirection = 'increase'"
        >
          Cargo de corrección (+)
        </button>
      </div>

      <!-- Campo monetario gigante COP -->
      <div>
        <label for="ledger-amount" class="block text-sm font-bold text-ink">
          {{ mode === 'opening_balance' ? '¿Cuánto te debe en el cuaderno hoy?' : 'Monto en pesos (COP)' }}
        </label>
        <div class="relative mt-1">
          <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-2xl font-extrabold text-ink-muted">$</span>
          <input
            id="ledger-amount"
            :value="rawAmount"
            type="text"
            inputmode="numeric"
            pattern="[0-9.]*"
            placeholder="0"
            class="min-h-14 w-full rounded-xl border-2 border-border-strong bg-surface py-2.5 pl-10 pr-4 text-3xl font-extrabold tracking-tight text-ink tabular-cop focus:border-zocalo focus:outline-none"
            @input="handleAmountInput"
          />
        </div>
      </div>

      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="chip in quickChips"
          :key="chip"
          type="button"
          class="min-h-12 rounded-xl border border-border-strong bg-surface text-xs font-extrabold text-ink tabular-cop hover:bg-surface-muted cursor-pointer"
          @click="addChip(chip)"
        >
          +{{ formatInputValue(chip) }}
        </button>
      </div>

      <!-- Método de pago (obligatorio en abonos) -->
      <fieldset v-if="mode === 'payment'">
        <legend class="block text-sm font-bold text-ink">Método de pago</legend>
        <div class="mt-1.5 grid grid-cols-2 gap-2">
          <button
            v-for="m in paymentMethods"
            :key="m.id"
            type="button"
            :class="[
              'min-h-12 rounded-xl border text-sm font-extrabold cursor-pointer',
              paymentMethod === m.id
                ? 'border-zocalo bg-zocalo-soft text-zocalo'
                : 'border-border-strong bg-surface text-ink-muted',
            ]"
            @click="paymentMethod = m.id"
          >
            {{ m.label }}
          </button>
        </div>
      </fieldset>

      <!-- Vista previa del nuevo saldo -->
      <div
        v-if="activeCustomer && mode !== 'opening_balance' && parsedAmount > 0 && projectedBalance !== null"
        :class="[
          'rounded-xl border p-3 text-xs font-bold tabular-cop',
          exceedsBalance
            ? 'border-danger bg-danger-soft text-danger'
            : projectedBalance === 0
              ? 'border-abono bg-abono-soft text-abono'
              : 'border-border bg-surface text-ink',
        ]"
      >
        <template v-if="exceedsBalance">
          El abono máximo permitido es {{ formatCOP(activeCustomer.currentBalance) }}.
          <button type="button" class="ml-1 underline cursor-pointer" @click="fillFullDebt">Ajustar</button>
        </template>
        <template v-else-if="projectedBalance === 0">
          ¡Queda a paz y salvo ($ 0)!
        </template>
        <template v-else>
          Saldo actual {{ formatCOP(activeCustomer.currentBalance) }} → Queda en {{ formatCOP(projectedBalance) }}
        </template>
      </div>

      <!-- Alertas de prevención de errores (tope y monto alto) -->
      <div
        v-if="exceedsCreditLimit && activeCustomer?.creditLimit !== null"
        role="alert"
        class="space-y-2 rounded-xl border border-fiado bg-fiado-soft p-3 text-xs font-bold text-fiado"
      >
        <div class="flex items-start gap-2">
          <AlertTriangle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
          <span>Supera el tope de {{ formatCOP(activeCustomer!.creditLimit!) }}.</span>
        </div>
        <label v-if="actorRole !== 'employee'" class="flex min-h-12 cursor-pointer items-center gap-2 text-ink">
          <input v-model="confirmOverLimit" type="checkbox" class="size-4 accent-zocalo" />
          <span>Autorizo fiar por encima del tope</span>
        </label>
      </div>

      <div
        v-if="isHighAmountCOP(parsedAmount)"
        role="alert"
        class="flex items-start gap-2 rounded-xl border border-fiado bg-fiado-soft p-3 text-xs font-bold text-fiado"
      >
        <AlertTriangle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>Monto alto ({{ formatCOP(parsedAmount) }}). Verifica que no haya un cero de más.</span>
      </div>

      <!-- Motivo obligatorio (ajustes) o nota opcional -->
      <div v-if="mode === 'adjustment'">
        <label for="ledger-reason" class="block text-sm font-bold text-ink">Motivo del ajuste</label>
        <input
          id="ledger-reason"
          v-model="reason"
          type="text"
          placeholder="Ej. Descuento por pronto pago o error del cuaderno"
          class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-zocalo focus:outline-none"
        />
      </div>
      <div v-else>
        <label for="ledger-note" class="block text-sm font-bold text-ink">
          Descripción <span class="font-medium text-ink-subtle">(opcional)</span>
        </label>
        <input
          id="ledger-note"
          v-model="note"
          type="text"
          :placeholder="mode === 'payment' ? 'Ej. Pagó la hija' : mode === 'opening_balance' ? 'Ej. Cuaderno azul pág. 14' : 'Ej. Arroz, huevos y pan'"
          class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-zocalo focus:outline-none"
        />
      </div>

      <div class="flex gap-2.5 pt-1">
        <UiButton variant="secondary" size="lg" class="shrink-0 px-4" @click="rawAmount = ''">
          Limpiar
        </UiButton>
        <UiButton
          type="submit"
          :variant="mode === 'payment' ? 'abono' : mode === 'credit_sale' ? 'fiado' : 'zocalo'"
          size="lg"
          block
          class="whitespace-nowrap px-4"
          :loading="submitting"
          :disabled="parsedAmount <= 0 || exceedsBalance"
        >
          <template v-if="parsedAmount > 0">
            <span>{{ mode === 'payment' ? 'Abonar' : mode === 'credit_sale' ? 'Fiar' : 'Guardar' }}</span>
            <span class="tabular-cop">{{ formatCOP(parsedAmount) }}</span>
          </template>
          <template v-else>
            Ingresa un monto
          </template>
        </UiButton>
      </div>
    </form>
  </UiDrawer>
</template>
