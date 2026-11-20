import '@fontsource-variable/public-sans'
import '@/app/styles/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/app/App.vue'
import { router } from '@/app/router'
import { registerCuentiaServiceWorker } from '@/shared/lib/pwa'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
registerCuentiaServiceWorker()
