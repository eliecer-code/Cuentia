<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-vue-next'
import { onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { forgotPasswordSchema } from '@/features/auth/schemas/auth.schema'
import { isAuthBackendAvailable, requestPasswordReset } from '@/features/auth/services/auth.service'
import { normalizeError } from '@/shared/lib/errors'
import UiButton from '@/shared/ui/UiButton.vue'

const email = ref('')
const fieldError = ref('')
const serverError = ref('')
const loading = ref(false)
const sent = ref(false)
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startCooldown() {
  cooldown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function handleSubmit() {
  fieldError.value = ''
  serverError.value = ''

  const parsed = forgotPasswordSchema.safeParse({ email: email.value })
  if (!parsed.success) {
    fieldError.value = parsed.error.issues[0]?.message ?? 'Correo inválido.'
    return
  }

  if (!isAuthBackendAvailable()) {
    serverError.value = 'Configura tus variables VITE_FIREBASE_* en .env para enviar correos de recuperación.'
    return
  }

  loading.value = true
  try {
    await requestPasswordReset(parsed.data)
    sent.value = true
    startCooldown()
  } catch (err) {
    serverError.value = normalizeError(err).userMessage
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Recuperar contraseña" subtitle="Te enviaremos un enlace seguro a tu correo para crear una contraseña nueva.">
    <div v-if="sent" class="space-y-4">
      <div class="flex items-start gap-2.5 rounded-xl border border-abono bg-abono-soft p-4 text-sm text-ink">
        <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-abono" :stroke-width="2.2" aria-hidden="true" />
        <div>
          <p class="font-extrabold text-abono">Revisa tu correo</p>
          <p class="mt-1 text-ink-muted">
            Si existe una cuenta para <strong>{{ email }}</strong>, recibirás el enlace en pocos minutos.
          </p>
        </div>
      </div>

      <UiButton
        variant="secondary"
        size="lg"
        block
        :disabled="cooldown > 0"
        :loading="loading"
        @click="handleSubmit"
      >
        {{ cooldown > 0 ? `Reenviar enlace en ${cooldown} s` : 'Reenviar enlace' }}
      </UiButton>
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
        <label for="forgot-email" class="block text-sm font-bold text-ink">Correo electrónico</label>
        <input
          id="forgot-email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="tienda@correo.com"
          class="mt-1.5 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none"
        />
        <p v-if="fieldError" class="mt-1 text-xs font-bold text-danger">{{ fieldError }}</p>
      </div>

      <UiButton type="submit" variant="zocalo" size="lg" block :loading="loading">
        Enviar enlace de recuperación
      </UiButton>
    </form>

    <div class="mt-4 text-center">
      <RouterLink
        to="/entrar"
        class="inline-flex min-h-12 items-center gap-1.5 px-3 text-sm font-bold text-zocalo hover:underline"
      >
        <ArrowLeft class="size-4" :stroke-width="2.2" aria-hidden="true" />
        <span>Volver a iniciar sesión</span>
      </RouterLink>
    </div>
  </AuthLayout>
</template>
