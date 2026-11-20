<script setup lang="ts">
import { AlertCircle, AlertTriangle } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { customerFormSchema, type CustomerFormInput } from '@/features/customers/schemas/customer.schema'
import { findPossibleDuplicates, type CustomerItem } from '@/features/customers/services/customers.service'
import UiButton from '@/shared/ui/UiButton.vue'
import UiDrawer from '@/shared/ui/UiDrawer.vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  existingCustomers: CustomerItem[]
  initialCustomer?: CustomerItem | null
  initialName?: string
  canEditLimit?: boolean
  loading?: boolean
  serverError?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: CustomerFormInput]
}>()

const router = useRouter()

const form = reactive({
  fullName: '',
  nickname: '',
  phoneRaw: '',
  documentNumber: '',
  address: '',
  notes: '',
  creditLimitRaw: '',
})

const fieldErrors = reactive<Partial<Record<keyof CustomerFormInput, string>>>({})
const showOptionalDetails = ref(false)
const confirmedSharedPhone = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    Object.keys(fieldErrors).forEach((k) => {
      delete fieldErrors[k as keyof CustomerFormInput]
    })
    confirmedSharedPhone.value = false

    if (props.mode === 'edit' && props.initialCustomer) {
      const c = props.initialCustomer
      form.fullName = c.fullName
      form.nickname = c.nickname ?? ''
      form.phoneRaw = c.phoneE164 ? c.phoneE164.replace(/^\+57/, '') : ''
      form.documentNumber = c.documentNumber ?? ''
      form.address = c.address ?? ''
      form.notes = c.notes ?? ''
      form.creditLimitRaw =
        c.creditLimit !== null ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(c.creditLimit) : ''
      showOptionalDetails.value = Boolean(c.documentNumber || c.address || c.notes || c.creditLimit !== null)
    } else {
      form.fullName = props.initialName ?? ''
      form.nickname = ''
      form.phoneRaw = ''
      form.documentNumber = ''
      form.address = ''
      form.notes = ''
      form.creditLimitRaw = ''
      showOptionalDetails.value = false
    }
  },
)

const duplicates = computed(() =>
  findPossibleDuplicates(props.existingCustomers, form.fullName, form.phoneRaw, props.initialCustomer?.id),
)

function handleCreditLimitInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  if (!digits) {
    form.creditLimitRaw = ''
    return
  }
  const num = Number(digits)
  form.creditLimitRaw = Number.isSafeInteger(num)
    ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num)
    : form.creditLimitRaw
}

function goToExisting(customerId: string) {
  emit('update:open', false)
  void router.push(`/clientes/${customerId}`)
}

function handleSubmit() {
  Object.keys(fieldErrors).forEach((k) => {
    delete fieldErrors[k as keyof CustomerFormInput]
  })

  const parsed = customerFormSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof CustomerFormInput | undefined
      if (key) fieldErrors[key] = issue.message
    }
    return
  }

  if (duplicates.value.samePhone.length > 0 && !confirmedSharedPhone.value) {
    return
  }

  emit('submit', parsed.data)
}
</script>

