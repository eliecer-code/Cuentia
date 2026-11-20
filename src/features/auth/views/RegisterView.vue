<script setup lang="ts">
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { registerSchema } from '@/features/auth/schemas/auth.schema'
import { normalizeError } from '@/shared/lib/errors'
import UiButton from '@/shared/ui/UiButton.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ fullName: '', email: '', password: '' })
const fieldErrors = reactive<{ fullName?: string; email?: string; password?: string }>({})
const serverError = ref('')
const showPassword = ref(false)
const needsEmailConfirmation = ref(false)

async function handleSubmit() {
  fieldErrors.fullName = undefined
  fieldErrors.email = undefined
  fieldErrors.password = undefined
  serverError.value = ''

  const parsed = registerSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'fullName' || key === 'email' || key === 'password') fieldErrors[key] = issue.message
    }
    return
  }

  if (!authStore.backendReady) {
    serverError.value = 'Configura tus variables VITE_FIREBASE_* en .env para crear tu cuenta.'
    return
  }

  try {
    const signedIn = await authStore.register(parsed.data)
    if (!signedIn) {
      needsEmailConfirmation.value = true
      return
    }
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    await router.replace(redirect ?? '/onboarding')
  } catch (err) {
    serverError.value = normalizeError(err).userMessage
  }
}
</script>

<template>
  <AuthLayout title="Crea tu cuenta" subtitle="Paso 1 de 2 · En menos de 2 minutos tendrás tu cuaderno digital listo.">
    <div class="mb-4 flex items-center gap-2" aria-label="Progreso de registro">
      <div class="h-1.5 flex-1 rounded-full bg-zocalo" />
      <div class="h-1.5 flex-1 rounded-full bg-surface-muted" />
    </div>

    <div
      v-if="needsEmailConfirmation"
      class="space-y-4 rounded-xl border border-abono bg-abono-soft p-4 text-sm text-ink"
    >
      <div class="flex items-start gap-2.5">
        <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-abono" :stroke-width="2.2" aria-hidden="true" />
        <div>
          <p class="font-extrabold text-abono">Revisa tu correo electrónico</p>
          <p class="mt-1 text-ink-muted">
            Enviamos un enlace de confirmación a <strong>{{ form.email }}</strong>. Ábrelo y luego inicia sesión para nombrar tu tienda.
          </p>
        </div>
      </div>
      <RouterLink
        to="/entrar"
        class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-zocalo px-4 text-sm font-bold text-ground hover:bg-zocalo-hover"
      >
        Ir a iniciar sesión
      </RouterLink>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <div
        v-if="serverError"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ serverError }}</span>
      </div>

      <div>
        <label for="reg-name" class="block text-sm font-bold text-ink">Tu nombre</label>
        <input
          id="reg-name"
          v-model="form.fullName"
          type="text"
          autocomplete="name"
          placeholder="Ej. Marta Rodríguez"
          class="mt-1.5 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
        <p v-if="fieldErrors.fullName" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.fullName }}</p>
      </div>

      <div>
        <label for="reg-email" class="block text-sm font-bold text-ink">Correo electrónico</label>
        <input
          id="reg-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="tienda@correo.com"
          class="mt-1.5 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
        <p v-if="fieldErrors.email" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.email }}</p>
      </div>

      <div>
        <label for="reg-password" class="block text-sm font-bold text-ink">Contraseña</label>
        <div class="relative mt-1.5">
          <input
            id="reg-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Mínimo 10 caracteres"
            class="min-h-12 w-full rounded-xl border border-border-strong bg-surface pl-3.5 pr-14 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 inline-flex size-12 items-center justify-center rounded-r-xl text-ink-muted hover:text-ink cursor-pointer"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-5" :stroke-width="2" />
            <Eye v-else class="size-5" :stroke-width="2" />
          </button>
        </div>
        <p v-if="fieldErrors.password" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.password }}</p>
        <p v-else class="mt-1 text-xs text-ink-subtle">Usa al menos 10 caracteres para proteger las cuentas de tu tienda.</p>
      </div>

      <UiButton type="submit" variant="zocalo" size="lg" block :loading="authStore.loading">
        Continuar al paso 2
      </UiButton>

      <p class="pt-1 text-center text-sm text-ink-muted">
        ¿Ya tienes cuenta?
        <RouterLink
          :to="{ path: '/entrar', query: route.query }"
          class="inline-flex min-h-12 items-center px-1.5 font-extrabold text-zocalo hover:underline"
        >
          Entrar
        </RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>
