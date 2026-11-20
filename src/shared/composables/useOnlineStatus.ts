import { onMounted, onUnmounted, ref } from 'vue'

// ponytail: estado singleton compartido para que todas las vistas reflejen el mismo sello
// de frescura ("Última actualización") y estado de red en tiempo real.
const sharedIsOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const sharedLastOnlineAt = ref<Date>(new Date())

export function recordDataFreshness(date: Date | string = new Date()): void {
  const parsed = typeof date === 'string' ? new Date(date) : date
  if (!Number.isNaN(parsed.getTime())) {
    sharedLastOnlineAt.value = parsed
  }
}

/**
 * Estado reactivo de conectividad del navegador.
 * En el MVP se usa para mostrar el banner honesto offline y bloquear escrituras sin señal (`ADR-06`).
 */
export function useOnlineStatus() {
  const handleOnline = () => {
    sharedIsOnline.value = true
    sharedLastOnlineAt.value = new Date()
  }

  const handleOffline = () => {
    sharedIsOnline.value = false
  }

  onMounted(() => {
    sharedIsOnline.value = typeof navigator !== 'undefined' ? navigator.onLine : true
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return {
    isOnline: sharedIsOnline,
    lastOnlineAt: sharedLastOnlineAt,
    recordDataFreshness,
  }
}
