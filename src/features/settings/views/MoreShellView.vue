<script setup lang="ts">
import {
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  LogIn,
  LogOut,
  Scale,
  Settings,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { useOnlineStatus } from '@/shared/composables/useOnlineStatus'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import { formatBogotaDateTime } from '@/shared/utils/datesCO'
import { purgeAllTenantCaches } from '@/shared/utils/tenantCache'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const { isOnline, lastOnlineAt } = useOnlineStatus()
const cachePurgedNotice = ref<string | null>(null)

const lastSyncLabel = computed(() => formatBogotaDateTime(lastOnlineAt.value))

function handleSwitch(storeId: string) {
  tenantStore.switchStore(storeId)
}

function handlePurgeSharedDeviceCache() {
  purgeAllTenantCaches()
  cachePurgedNotice.value = 'Datos temporales de lectura eliminados de este dispositivo.'
}

async function handleSignOut() {
  await authStore.logout()
  await router.replace('/entrar')
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <h1 class="mt-2.5 text-xl font-extrabold tracking-tight text-ground lg:mt-0">
        Más opciones
      </h1>
    </template>

    <div class="space-y-4">
      <!-- Selector de tienda activa (multi-tienda) -->
      <section v-if="tenantStore.stores.length > 1" aria-labelledby="switch-store-heading">
        <h2 id="switch-store-heading" class="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
          Tus tiendas
        </h2>
        <div class="space-y-2 rounded-xl border border-border bg-surface p-3.5">
          <div class="flex items-center gap-2 text-xs font-bold text-ink-muted">
            <ArrowLeftRight class="size-4 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <span>Toca una tienda para cambiar de cuenta (limpia los datos temporales)</span>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="store in tenantStore.stores"
              :key="store.storeId"
              type="button"
              :class="[
                'flex min-h-12 items-center justify-between rounded-xl border px-3.5 text-left text-sm font-bold cursor-pointer',
                store.storeId === tenantStore.activeStoreId
                  ? 'border-zocalo bg-zocalo-soft text-zocalo'
                  : 'border-border-strong bg-surface text-ink hover:bg-surface-muted',
              ]"
              @click="handleSwitch(store.storeId)"
            >
              <span class="truncate">{{ store.name }}</span>
              <span class="text-xs uppercase">{{ store.role }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Menú de módulos -->
      <ul class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        <li v-if="tenantStore.canManageTeam || !authStore.backendReady">
          <RouterLink
            to="/equipo"
            class="flex min-h-16 items-center justify-between gap-3 p-4 hover:bg-surface-muted"
          >
            <div class="flex items-start gap-3.5">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zocalo-soft text-zocalo">
                <ShieldCheck class="size-5" :stroke-width="2" aria-hidden="true" />
              </div>
              <div>
                <h2 class="text-sm font-extrabold text-ink">Equipo y empleados</h2>
                <p class="mt-0.5 text-xs text-ink-muted">Invita colaboradores por WhatsApp, asigna roles o revoca accesos al instante.</p>
              </div>
            </div>
            <ChevronRight class="size-5 shrink-0 text-ink-subtle" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </li>

        <li>
          <RouterLink
            to="/reportes"
            class="flex min-h-16 items-center justify-between gap-3 p-4 hover:bg-surface-muted"
          >
            <div class="flex items-start gap-3.5">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zocalo-soft text-zocalo">
                <BarChart3 class="size-5" :stroke-width="2" aria-hidden="true" />
              </div>
              <div>
                <h2 class="text-sm font-extrabold text-ink">Reportes y morosos</h2>
                <p class="mt-0.5 text-xs text-ink-muted">Flujo del período, cuadre por Nequi/Daviplata/Efectivo, cartera vencida y CSV.</p>
              </div>
            </div>
            <ChevronRight class="size-5 shrink-0 text-ink-subtle" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </li>

        <li v-if="tenantStore.canManageTeam || !authStore.backendReady">
          <RouterLink
            to="/configuracion"
            class="flex min-h-16 items-center justify-between gap-3 p-4 hover:bg-surface-muted"
          >
            <div class="flex items-start gap-3.5">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zocalo-soft text-zocalo">
                <Settings class="size-5" :stroke-width="2" aria-hidden="true" />
              </div>
              <div>
                <h2 class="text-sm font-extrabold text-ink">Configuración de tienda</h2>
                <p class="mt-0.5 text-xs text-ink-muted">Datos de tu tienda, plantillas de WhatsApp y reglas de tope de fiado.</p>
              </div>
            </div>
            <ChevronRight class="size-5 shrink-0 text-ink-subtle" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </li>

        <li>
          <RouterLink
            to="/onboarding"
            class="flex min-h-16 items-center justify-between gap-3 p-4 hover:bg-surface-muted"
          >
            <div class="flex items-start gap-3.5">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zocalo-soft text-zocalo">
                <Store class="size-5" :stroke-width="2" aria-hidden="true" />
              </div>
              <div>
                <h2 class="text-sm font-extrabold text-ink">Crear otra tienda</h2>
                <p class="mt-0.5 text-xs text-ink-muted">Registra un nuevo negocio completamente aislado con sus propios clientes.</p>
              </div>
            </div>
            <ChevronRight class="size-5 shrink-0 text-ink-subtle" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </li>

        <li>
          <RouterLink
            to="/legal"
            class="flex min-h-16 items-center justify-between gap-3 p-4 hover:bg-surface-muted"
          >
            <div class="flex items-start gap-3.5">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zocalo-soft text-zocalo">
                <Scale class="size-5" :stroke-width="2" aria-hidden="true" />
              </div>
              <div>
                <h2 class="text-sm font-extrabold text-ink">Marco legal Colombia y tus datos</h2>
                <p class="mt-0.5 text-xs text-ink-muted">Ley 1581 (Habeas Data), Ley 2300 y garantía ética de acceso libre a tu cartera.</p>
              </div>
            </div>
            <ChevronRight class="size-5 shrink-0 text-ink-subtle" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>

      <!-- Dispositivo compartido, PWA y frescura de datos (Fase 6) -->
      <section aria-labelledby="pwa-shared-device-heading" class="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Smartphone class="size-5 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <h2 id="pwa-shared-device-heading" class="text-sm font-extrabold text-ink">
              Dispositivo en mostrador y red
            </h2>
          </div>
          <UiBadge :tone="isOnline ? 'abono' : 'fiado'">
            {{ isOnline ? 'En línea · Bogotá' : 'Sin internet · Solo consulta' }}
          </UiBadge>
        </div>

        <p class="text-xs text-ink-muted">
          Última actualización de datos: <strong class="font-bold text-ink tabular-cop">{{ lastSyncLabel }}</strong>.
          Sin señal puedes consultar saldos recientes; para registrar fiados o abonos necesitas conexión activa.
        </p>

        <div v-if="cachePurgedNotice" role="status" class="rounded-xl border border-abono bg-abono-soft p-3 text-xs font-bold text-abono">
          {{ cachePurgedNotice }}
        </div>

        <UiButton variant="secondary" size="md" block @click="handlePurgeSharedDeviceCache">
          <Trash2 class="size-4" :stroke-width="2" aria-hidden="true" />
          <span>Limpiar caché de mostrador</span>
        </UiButton>
      </section>

      <!-- Sesión -->
      <div class="pt-1">
        <UiButton v-if="authStore.isAuthenticated" variant="secondary" size="lg" block @click="handleSignOut">
          <LogOut class="size-5" :stroke-width="2" aria-hidden="true" />
          <span>Cerrar sesión ({{ authStore.user?.email }})</span>
        </UiButton>
        <RouterLink
          v-else
          to="/entrar"
          class="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-base font-bold text-ink hover:bg-surface-muted"
        >
          <LogIn class="size-5" :stroke-width="2" aria-hidden="true" />
          <span>Iniciar sesión / Crear cuenta</span>
        </RouterLink>
      </div>
    </div>
  </AppShellLayout>
</template>
