<script setup lang="ts">
import { AlertCircle, Eye, EyeOff } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { loginSchema } from '@/features/auth/schemas/auth.schema'
import { normalizeError } from '@/shared/lib/errors'
import UiButton from '@/shared/ui/UiButton.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const form = reactive({ email: '', password: '' })
const fieldErrors = reactive<{ email?: string; password?: string }>({})
const serverError = ref('')
const showPassword = ref(false)

async function handleSubmit() {
  fieldErrors.email = undefined
  fieldErrors.password = undefined
  serverError.value = ''

  const parsed = loginSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'email' || key === 'password') fieldErrors[key] = issue.message
    }
    return
  }

  if (!authStore.backendReady) {
    serverError.value = 'Configura tus variables VITE_FIREBASE_* en .env para iniciar sesión con Firebase.'
    return
  }

  try {
    await authStore.login(parsed.data)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    if (redirect) {
      await router.replace(redirect)
      return
    }
    await router.replace(tenantStore.hasStores ? '/' : '/onboarding')
  } catch (err) {
    serverError.value = normalizeError(err).userMessage
  }
}
</script>

<template>
  <AuthLayout title="Entrar a tu tienda" subtitle="Ingresa con tu correo y contraseña para ver tus cuentas.">
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
        <label for="login-email" class="block text-sm font-bold text-ink">Correo electrónico</label>
        <input
          id="login-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="doncarlos@correo.com"
          class="mt-1.5 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
        <p v-if="fieldErrors.email" class="mt-1 text-xs font-bold text-danger">{{ fieldErrors.email }}</p>
      </div>

      <div>
        <label for="login-password" class="block text-sm font-bold text-ink">Contraseña</label>
        <div class="relative mt-1.5">
          <input
            id="login-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Tu contraseña"
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
      </div>

      <UiButton type="submit" variant="zocalo" size="lg" block :loading="authStore.loading">
        Entrar a mi tienda
      </UiButton>

      <div class="flex flex-col items-center gap-2 pt-2 text-center">
        <RouterLink
          to="/recuperar-clave"
          class="inline-flex min-h-12 items-center px-3 text-sm font-bold text-zocalo hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </RouterLink>
        <p class="text-sm text-ink-muted">
          ¿Eres nuevo?
          <RouterLink
            :to="{ path: '/crear-cuenta', query: route.query }"
            class="inline-flex min-h-12 items-center px-1.5 font-extrabold text-zocalo hover:underline"
          >
            Crea tu tienda gratis
          </RouterLink>
        </p>
      </div>
    </form>
  </AuthLayout>
</template>
