import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useUiStore } from '@/app/stores/ui.store'
import {
  createStoreWithOwner,
  fetchMyStores,
  type UserStoreSummary,
} from '@/features/stores/services/stores.service'
import type { CreateStoreInput } from '@/features/stores/schemas/store.schema'
import type { StoreRole } from '@/shared/types/domain.types'
import { purgeAllTenantCaches } from '@/shared/utils/tenantCache'

const STORAGE_KEY = 'cuentia.activeStoreId'

export const useTenantStore = defineStore('tenant', () => {
  const stores = ref<UserStoreSummary[]>([])
  const activeStoreId = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  /** Contador incremental que cualquier vista observa para purgar estado local al cambiar de tienda. */
  const tenantEpoch = ref(0)

  const activeStore = computed<UserStoreSummary | null>(
    () => stores.value.find((s) => s.storeId === activeStoreId.value) ?? null,
  )
  const activeRole = computed<StoreRole | null>(() => activeStore.value?.role ?? null)
  const hasStores = computed(() => stores.value.length > 0)
  const isOwner = computed(() => activeRole.value === 'owner')
  const canManageTeam = computed(() => activeRole.value === 'owner' || activeRole.value === 'admin')

  function syncUiStoreName() {
    const uiStore = useUiStore()
    if (activeStore.value) {
      uiStore.activeStoreName = activeStore.value.name
    }
  }

  async function loadStores(): Promise<void> {
    loading.value = true
    try {
      const list = await fetchMyStores()
      stores.value = list
      const remembered = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      const validRemembered = list.find((s) => s.storeId === remembered)?.storeId ?? null
      activeStoreId.value = validRemembered ?? list[0]?.storeId ?? null
      if (activeStoreId.value && typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, activeStoreId.value)
      }
      syncUiStoreName()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function switchStore(nextStoreId: string): boolean {
    if (nextStoreId === activeStoreId.value) return true
    const exists = stores.value.some((s) => s.storeId === nextStoreId)
    if (!exists) return false

    // Purga síncrona de contexto cross-tenant (`SEC-02`, `RF-03`)
    purgeAllTenantCaches()
    activeStoreId.value = nextStoreId
    tenantEpoch.value += 1
    useUiStore().closeQuickAction()
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextStoreId)
      window.sessionStorage.clear()
    }
    syncUiStoreName()
    return true
  }

  async function createStore(input: CreateStoreInput): Promise<UserStoreSummary> {
    const created = await createStoreWithOwner(input)
    stores.value = [...stores.value, created]
    switchStore(created.storeId)
    loaded.value = true
    return created
  }

  function applyStoreSettingsUpdate(
    storeId: string,
    patch: Partial<Pick<UserStoreSummary, 'name' | 'phoneE164' | 'defaultCreditLimit' | 'allowOverLimit' | 'employeeCanReverseMinutes' | 'whatsappReminderTemplate'>>,
  ) {
    stores.value = stores.value.map((s) => (s.storeId === storeId ? { ...s, ...patch } : s))
    syncUiStoreName()
  }

  function reset() {
    purgeAllTenantCaches()
    stores.value = []
    activeStoreId.value = null
    loaded.value = false
    tenantEpoch.value += 1
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    stores,
    activeStoreId,
    activeStore,
    activeRole,
    hasStores,
    isOwner,
    canManageTeam,
    loaded,
    loading,
    tenantEpoch,
    loadStores,
    switchStore,
    createStore,
    applyStoreSettingsUpdate,
    reset,
  }
})
