// ponytail: motor puro de política ética de planes SaaS (ADR-06).
// Garantiza por contrato que ningún vencimiento o límite de plan bloquee jamás:
// (1) consultar saldos/historial, (2) exportar CSV, ni (3) registrar abonos para recuperar cartera.

export type PlanTier = 'free' | 'pro'
export type SubscriptionLifecycleState = 'active' | 'grace_period' | 'read_only_expired'

export const FREE_PLAN_MAX_ACTIVE_CUSTOMERS = 25
export const SUBSCRIPTION_GRACE_DAYS = 7

export interface StorePlanEvaluationInput {
  planTier: PlanTier
  lifecycleState: SubscriptionLifecycleState
  activeCustomersCount: number
}

export interface StorePlanCapabilities {
  planTier: PlanTier
  lifecycleState: SubscriptionLifecycleState
  activeCustomersCount: number
  maxActiveCustomers: number | null
  canViewPortfolioAndHistory: true
  canExportCsv: true
  canRecordPayments: true
  canRecordNewCreditSales: boolean
  canCreateNewCustomer: boolean
  statusBanner: string | null
}

export function evaluateStorePlanCapabilities(
  input: StorePlanEvaluationInput,
): StorePlanCapabilities {
  const maxActiveCustomers = input.planTier === 'free' ? FREE_PLAN_MAX_ACTIVE_CUSTOMERS : null
  const isExpiredReadOnly = input.lifecycleState === 'read_only_expired'
  const withinCustomerCap =
    maxActiveCustomers === null || input.activeCustomersCount < maxActiveCustomers

  let statusBanner: string | null = null
  if (input.lifecycleState === 'grace_period') {
    statusBanner = `Tu suscripción Pro está en período de gracia (${SUBSCRIPTION_GRACE_DAYS} días). Todas las funciones siguen activas.`
  } else if (isExpiredReadOnly) {
    statusBanner =
      'Modo Solo Lectura ético activo: puedes consultar toda tu cartera, exportar tus CSV y seguir registrando abonos para cobrar tu plata. Renueva para registrar nuevos fiados.'
  } else if (!withinCustomerCap) {
    statusBanner = `Alcanzaste el tope del Plan Gratis (${FREE_PLAN_MAX_ACTIVE_CUSTOMERS} clientes activos). Tus clientes actuales pueden seguir fiando y abonando sin límite.`
  }

  return {
    planTier: input.planTier,
    lifecycleState: input.lifecycleState,
    activeCustomersCount: input.activeCustomersCount,
    maxActiveCustomers,
    // Invariantes éticas ADR-06: siempre true
    canViewPortfolioAndHistory: true,
    canExportCsv: true,
    canRecordPayments: true,
    canRecordNewCreditSales: !isExpiredReadOnly,
    canCreateNewCustomer: !isExpiredReadOnly && withinCustomerCap,
    statusBanner,
  }
}
