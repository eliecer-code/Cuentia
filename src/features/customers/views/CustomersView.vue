<script setup lang="ts">
import { AlertCircle, BookOpen, Search, UserPlus, Users, X } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import CustomerFormDrawer from '@/features/customers/components/CustomerFormDrawer.vue'
import { normalizeSearchText, type CustomerFormInput } from '@/features/customers/schemas/customer.schema'
import { createCustomer, listCustomers, type CustomerItem } from '@/features/customers/services/customers.service'
import LedgerActionDrawer from '@/features/ledger/components/LedgerActionDrawer.vue'
import type { LedgerEntryItem } from '@/features/ledger/services/ledger.service'
import { useOnlineStatus } from '@/shared/composables/useOnlineStatus'
import { normalizeError } from '@/shared/lib/errors'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import { formatCOP } from '@/shared/utils/cop'

type CustomerFilter = 'with_debt' | 'all' | 'clear' | 'frozen' | 'archived'
type CustomerSort = 'highest_debt' | 'oldest_activity' | 'name_az'

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const { isOnline } = useOnlineStatus()

const customers = ref<CustomerItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const activeFilter = ref<CustomerFilter>('all')
const sortBy = ref<CustomerSort>('highest_debt')

const drawerOpen = ref(false)
const drawerInitialName = ref('')
const creating = ref(false)
const createError = ref('')
const notebookOpen = ref(false)

function handleNotebookMigrated(payload: { entry: LedgerEntryItem; newBalance: number; customer: CustomerItem }) {
  customers.value = [...customers.value, payload.customer]
}

// ponytail: datos demostrativos locales si .env aún no tiene Firebase configurado
const DEMO_CUSTOMERS: CustomerItem[] = [
  {
    id: 'demo-c1',
    storeId: 'demo',
    fullName: 'Don Carlos Pérez',
    nickname: 'El del taller',
    phoneE164: '+573124567890',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: 200_000,
    currentBalance: 185_000,
    lastLedgerSeq: 42,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'don carlos perez el del taller +573124567890',
    createdBy: 'demo',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'demo-c2',
    storeId: 'demo',
    fullName: 'Doña Marta Gómez',
    nickname: 'Casa reja verde',
    phoneE164: '+573105558899',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: 200_000,
    currentBalance: 128_500,
    lastLedgerSeq: 39,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'dona marta gomez casa reja verde +573105558899',
    createdBy: 'demo',
    createdAt: '2026-11-03T10:00:00.000Z',
  },
  {
    id: 'demo-c3',
    storeId: 'demo',
    fullName: 'Rosa Elena Castro',
    nickname: 'Panadería',
    phoneE164: '+573001112233',
    documentNumber: null,
    address: null,
    notes: null,
    whatsappOptOut: false,
    creditStatus: 'active',
    creditLimit: null,
    currentBalance: 0,
    lastLedgerSeq: 28,
    lastCreditSaleAt: null,
    lastPaymentAt: null,
    lastActivityAt: null,
    searchText: 'rosa elena castro panaderia +573001112233',
    createdBy: 'demo',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
]

async function loadCustomers() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    customers.value = DEMO_CUSTOMERS
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    customers.value = await listCustomers(storeId)
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenantEpoch, () => {
  void loadCustomers()
})

onMounted(() => {
  void loadCustomers()
})

const filterCounts = computed(() => {
  const nonArchived = customers.value.filter((c) => c.creditStatus !== 'archived')
  return {
    with_debt: nonArchived.filter((c) => c.currentBalance > 0).length,
    all: nonArchived.length,
    clear: nonArchived.filter((c) => c.currentBalance === 0 && c.creditStatus === 'active').length,
    frozen: nonArchived.filter((c) => c.creditStatus === 'frozen').length,
    archived: customers.value.filter((c) => c.creditStatus === 'archived').length,
  }
})

const filteredCustomers = computed(() => {
  const q = normalizeSearchText(searchQuery.value)
  let list = customers.value.filter((c) => {
    if (activeFilter.value === 'with_debt') return c.creditStatus !== 'archived' && c.currentBalance > 0
    if (activeFilter.value === 'clear') return c.creditStatus === 'active' && c.currentBalance === 0
    if (activeFilter.value === 'frozen') return c.creditStatus === 'frozen'
    if (activeFilter.value === 'archived') return c.creditStatus === 'archived'
    return c.creditStatus !== 'archived'
  })

  if (q) {
    list = list.filter((c) => c.searchText.includes(q))
  }

  return [...list].sort((a, b) => {
    if (sortBy.value === 'highest_debt') {
      return b.currentBalance - a.currentBalance || a.fullName.localeCompare(b.fullName, 'es')
    }
    if (sortBy.value === 'oldest_activity') {
      const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0
      const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0
      return ta - tb
    }
    return a.fullName.localeCompare(b.fullName, 'es')
  })
})