<template>
  <UiDrawer
    :open="open"
    :title="mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'"
    :description="mode === 'create' ? 'Solo el nombre es obligatorio. Agrega apodo o celular si quieres ubicarlo más rápido.' : 'Actualiza los datos de contacto o el tope de fiado.'"
    @update:open="emit('update:open', $event)"
  >
    <form class="max-h-[75dvh] space-y-3.5 overflow-y-auto pr-0.5" novalidate @submit.prevent="handleSubmit">
      <div
        v-if="serverError"
        role="alert"
        class="flex items-start gap-2 rounded-xl border border-danger bg-danger-soft p-3 text-xs font-bold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ serverError }}</span>
      </div>

      <div>
        <label for="cust-fullname" class="block text-sm font-bold text-ink">Nombre completo</label>
        <input
          id="cust-fullname"
          v-model="form.fullName"
          type="text"
          autocomplete="name"
          placeholder="Ej. Doña Marta Gómez"
          class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
        <p v-if="fieldErrors.fullName" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.fullName }}</p>
      </div>

      <!-- Alerta suave de homónimos (no bloquea, invita a usar apodo) -->
      <div
        v-if="duplicates.sameName.length > 0"
        class="rounded-xl border border-fiado bg-fiado-soft p-3 text-xs text-ink"
      >
        <p class="font-extrabold text-fiado">
          Ya existe {{ duplicates.sameName.length === 1 ? 'un cliente' : `${duplicates.sameName.length} clientes` }} con ese nombre:
        </p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="dup in duplicates.sameName"
            :key="dup.id"
            type="button"
            class="min-h-10 rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-bold text-zocalo hover:bg-zocalo-soft cursor-pointer"
            @click="goToExisting(dup.id)"
          >
            Abrir {{ dup.fullName }}{{ dup.nickname ? ` (${dup.nickname})` : '' }}
          </button>
        </div>
        <p class="mt-1.5 text-ink-muted">Si es otra persona del barrio, agrega un apodo para distinguirla.</p>
      </div>

      <div>
        <label for="cust-nickname" class="block text-sm font-bold text-ink">
          Apodo o referencia <span class="font-medium text-ink-subtle">(opcional)</span>
        </label>
        <input
          id="cust-nickname"
          v-model="form.nickname"
          type="text"
          placeholder="Ej. Casa reja verde / Taxista"
          class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
      </div>

      <div>
        <label for="cust-phone" class="block text-sm font-bold text-ink">
          WhatsApp / Celular <span class="font-medium text-ink-subtle">(opcional)</span>
        </label>
        <div class="mt-1 flex">
          <span class="inline-flex min-h-12 items-center rounded-l-xl border border-r-0 border-border-strong bg-surface-muted px-3 text-sm font-extrabold text-ink tabular-cop">
            +57
          </span>
          <input
            id="cust-phone"
            v-model="form.phoneRaw"
            type="tel"
            inputmode="tel"
            placeholder="312 456 7890"
            class="min-h-12 w-full rounded-r-xl border border-border-strong bg-surface px-3.5 text-base text-ink tabular-cop placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
          />
        </div>
        <p v-if="fieldErrors.phoneRaw" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.phoneRaw }}</p>
      </div>

      <!-- Alerta fuerte por teléfono repetido (permite escape explícito para hogares con 1 solo WhatsApp) -->
      <div
        v-if="duplicates.samePhone.length > 0"
        role="alert"
        class="space-y-2 rounded-xl border border-fiado bg-fiado-soft p-3 text-xs text-ink"
      >
        <div class="flex items-start gap-2 font-bold text-fiado">
          <AlertTriangle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
          <span>
            Este celular ya pertenece a <strong>{{ duplicates.samePhone[0]?.fullName }}</strong>.
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-12 rounded-xl border border-zocalo bg-surface px-3 text-xs font-bold text-zocalo cursor-pointer"
            @click="goToExisting(duplicates.samePhone[0]!.id)"
          >
            Ir al cliente existente
          </button>
        </div>
        <label class="flex min-h-12 cursor-pointer items-center gap-2 font-semibold text-ink">
          <input v-model="confirmedSharedPhone" type="checkbox" class="size-4 accent-zocalo" />
          <span>Es un familiar que comparte el mismo celular, guardar igual</span>
        </label>
      </div>

      <button
        type="button"
        class="inline-flex min-h-12 items-center text-xs font-extrabold text-zocalo hover:underline cursor-pointer"
        @click="showOptionalDetails = !showOptionalDetails"
      >
        {{ showOptionalDetails ? 'Ocultar datos opcionales' : '+ Agregar cédula, dirección o tope de fiado' }}
      </button>

      <div v-if="showOptionalDetails" class="space-y-3 rounded-xl border border-border bg-surface p-3.5">
        <div v-if="canEditLimit">
          <label for="cust-limit" class="block text-xs font-bold text-ink">Tope de fiado (COP)</label>
          <div class="relative mt-1">
            <span class="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-extrabold text-ink-muted">$</span>
            <input
              id="cust-limit"
              :value="form.creditLimitRaw"
              type="text"
              inputmode="numeric"
              placeholder="Sin tope"
              class="min-h-12 w-full rounded-xl border border-border-strong bg-surface pl-8 pr-3.5 text-base font-bold text-ink tabular-cop focus:border-zocalo focus:outline-none"
              @input="handleCreditLimitInput"
            />
          </div>
          <p v-if="fieldErrors.creditLimitRaw" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.creditLimitRaw }}</p>
        </div>

        <div>
          <label for="cust-doc" class="block text-xs font-bold text-ink">Cédula / ID (opcional)</label>
          <input
            id="cust-doc"
            v-model="form.documentNumber"
            type="text"
            inputmode="numeric"
            placeholder="Ej. 1023456789"
            class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink tabular-cop focus:border-zocalo focus:outline-none"
          />
        </div>

        <div>
          <label for="cust-address" class="block text-xs font-bold text-ink">Dirección (opcional)</label>
          <input
            id="cust-address"
            v-model="form.address"
            type="text"
            placeholder="Ej. Calle 12 # 4-18"
            class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-zocalo focus:outline-none"
          />
        </div>

        <div>
          <label for="cust-notes" class="block text-xs font-bold text-ink">Nota interna (opcional)</label>
          <input
            id="cust-notes"
            v-model="form.notes"
            type="text"
            placeholder="Ej. Paga los sábados"
            class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-zocalo focus:outline-none"
          />
        </div>
      </div>

      <UiButton
        type="submit"
        variant="zocalo"
        size="lg"
        block
        :loading="loading"
        :disabled="duplicates.samePhone.length > 0 && !confirmedSharedPhone"
      >
        {{ mode === 'create' ? 'Guardar cliente' : 'Guardar cambios' }}
      </UiButton>
    </form>
  </UiDrawer>
</template>
