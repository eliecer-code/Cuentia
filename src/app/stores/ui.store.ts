import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DashboardPeriod } from '@/shared/utils/datesCO'

export const useUiStore = defineStore('ui', () => {
  const activeStoreName = ref('Tienda La Esquina')
  const selectedPeriod = ref<DashboardPeriod>('today')
  const quickActionSheet = ref<'fiado' | 'abono' | null>(null)

  function openQuickAction(kind: 'fiado' | 'abono') {
    quickActionSheet.value = kind
  }

  function closeQuickAction() {
    quickActionSheet.value = null
  }

  return {
    activeStoreName,
    selectedPeriod,
    quickActionSheet,
    openQuickAction,
    closeQuickAction,
  }
})