function openCreateDrawer(prefillName = '') {
  drawerInitialName.value = prefillName
  createError.value = ''
  drawerOpen.value = true
}

async function handleCreateCustomer(payload: CustomerFormInput) {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    createError.value = 'Conecta Firebase en .env para guardar clientes reales.'
    return
  }

  creating.value = true
  createError.value = ''
  try {
    const created = await createCustomer(storeId, payload)
    customers.value = [...customers.value, created]
    drawerOpen.value = false
    searchQuery.value = ''
  } catch (err) {
    createError.value = normalizeError(err).userMessage
  } finally {
    creating.value = false
  }
}

function formatShortPhone(phoneE164: string | null): string {
  if (!phoneE164) return ''
  return phoneE164.replace(/^\+57/, '')
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-3 lg:mt-0">
        <div>
          <h1 class="text-xl font-extrabold tracking-tight text-ground">Clientes</h1>
          <p class="mt-0.5 text-xs font-medium text-zocalo-on-muted tabular-cop">
            {{ filterCounts.all }} activos · {{ filterCounts.with_debt }} con deuda
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton variant="secondary" size="md" :disabled="!isOnline" @click="notebookOpen = true">
            <BookOpen class="size-4" :stroke-width="2" aria-hidden="true" />
            <span>Del cuaderno</span>
          </UiButton>
          <UiButton variant="secondary" size="md" :disabled="!isOnline" @click="openCreateDrawer()">
            <UserPlus class="size-4" :stroke-width="2.2" aria-hidden="true" />
            <span>Nuevo</span>
          </UiButton>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Buscador instantáneo -->
      <div class="relative">
        <Search class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-5 text-ink-muted" :stroke-width="2" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          aria-label="Buscar cliente"
          placeholder="Nombre, apodo o celular..."
          :class="[
            'min-h-12 w-full rounded-xl border border-border-strong bg-surface pl-11 text-base text-ink placeholder:text-ink-subtle focus:border-zocalo focus:outline-none',
            searchQuery ? 'pr-12' : 'pr-3.5',
          ]"
        />
        <button
          v-if="searchQuery"
          type="button"
          aria-label="Limpiar búsqueda"
          class="absolute inset-y-0 right-0 inline-flex size-12 items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
          @click="searchQuery = ''"
        >
          <X class="size-5" :stroke-width="2" />
        </button>
      </div>

      <!-- Filtros rápidos (>= 48px) y orden -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filtrar clientes" class="flex flex-wrap gap-1.5">
          <button
            v-for="tab in ([
              { id: 'with_debt', label: `Con deuda (${filterCounts.with_debt})` },
              { id: 'all', label: `Todos (${filterCounts.all})` },
              { id: 'clear', label: `Al día (${filterCounts.clear})` },
              { id: 'frozen', label: `Bloqueados (${filterCounts.frozen})` },
              { id: 'archived', label: `Archivados (${filterCounts.archived})` },
            ] as const)"
            :key="tab.id"
            role="tab"
            type="button"
            :aria-selected="activeFilter === tab.id"
            :class="[
              'min-h-12 rounded-xl border px-3 text-xs font-bold tabular-cop transition-colors duration-150 cursor-pointer',
              activeFilter === tab.id
                ? 'border-zocalo bg-zocalo text-ground'
                : 'border-border-strong bg-surface text-ink-muted hover:text-ink',
            ]"
            @click="activeFilter = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <select
          v-model="sortBy"
          aria-label="Ordenar clientes"
          class="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold text-ink focus:border-zocalo focus:outline-none"
        >
          <option value="highest_debt">Mayor deuda</option>
          <option value="name_az">Nombre A–Z</option>
          <option value="oldest_activity">Más antiguos</option>
        </select>
      </div>

      <!-- Listado o estados vacíos accionables -->
      <div v-if="loading" class="space-y-2.5">
        <div v-for="n in 3" :key="n" class="h-20 animate-pulse rounded-xl border border-border bg-surface" />
      </div>

      <div
        v-else-if="filteredCustomers.length === 0"
        class="rounded-xl border border-border bg-surface p-6 text-center"
      >
        <div class="mx-auto flex size-12 items-center justify-center rounded-xl bg-zocalo-soft text-zocalo">
          <Users class="size-6" :stroke-width="2" aria-hidden="true" />
        </div>

        <template v-if="searchQuery.trim()">
          <h2 class="mt-3 text-base font-extrabold text-ink">
            No encontramos a "{{ searchQuery.trim() }}"
          </h2>
          <p class="mt-1 text-sm text-ink-muted">¿Quieres anotar a esta persona como cliente nuevo?</p>
          <div class="mt-4 flex justify-center">
            <UiButton variant="zocalo" size="lg" :disabled="!isOnline" @click="openCreateDrawer(searchQuery.trim())">
              <UserPlus class="size-5" :stroke-width="2.2" aria-hidden="true" />
              <span>Crear "{{ searchQuery.trim() }}"</span>
            </UiButton>
          </div>
        </template>

        <template v-else-if="activeFilter === 'with_debt'">
          <h2 class="mt-3 text-base font-extrabold text-ink">¡Ningún cliente te debe plata!</h2>
          <p class="mt-1 text-sm text-ink-muted">Todos tus clientes activos están a paz y salvo.</p>
          <div class="mt-4 flex justify-center">
            <UiButton variant="secondary" size="md" @click="activeFilter = 'all'">
              Ver todos los clientes
            </UiButton>
          </div>
        </template>

        <template v-else>
          <h2 class="mt-3 text-base font-extrabold text-ink">Todavía no tienes clientes aquí</h2>
          <p class="mt-1 text-sm text-ink-muted">Agrega tu primer cliente en menos de 15 segundos.</p>
          <div class="mt-4 flex justify-center">
            <UiButton variant="zocalo" size="lg" :disabled="!isOnline" @click="openCreateDrawer()">
              <UserPlus class="size-5" :stroke-width="2.2" aria-hidden="true" />
              <span>Agregar primer cliente</span>
            </UiButton>
          </div>
        </template>
      </div>

      <ul v-else class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        <li v-for="customer in filteredCustomers" :key="customer.id">
          <RouterLink
            :to="`/clientes/${customer.id}`"
            class="flex min-h-[72px] items-center justify-between gap-3 px-4 py-3.5 hover:bg-ground"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-base font-extrabold text-ink">{{ customer.fullName }}</p>
                <UiBadge v-if="customer.creditStatus === 'frozen'" tone="danger">Bloqueado</UiBadge>
                <UiBadge v-else-if="customer.creditStatus === 'archived'" tone="neutral">Archivado</UiBadge>
              </div>
              <p class="mt-0.5 truncate text-xs text-ink-subtle tabular-cop">
                {{ [customer.nickname, formatShortPhone(customer.phoneE164)].filter(Boolean).join(' · ') || 'Sin referencia' }}
              </p>
            </div>

            <div class="shrink-0 text-right">
              <p v-if="customer.currentBalance > 0" class="text-lg font-extrabold text-ink tabular-cop">
                {{ formatCOP(customer.currentBalance) }}
              </p>
              <UiBadge v-else tone="abono">Paz y salvo</UiBadge>
              <p v-if="customer.creditLimit !== null" class="mt-0.5 text-xs text-ink-subtle tabular-cop">
                Tope {{ formatCOP(customer.creditLimit) }}
              </p>
            </div>
          </RouterLink>
        </li>
      </ul>
    </div>

    <CustomerFormDrawer
      :open="drawerOpen"
      mode="create"
      :existing-customers="customers"
      :initial-name="drawerInitialName"
      :can-edit-limit="tenantStore.canManageTeam || !authStore.backendReady"
      :loading="creating"
      :server-error="createError"
      @update:open="drawerOpen = $event"
      @submit="handleCreateCustomer"
    />

    <LedgerActionDrawer
      :open="notebookOpen"
      mode="opening_balance"
      :store-id="tenantStore.activeStoreId"
      :actor-role="tenantStore.activeRole"
      :backend-ready="authStore.backendReady"
      :customers="customers"
      @update:open="notebookOpen = $event"
      @completed="handleNotebookMigrated"
    />
  </AppShellLayout>
</template>
