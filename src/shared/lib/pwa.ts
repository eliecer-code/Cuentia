// ponytail: utilidades puras y verificables para guardrails del Service Worker (NetworkOnly en APIs)
// y control de inactividad en dispositivos compartidos de mostrador.

export const SHARED_DEVICE_IDLE_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Determina si una URL corresponde a un endpoint financiero o de autenticación
 * que JAMÁS debe ser cacheado por el Service Worker (`NetworkOnly` estricto).
 */
export function isFinancialOrAuthApiUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString, 'https://cuentia.app')
    const host = url.hostname.toLowerCase()
    const path = url.pathname.toLowerCase()

    if (
      host.includes('googleapis.com') ||
      host.includes('firebaseio.com') ||
      host.includes('firebaseapp.com') ||
      host.includes('gstatic.com') ||
      host.includes('google.com')
    ) {
      return true
    }

    if (
      path.startsWith('/rest/v1') ||
      path.startsWith('/auth/v1') ||
      path.startsWith('/rpc') ||
      path.startsWith('/v1/projects') ||
      path.startsWith('/__/auth')
    ) {
      return true
    }

    return false
  } catch {
    return true
  }
}

export function hasSessionExpiredByInactivity(
  lastActivityMs: number,
  nowMs: number = Date.now(),
  timeoutMs: number = SHARED_DEVICE_IDLE_TIMEOUT_MS,
): boolean {
  if (timeoutMs <= 0) return false
  return nowMs - lastActivityMs >= timeoutMs
}

export function registerCuentiaServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Fallo silencioso: la app sigue operando online-first
    })
  })
}
