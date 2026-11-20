<script setup lang="ts">
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Store,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { useUiStore } from '@/app/stores/ui.store'
import { updateStoreSettingsSchema } from '@/features/stores/schemas/store.schema'
import {
  listStoreAuditLogs,
  updateStoreSettings,
  type StoreAuditLogItem,
} from '@/features/stores/services/stores.service'
import { useOnlineStatus } from '@/shared/composables/useOnlineStatus'
import {
  buildBalanceReminderMessage,
  DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
} from '@/shared/lib/whatsapp'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import { formatCOP, parseCOPInput } from '@/shared/utils/cop'
import { formatBogotaDateTime } from '@/shared/utils/datesCO'

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const uiStore = useUiStore()
const { isOnline } = useOnlineStatus()

const name = ref('')
const phoneRaw = ref('')
const defaultLimitDigits = ref('')
const allowOverLimit = ref(true)
const employeeCanReverseMinutes = ref(0)
const whatsappReminderTemplate = ref(DEFAULT_WHATSAPP_REMINDER_TEMPLATE)

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const auditLogs = ref<StoreAuditLogItem[]>([])

const parsedDefaultLimit = computed<number | null>(() => {
  const n = parseCOPInput(defaultLimitDigits.value)
  return n !== null && n > 0 ? n : null
})

const effectiveRole = computed(() => {
  if (!authStore.backendReady) return tenantStore.activeRole ?? 'owner'
  return tenantStore.activeRole
})

const canEditSettings = computed(() => effectiveRole.value === 'owner' || effectiveRole.value === 'admin')

const reverseWindowOptions = [
  { minutes: 0, label: 'Desactivado (Solo propietario / admin)' },
  { minutes: 15, label: '15 minutos (Solo registro propio)' },
  { minutes: 30, label: '30 minutos (Solo registro propio)' },
  { minutes: 60, label: '60 minutos (Solo registro propio)' },
]

const defaultLimitPresets = [100_000, 200_000, 500_000]

function hydrateFormFromStore() {
  const store = tenantStore.activeStore
  name.value = store?.name ?? uiStore.activeStoreName ?? 'Tienda La Esquina'
  phoneRaw.value = store?.phoneE164 ? store.phoneE164.replace(/^\+57/, '') : '3124567890'
  defaultLimitDigits.value = store?.defaultCreditLimit ? String(store.defaultCreditLimit) : '200000'
  allowOverLimit.value = store?.allowOverLimit ?? true
  employeeCanReverseMinutes.value = store?.employeeCanReverseMinutes ?? 0
  whatsappReminderTemplate.value = store?.whatsappReminderTemplate ?? DEFAULT_WHATSAPP_REMINDER_TEMPLATE
}

async function loadAuditHistory() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    auditLogs.value = [
      {
        id: 'demo-audit-1',
        action: 'store.created',
        actorRole: 'owner',
        entityType: 'store',
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    ]
    return
  }
  auditLogs.value = await listStoreAuditLogs(storeId, 8)
}

watch(() => tenantStore.tenantEpoch, () => {
  hydrateFormFromStore()
  void loadAuditHistory()
})

onMounted(() => {
  hydrateFormFromStore()
  void loadAuditHistory()
})

function handleLimitInput(event: Event) {
  const target = event.target as HTMLInputElement
  defaultLimitDigits.value = target.value.replace(/\D/g, '').slice(0, 9)
}

function insertTemplateToken(token: '{cliente}' | '{tienda}' | '{saldo}') {
  whatsappReminderTemplate.value = `${whatsappReminderTemplate.value} ${token}`.trim()
}

function resetTemplate() {
  whatsappReminderTemplate.value = DEFAULT_WHATSAPP_REMINDER_TEMPLATE
}

const liveTemplatePreview = computed(() =>
  buildBalanceReminderMessage({
    storeName: name.value.trim() || 'Tienda La Esquina',
    customerName: 'Don Carlos Pérez',
    currentBalance: 185_000,
    customTemplate: whatsappReminderTemplate.value,
  }),
)

