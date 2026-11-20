import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import type { StoreRole } from '@/shared/types/domain.types'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresStore?: boolean
    guestOnly?: boolean
    roles?: StoreRole[]
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Rutas públicas de autenticación
    {
      path: '/entrar',
      name: 'login',
      meta: { guestOnly: true },
      component: () => import('@/features/auth/views/LoginView.vue'),
    },
    {
      path: '/crear-cuenta',
      name: 'register',
      meta: { guestOnly: true },
      component: () => import('@/features/auth/views/RegisterView.vue'),
    },
    {
      path: '/recuperar-clave',
      name: 'forgot-password',
      meta: { guestOnly: true },
      component: () => import('@/features/auth/views/ForgotPasswordView.vue'),
    },
    {
      path: '/invitacion/:token',
      name: 'accept-invitation',
      component: () => import('@/features/team/views/AcceptInvitationView.vue'),
    },
    // Onboarding de tienda (autenticado, sin requerir tienda previa)
    {
      path: '/onboarding',
      name: 'onboarding',
      meta: { requiresAuth: true, requiresStore: false },
      component: () => import('@/features/stores/views/OnboardingStoreView.vue'),
    },
    // Rutas operativas de tienda
    {
      path: '/',
      name: 'dashboard',
      meta: { requiresAuth: true, requiresStore: true },
      component: () => import('@/features/dashboard/views/DashboardView.vue'),
    },
    {
      path: '/clientes',
      name: 'customers',
      meta: { requiresAuth: true, requiresStore: true },
      component: () => import('@/features/customers/views/CustomersView.vue'),
    },
    {
      path: '/clientes/:id',
      name: 'customer-detail',
      meta: { requiresAuth: true, requiresStore: true },
      component: () => import('@/features/customers/views/CustomerDetailView.vue'),
    },
    {
      path: '/movimientos',
      name: 'ledger',
      meta: { requiresAuth: true, requiresStore: true },
      component: () => import('@/features/ledger/views/LedgerView.vue'),
    },
    {
      path: '/equipo',
      name: 'team',
      meta: { requiresAuth: true, requiresStore: true, roles: ['owner', 'admin'] },
      component: () => import('@/features/team/views/TeamView.vue'),
    },
    {
      path: '/reportes',
      name: 'reports',
      meta: { requiresAuth: true, requiresStore: true },
      component: () => import('@/features/reports/views/ReportsView.vue'),
    },
    {
      path: '/configuracion',
      name: 'store-settings',
      meta: { requiresAuth: true, requiresStore: true, roles: ['owner', 'admin'] },
      component: () => import('@/features/settings/views/StoreSettingsView.vue'),
    },
    {
      path: '/mas',
      name: 'more',
      meta: { requiresAuth: true, requiresStore: true },
      component: () => import('@/features/settings/views/MoreShellView.vue'),
    },
    {
      path: '/legal',
      name: 'legal-compliance',
      component: () => import('@/features/settings/views/LegalComplianceView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()

  if (!authStore.initialized) {
    await authStore.init()
  }

  // ponytail: cuando .env no tiene Firebase configurado (preview/CI frontend aislado),
  // permitimos navegar el App Shell sin bloquear, manteniendo guardias estrictos con backend activo.
  if (!authStore.backendReady) {
    return true
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { path: '/entrar', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return tenantStore.hasStores ? '/' : '/onboarding'
  }

  if (to.meta.requiresStore && authStore.isAuthenticated) {
    if (!tenantStore.loaded) {
      await tenantStore.loadStores()
    }
    if (!tenantStore.hasStores) {
      return '/onboarding'
    }
    if (to.meta.roles && tenantStore.activeRole && !to.meta.roles.includes(tenantStore.activeRole)) {
      return '/'
    }
  }

  return true
})
