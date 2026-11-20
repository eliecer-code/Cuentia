<script setup lang="ts">
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { acceptStoreInvitation } from '@/features/team/services/team.service'
import { normalizeError } from '@/shared/lib/errors'
import UiButton from '@/shared/ui/UiButton.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const token = String(route.params.token ?? '')
const loading = ref(false)
const accepted = ref(false)
const errorMessage = ref('')

async function handleAccept() {
  if (!authStore.isAuthenticated) {
    await router.push({ path: '/entrar', query: { redirect: route.fullPath } })
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const res = await acceptStoreInvitation(token)
    await tenantStore.loadStores()
    tenantStore.switchStore(res.storeId)
    accepted.value = true
    setTimeout(() => {
      void router.replace('/')
    }, 900)
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Invitación a una tienda" subtitle="Acepta para entrar con tu cuenta al cuaderno de fiados compartido.">
    <div v-if="accepted" class="flex items-start gap-2.5 rounded-xl border border-abono bg-abono-soft p-4 text-sm text-ink">
      <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-abono" :stroke-width="2.2" aria-hidden="true" />
      <p class="font-bold text-abono">¡Listo! Ya haces parte del equipo. Entrando a la tienda...</p>
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

      <p v-if="authStore.isAuthenticated" class="text-sm text-ink-muted">
        Entrarás con tu cuenta <strong>{{ authStore.user?.email }}</strong>.
      </p>
      <p v-else class="text-sm text-ink-muted">
        Primero inicia sesión o crea tu cuenta con el mismo correo al que te enviaron la invitación.
      </p>

      <UiButton variant="zocalo" size="lg" block :loading="loading" @click="handleAccept">
        {{ authStore.isAuthenticated ? 'Aceptar invitación' : 'Iniciar sesión para aceptar' }}
      </UiButton>

      <RouterLink
        v-if="!authStore.isAuthenticated"
        :to="{ path: '/crear-cuenta', query: { redirect: route.fullPath } }"
        class="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-muted"
      >
        Soy nuevo, crear mi cuenta
      </RouterLink>
    </div>
  </AuthLayout>
</template>
