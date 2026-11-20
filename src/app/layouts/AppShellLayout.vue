<script setup lang="ts">
import { ArrowLeftRight, Home, LogOut, MoreHorizontal, ReceiptText, ShieldCheck, Store, Users, Wifi, WifiOff } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { useUiStore } from '@/app/stores/ui.store'
import { useOnlineStatus } from '@/shared/composables/useOnlineStatus'
import { formatBogotaDateTime } from '@/shared/utils/datesCO'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const uiStore = useUiStore()
const { isOnline, lastOnlineAt } = useOnlineStatus()

const mobileNavItems = [
  { name: 'dashboard', label: 'Inicio', to: '/', icon: Home },
  { name: 'customers', label: 'Clientes', to: '/clientes', icon: Users },
  { name: 'ledger', label: 'Movimientos', to: '/movimientos', icon: ReceiptText },
  { name: 'more', label: 'Más', to: '/mas', icon: MoreHorizontal },
] as const

const desktopNavItems = computed(() => {
  const base = [
    { name: 'dashboard', label: 'Inicio', to: '/', icon: Home },
    { name: 'customers', label: 'Clientes', to: '/clientes', icon: Users },
    { name: 'ledger', label: 'Movimientos', to: '/movimientos', icon: ReceiptText },
  ]
  if (tenantStore.canManageTeam || !authStore.backendReady) {
    base.push({ name: 'team', label: 'Equipo', to: '/equipo', icon: ShieldCheck })
  }
  base.push({ name: 'more', label: 'Más', to: '/mas', icon: MoreHorizontal })
  return base
})

const storeDisplayName = computed(() => tenantStore.activeStore?.name ?? uiStore.activeStoreName)
const lastSyncLabel = computed(() => formatBogotaDateTime(lastOnlineAt.value))

function handleStoreChange(event: Event) {
  const select = event.target as HTMLSelectElement
  tenantStore.switchStore(select.value)
}

async function handleSignOut() {
  await authStore.logout()
  await router.replace('/entrar')
}
</script>

