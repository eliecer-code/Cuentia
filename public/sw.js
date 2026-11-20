// ponytail: Service Worker nativo sin dependencias de Workbox.
// Garantiza NetworkOnly estricto para cualquier endpoint financiero/Auth (Firebase, Google APIs, REST/RPC)
// y solo cachea el App Shell estático (HTML/CSS/JS/WOFF2/SVG), con purga explícita en logout/switchStore.

const SHELL_CACHE_NAME = 'cuentia-shell-v3'
const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.svg', '/icon-512.svg']

function isFinancialOrAuthApi(urlString) {
  try {
    const url = new URL(urlString)
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // 1. Cero caché para mutaciones o APIs financieras / autenticación (NetworkOnly estricto)
  if (request.method !== 'GET' || isFinancialOrAuthApi(request.url)) {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  // 2. Navegación SPA: Network-First con fallback a /index.html precacheado
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match('/index.html')
          return cached || Response.error()
        }),
    )
    return
  }

  // 3. Assets estáticos del mismo origen (JS, CSS, fuentes, íconos): Stale-While-Revalidate
  if (/\.(?:js|css|woff2?|svg|png|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached)

        return cached || networkPromise
      }),
    )
  }
})
