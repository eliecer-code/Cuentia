import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useTenantStore } from '@/app/stores/tenant.store'
import { useUiStore } from '@/app/stores/ui.store'
import type { LoginInput, RegisterInput } from '@/features/auth/schemas/auth.schema'
import {
  getCurrentSession,
  isAuthBackendAvailable,
  signInWithPassword,
  signOutSession,
  signUpWithEmail,
  subscribeAuthState,
  type AuthUserProfile,
} from '@/features/auth/services/auth.service'
import { purgeAllTenantCaches } from '@/shared/utils/tenantCache'

let unsubscribeListener: (() => void) | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUserProfile | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const backendReady = computed(() => isAuthBackendAvailable())
  const isAuthenticated = computed(() => user.value !== null)

  function purgeClientCaches() {
    const tenantStore = useTenantStore()
    const uiStore = useUiStore()
    purgeAllTenantCaches()
    tenantStore.reset()
    uiStore.closeQuickAction()
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear()
      window.localStorage.removeItem('cuentia.activeStoreId')
    }
  }

  async function init(): Promise<void> {
    if (initialized.value) return
    loading.value = true
    try {
      const snapshot = await getCurrentSession()
      user.value = snapshot.user
      if (snapshot.user) {
        await useTenantStore().loadStores()
      }
      if (!unsubscribeListener) {
        unsubscribeListener = subscribeAuthState(async (next) => {
          const previousId = user.value?.id ?? null
          user.value = next.user
          if (!next.user) {
            purgeClientCaches()
          } else if (next.user.id !== previousId) {
            purgeClientCaches()
            await useTenantStore().loadStores()
          }
        })
      }
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function login(input: LoginInput): Promise<void> {
    loading.value = true
    try {
      const snapshot = await signInWithPassword(input)
      purgeClientCaches()
      user.value = snapshot.user
      await useTenantStore().loadStores()
    } finally {
      loading.value = false
    }
  }

  async function register(input: RegisterInput): Promise<boolean> {
    loading.value = true
    try {
      const snapshot = await signUpWithEmail(input)
      purgeClientCaches()
      user.value = snapshot.user
      if (snapshot.user) {
        await useTenantStore().loadStores()
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true
    try {
      await signOutSession()
    } finally {
      user.value = null
      purgeClientCaches()
      loading.value = false
    }
  }

  return {
    user,
    initialized,
    loading,
    backendReady,
    isAuthenticated,
    init,
    login,
    register,
    logout,
  }
})