<template>
  <div class="min-h-dvh bg-zocalo text-ink lg:grid lg:grid-cols-[248px_1fr]">
    <!-- Escudo fijo superior para el safe-area de iOS PWA: evita el velo borroso claro de WebKit -->
    <div
      :class="[
        'fixed inset-x-0 top-0 z-50 h-safe-top pointer-events-none lg:hidden',
        isOnline ? 'bg-zocalo' : 'bg-fiado',
      ]"
      aria-hidden="true"
    />
    <!-- Rail lateral Zócalo en escritorio (>= 1024px) cubriendo el alto completo del documento -->
    <aside class="hidden lg:block bg-zocalo text-ground border-r-4 border-zocalo-deep">
      <div class="sticky top-0 flex h-dvh flex-col justify-between p-5">
        <div class="space-y-6">
          <div class="flex items-center gap-3 pb-4 border-b border-zocalo-deep">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zocalo-deep text-zocalo-on-muted">
              <Store class="size-5" :stroke-width="2" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-extrabold tracking-tight text-ground">
                {{ storeDisplayName }}
              </p>
              <p class="text-xs font-semibold text-zocalo-on-muted">Cuentia · Bogotá</p>
            </div>
          </div>

          <div v-if="tenantStore.stores.length > 1" class="space-y-1">
            <label for="desktop-store-switch" class="flex items-center gap-1.5 text-xs font-bold text-zocalo-on-muted">
              <ArrowLeftRight class="size-3.5" :stroke-width="2" aria-hidden="true" />
              <span>Cambiar tienda</span>
            </label>
            <select
              id="desktop-store-switch"
              :value="tenantStore.activeStoreId ?? ''"
              class="min-h-12 w-full rounded-xl border border-zocalo-deep bg-zocalo-deep px-3 text-sm font-bold text-ground focus:outline-none"
              @change="handleStoreChange"
            >
              <option v-for="s in tenantStore.stores" :key="s.storeId" :value="s.storeId">
                {{ s.name }}
              </option>
            </select>
          </div>

          <nav aria-label="Navegación principal" class="space-y-1.5">
            <RouterLink
              v-for="item in desktopNavItems"
              :key="item.name"
              :to="item.to"
              :class="[
                'flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-sm font-bold transition-colors duration-150',
                route.name === item.name
                  ? 'bg-ground text-zocalo'
                  : 'text-zocalo-on-muted hover:bg-zocalo-deep hover:text-ground',
              ]"
            >
              <component :is="item.icon" class="size-5 shrink-0" :stroke-width="2" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </nav>
        </div>

        <div class="space-y-2.5">
          <button
            v-if="authStore.isAuthenticated"
            type="button"
            class="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3.5 text-sm font-bold text-zocalo-on-muted hover:bg-zocalo-deep hover:text-ground cursor-pointer"
            @click="handleSignOut"
          >
            <LogOut class="size-4 shrink-0" :stroke-width="2" aria-hidden="true" />
            <span>Cerrar sesión</span>
          </button>

          <div class="rounded-xl bg-zocalo-deep px-3.5 py-3 text-xs">
            <div class="flex items-center gap-2 font-bold text-ground">
              <Wifi v-if="isOnline" class="size-4 text-zocalo-on-muted" :stroke-width="2" aria-hidden="true" />
              <WifiOff v-else class="size-4 text-fiado-soft" :stroke-width="2" aria-hidden="true" />
              <span>{{ isOnline ? 'En línea · Bogotá' : 'Sin conexión' }}</span>
            </div>
            <p class="mt-1 text-zocalo-on-muted">
              {{ isOnline ? 'Sincronizado en tiempo real' : `Última actualización: ${lastSyncLabel}` }}
            </p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Columna principal (móvil 390×844 y contenido desktop) -->
    <div class="flex min-h-dvh flex-col min-w-0">
      <!-- Banner honesto sin conexión (ADR-06) -->
      <div
        v-if="!isOnline"
        role="status"
        class="bg-fiado text-ground px-4 pt-safe pb-2.5 text-sm font-semibold flex items-center gap-2"
      >
        <WifiOff class="size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>Sin internet · Solo consulta ({{ lastSyncLabel }}). Necesitas señal para guardar fiados o abonos.</span>
      </div>

      <!-- Zócalo móvil superior (compacto en rutas secundarias, extendido con slot hero en Inicio) -->
      <header
        :class="[
          'bg-zocalo text-ground border-b-4 border-zocalo-deep px-4 pb-3.5 lg:px-8 lg:py-4',
          isOnline ? 'pt-safe' : 'pt-3',
        ]"
      >
        <div class="mx-auto max-w-4xl">
          <div class="flex items-center justify-between gap-2 lg:hidden">
            <div class="flex items-center gap-2 min-w-0">
              <Store class="size-4 shrink-0 text-zocalo-on-muted" :stroke-width="2" aria-hidden="true" />
              <span class="truncate text-sm font-extrabold tracking-tight">{{ storeDisplayName }}</span>
            </div>
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shrink-0',
                isOnline ? 'bg-zocalo-deep text-zocalo-on-muted' : 'bg-fiado text-ground',
              ]"
            >
              <Wifi v-if="isOnline" class="size-3.5" :stroke-width="2.2" aria-hidden="true" />
              <WifiOff v-else class="size-3.5" :stroke-width="2.2" aria-hidden="true" />
              {{ isOnline ? 'En línea · Bogotá' : 'Sin red' }}
            </span>
          </div>

          <slot name="zocalo" />
        </div>
      </header>

      <main class="flex-1 bg-ground px-4 pt-3.5 pb-4 lg:px-8 lg:py-5">
        <div class="mx-auto max-w-4xl">
          <slot />
        </div>
      </main>

      <!-- Navegación inferior táctil (Thumb Zone móvil < 1024px) -->
      <nav
        aria-label="Navegación móvil"
        class="sticky bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface pb-safe lg:hidden"
      >
        <RouterLink
          v-for="item in mobileNavItems"
          :key="item.name"
          :to="item.to"
          :class="[
            'flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors duration-150',
            route.name === item.name ? 'text-zocalo' : 'text-ink-subtle hover:text-ink',
          ]"
        >
          <span
            :class="[
              'h-1 w-6 rounded-full transition-colors duration-150',
              route.name === item.name ? 'bg-zocalo' : 'bg-transparent',
            ]"
            aria-hidden="true"
          />
          <component :is="item.icon" class="size-5" :stroke-width="route.name === item.name ? 2.4 : 2" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>
  </div>
</template>