async function handleSave() {
  if (isSubmitting.value || !canEditSettings.value) return
  errorMessage.value = null
  successMessage.value = null

  const parsed = updateStoreSettingsSchema.safeParse({
    name: name.value,
    phoneRaw: phoneRaw.value,
    defaultCreditLimit: parsedDefaultLimit.value,
    allowOverLimit: allowOverLimit.value,
    employeeCanReverseMinutes: employeeCanReverseMinutes.value,
    whatsappReminderTemplate: whatsappReminderTemplate.value,
  })

  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? 'Revisa los campos de configuración.'
    return
  }

  isSubmitting.value = true
  try {
    const storeId = tenantStore.activeStoreId ?? 'demo'
    const role = effectiveRole.value ?? 'owner'
    const updated = await updateStoreSettings(storeId, role, parsed.data)

    if (tenantStore.activeStoreId) {
      tenantStore.applyStoreSettingsUpdate(tenantStore.activeStoreId, updated)
    } else {
      uiStore.activeStoreName = updated.name
    }

    successMessage.value = 'Configuración de la tienda guardada y registrada en auditoría.'
    if (!authStore.backendReady) {
      auditLogs.value = [
        {
          id: `demo-audit-${Date.now()}`,
          action: 'store.settings_updated',
          actorRole: role,
          entityType: 'store',
          createdAt: new Date().toISOString(),
        },
        ...auditLogs.value,
      ]
    } else {
      await loadAuditHistory()
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'No pudimos guardar la configuración.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 flex items-center gap-2.5 lg:mt-0">
        <RouterLink
          to="/mas"
          class="inline-flex size-12 items-center justify-center rounded-xl border border-zocalo-border bg-zocalo-deep text-ground hover:bg-zocalo"
          aria-label="Volver a Más opciones"
        >
          <ArrowLeft class="size-5" :stroke-width="2.2" aria-hidden="true" />
        </RouterLink>
        <div>
          <h1 class="text-xl font-extrabold tracking-tight text-ground">
            Configuración de tienda
          </h1>
          <p class="text-xs font-medium text-zocalo-on-muted">
            Datos del negocio, reglas de fiado y plantilla de WhatsApp
          </p>
        </div>
      </div>
    </template>

    <form class="space-y-5" novalidate @submit.prevent="handleSave">
      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3.5 text-xs font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>

      <div
        v-if="successMessage"
        role="status"
        class="flex items-start gap-2.5 rounded-xl border border-abono bg-abono-soft p-3.5 text-xs font-bold text-abono"
      >
        <CheckCircle2 class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ successMessage }}</span>
      </div>

      <!-- 1. Datos de la tienda + Bloque fijo Colombia -->
      <section aria-labelledby="store-data-heading" class="space-y-3.5 rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center gap-2">
          <Store class="size-5 text-zocalo" :stroke-width="2" aria-hidden="true" />
          <h2 id="store-data-heading" class="text-sm font-extrabold text-ink">
            Datos del negocio
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label for="settings-store-name" class="block text-xs font-bold text-ink">
              Nombre de la tienda
            </label>
            <input
              id="settings-store-name"
              v-model="name"
              type="text"
              :disabled="!canEditSettings"
              class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm font-bold text-ink focus:border-zocalo focus:outline-none"
            />
          </div>

          <div>
            <label for="settings-store-phone" class="block text-xs font-bold text-ink">
              Celular / WhatsApp de la tienda (+57)
            </label>
            <input
              id="settings-store-phone"
              v-model="phoneRaw"
              type="tel"
              inputmode="tel"
              placeholder="Ej. 312 456 7890"
              :disabled="!canEditSettings"
              class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm font-semibold text-ink tabular-cop focus:border-zocalo focus:outline-none"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs text-ink-muted">
          <div class="flex items-center gap-2">
            <Globe class="size-4 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <span class="font-bold text-ink">Configuración regional fija:</span>
          </div>
          <span class="font-semibold tabular-cop">
            Colombia · Pesos (COP sin centavos) · Hora Bogotá (America/Bogota, UTC-5)
          </span>
        </div>
      </section>

      <!-- 2. Reglas de fiado y mostrador -->
      <section aria-labelledby="credit-rules-heading" class="space-y-4 rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center gap-2">
          <ShieldCheck class="size-5 text-zocalo" :stroke-width="2" aria-hidden="true" />
          <h2 id="credit-rules-heading" class="text-sm font-extrabold text-ink">
            Reglas de fiado y permisos en mostrador
          </h2>
        </div>

        <div>
          <label for="settings-default-limit" class="block text-xs font-bold text-ink">
            Tope de fiado sugerido para clientes nuevos (COP, opcional)
          </label>
          <input
            id="settings-default-limit"
            :value="defaultLimitDigits"
            type="text"
            inputmode="numeric"
            placeholder="Sin tope por defecto"
            :disabled="!canEditSettings"
            class="mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base font-extrabold text-ink tabular-cop focus:border-zocalo focus:outline-none"
            @input="handleLimitInput"
          />
          <p class="mt-1 text-xs font-bold text-zocalo tabular-cop">
            {{ parsedDefaultLimit ? `Tope sugerido: ${formatCOP(parsedDefaultLimit)}` : 'Sin tope obligatorio por defecto' }}
          </p>

          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="preset in defaultLimitPresets"
              :key="preset"
              type="button"
              :disabled="!canEditSettings"
              class="min-h-12 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-extrabold text-ink tabular-cop hover:bg-surface cursor-pointer"
              @click="defaultLimitDigits = String(preset)"
            >
              {{ formatCOP(preset) }}
            </button>
            <button
              type="button"
              :disabled="!canEditSettings"
              class="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold text-ink-muted hover:bg-surface-muted cursor-pointer"
              @click="defaultLimitDigits = ''"
            >
              Sin tope
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3.5">
          <div>
            <p class="text-xs font-extrabold text-ink">
              Permitir sobregiro por encima del tope con confirmación
            </p>
            <p class="mt-0.5 text-xs text-ink-muted">
              Si lo desactivas, el tope opera como bloqueo duro cuando el cliente alcanza su cupo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="allowOverLimit"
            :disabled="!canEditSettings"
            :class="[
              'min-h-12 min-w-24 rounded-xl border px-3 text-xs font-extrabold cursor-pointer',
              allowOverLimit
                ? 'border-zocalo bg-zocalo text-ground'
                : 'border-border-strong bg-surface text-ink',
            ]"
            @click="allowOverLimit = !allowOverLimit"
          >
            {{ allowOverLimit ? 'Permitido' : 'Bloqueo duro' }}
          </button>
        </div>

        <div>
          <p class="text-xs font-bold text-ink">
            Ventana para que empleados anulen un error propio recién registrado
          </p>
          <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="opt in reverseWindowOptions"
              :key="opt.minutes"
              type="button"
              :disabled="!canEditSettings"
              :class="[
                'flex min-h-12 items-center justify-between rounded-xl border px-3.5 text-left text-xs font-bold cursor-pointer',
                employeeCanReverseMinutes === opt.minutes
                  ? 'border-zocalo bg-zocalo-soft text-zocalo'
                  : 'border-border-strong bg-surface text-ink hover:bg-surface-muted',
              ]"
              @click="employeeCanReverseMinutes = opt.minutes"
            >
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 3. Plantilla de recordatorio WhatsApp con vista previa -->
      <section aria-labelledby="wa-template-heading" class="space-y-3.5 rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <MessageCircle class="size-5 text-abono" :stroke-width="2" aria-hidden="true" />
            <h2 id="wa-template-heading" class="text-sm font-extrabold text-ink">
              Plantilla de recordatorio por WhatsApp
            </h2>
          </div>

          <button
            type="button"
            :disabled="!canEditSettings"
            class="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold text-ink-muted hover:bg-surface-muted cursor-pointer"
            @click="resetTemplate"
          >
            <RotateCcw class="size-3.5" :stroke-width="2.2" aria-hidden="true" />
            <span>Restaurar original</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold text-ink-muted">Insertar variable:</span>
          <button
            type="button"
            :disabled="!canEditSettings"
            class="min-h-12 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-extrabold text-ink cursor-pointer"
            @click="insertTemplateToken('{cliente}')"
          >
            + {cliente}
          </button>
          <button
            type="button"
            :disabled="!canEditSettings"
            class="min-h-12 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-extrabold text-ink cursor-pointer"
            @click="insertTemplateToken('{tienda}')"
          >
            + {tienda}
          </button>
          <button
            type="button"
            :disabled="!canEditSettings"
            class="min-h-12 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-extrabold text-ink cursor-pointer"
            @click="insertTemplateToken('{saldo}')"
          >
            + {saldo}
          </button>
        </div>

        <div>
          <label for="settings-wa-template" class="block text-xs font-bold text-ink">
            Texto del mensaje
          </label>
          <textarea
            id="settings-wa-template"
            v-model="whatsappReminderTemplate"
            rows="5"
            :disabled="!canEditSettings"
            class="mt-1 w-full rounded-xl border border-border-strong bg-surface p-3 text-sm font-medium text-ink focus:border-zocalo focus:outline-none"
          />
        </div>

        <div class="rounded-xl border border-border bg-surface-muted p-3.5">
          <p class="text-xs font-extrabold text-ink">
            Vista previa con cliente de ejemplo (Don Carlos Pérez · $ 185.000)
          </p>
          <pre class="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink">{{ liveTemplatePreview }}</pre>
        </div>
      </section>

      <!-- 4. Bitácora de auditoría reciente -->
      <section aria-labelledby="audit-heading" class="rounded-xl border border-border bg-surface p-4">
        <h2 id="audit-heading" class="text-sm font-extrabold text-ink">
          Bitácora de auditoría reciente
        </h2>
        <ul v-if="auditLogs.length > 0" class="mt-2.5 divide-y divide-border">
          <li
            v-for="log in auditLogs"
            :key="log.id"
            class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
          >
            <div class="flex items-center gap-2">
              <UiBadge tone="neutral">{{ log.actorRole }}</UiBadge>
              <span class="font-bold text-ink">{{ log.action }}</span>
            </div>
            <span class="text-ink-subtle tabular-cop">{{ formatBogotaDateTime(log.createdAt) }}</span>
          </li>
        </ul>
        <p v-else class="mt-2 text-xs text-ink-muted">
          Aún no hay eventos adicionales en la bitácora de esta tienda.
        </p>
      </section>

      <UiButton
        type="submit"
        variant="zocalo"
        size="lg"
        block
        :loading="isSubmitting"
        :disabled="!isOnline || !canEditSettings"
      >
        Guardar configuración
      </UiButton>
    </form>
  </AppShellLayout>
</template>
