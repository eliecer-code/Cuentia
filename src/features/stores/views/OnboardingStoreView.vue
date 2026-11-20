<script setup lang="ts">
import { AlertCircle, MapPin } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { createStoreSchema } from '@/features/stores/schemas/store.schema'
import { normalizeError } from '@/shared/lib/errors'
import UiButton from '@/shared/ui/UiButton.vue'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const form = reactive({ name: '', phoneRaw: '' })
const fieldErrors = reactive<{ name?: string; phoneRaw?: string }>({})
const serverError = ref('')
const submitting = ref(false)

async function handleSubmit() {
  fieldErrors.name = undefined
  fieldErrors.phoneRaw = undefined
  serverError.value = ''

  const parsed = createStoreSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'phoneRaw') fieldErrors[key] = issue.message
    }
    return
  }

  if (!authStore.backendReady) {
    serverError.value = 'Configura tus variables VITE_FIREBASE_* en .env para guardar tu tienda.'
    return
  }

  submitting.value = true
  try {
    await tenantStore.createStore(parsed.data)
    await router.replace('/')
  } catch (err) {
    serverError.value = normalizeError(err).userMessage
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout title="Nombra tu tienda" subtitle="Paso 2 de 2 · Solo necesitamos el nombre de tu negocio para empezar.">
    <div class="mb-4 flex items-center gap-2" aria-label="Progreso de registro">
      <div class="h-1.5 flex-1 rounded-full bg-zocalo" />
      <div class="h-1.5 flex-1 rounded-full bg-zocalo" />
    </div>

    <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <div
        v-if="serverError"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ serverError }}</span>
      </div>

      <div>
        <label for="store-name" class="block text-sm font-bold text-ink">Nombre de la tienda</label>
        <input
          id="store-name"
          v-model="form.name"
          type="text"
          placeholder="Ej. Tienda La Esquina"
          class="mt-1.5 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
        <p v-if="fieldErrors.name" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.name }}</p>
      </div>

      <div>
        <label for="store-phone" class="block text-sm font-bold text-ink">
          WhatsApp de la tienda <span class="font-medium text-ink-subtle">(opcional)</span>
        </label>
        <div class="mt-1.5 flex">
          <span class="inline-flex min-h-12 items-center rounded-l-xl border border-r-0 border-border-strong bg-surface-muted px-3 text-sm font-extrabold text-ink tabular-cop">
            +57
          </span>
          <input
            id="store-phone"
            v-model="form.phoneRaw"
            type="tel"
            inputmode="tel"
            placeholder="312 456 7890"
            class="min-h-12 w-full rounded-r-xl border border-border-strong bg-surface px-3.5 text-base text-ink tabular-cop placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
          />
        </div>
        <p v-if="fieldErrors.phoneRaw" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.phoneRaw }}</p>
        <p v-else class="mt-1 text-xs text-ink-subtle">Aparece en los comprobantes que envíes a tus clientes.</p>
      </div>

      <div class="flex items-center gap-2 rounded-xl border border-border bg-ground px-3.5 py-2.5 text-xs font-semibold text-ink-muted">
        <MapPin class="size-4 shrink-0 text-zocalo" :stroke-width="2" aria-hidden="true" />
        <span>Configurado para Colombia · Pesos ($ COP) · Hora de Bogotá.</span>
      </div>

      <UiButton type="submit" variant="zocalo" size="lg" block :loading="submitting">
        Entrar a mi cuaderno digital
      </UiButton>
    </form>
  </AuthLayout>
</template>
