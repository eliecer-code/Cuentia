<script setup lang="ts">
import { AlertTriangle, Check, Copy, Download, MessageCircle } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import {
  buildWhatsAppUrl,
  renderReceiptPngBlob,
  shouldShowCollectionHoursWarning,
} from '@/shared/lib/whatsapp'
import UiButton from '@/shared/ui/UiButton.vue'
import UiDrawer from '@/shared/ui/UiDrawer.vue'

const props = defineProps<{
  open: boolean
  title: string
  phoneE164: string | null
  whatsappOptOut?: boolean
  initialMessage: string
  isCollectionReminder?: boolean
  receiptImagePayload?: {
    storeName: string
    customerName: string
    title: string
    amountLabel: string
    subtitle: string
    balanceAfter: number
    dateLabel: string
    seqLabel?: string
  } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const message = ref('')
const copied = ref(false)
const sharingImage = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      message.value = props.initialMessage
      copied.value = false
    }
  },
)

const showHoursWarning = computed(
  () => Boolean(props.isCollectionReminder) && shouldShowCollectionHoursWarning(),
)

const whatsAppHref = computed(() => buildWhatsAppUrl(props.phoneE164, message.value))

async function copyMessage() {
  await navigator.clipboard.writeText(message.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

async function shareOrDownloadImage() {
  if (!props.receiptImagePayload) return
  sharingImage.value = true
  try {
    const blob = await renderReceiptPngBlob(props.receiptImagePayload)
    if (!blob) return

    const file = new File([blob], 'comprobante-cuentia.png', { type: 'image/png' })
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Comprobante Cuentia' })
      return
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'comprobante-cuentia.png'
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    sharingImage.value = false
  }
}
</script>

<template>
  <UiDrawer
    :open="open"
    :title="title"
    description="Revisa o ajusta el mensaje antes de abrir WhatsApp."
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-3.5">
      <div
        v-if="whatsappOptOut"
        role="alert"
        class="flex items-start gap-2 rounded-xl border border-danger bg-danger-soft p-3 text-xs font-bold text-danger"
      >
        <AlertTriangle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>Este cliente pidió no recibir recordatorios por WhatsApp. Envía solo si él te solicitó el comprobante ahora.</span>
      </div>

      <div
        v-if="showHoursWarning"
        role="status"
        class="flex items-start gap-2 rounded-xl border border-fiado bg-fiado-soft p-3 text-xs font-bold text-fiado"
      >
        <AlertTriangle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>Horario preventivo (Ley 2300): fuera de L–V 7 a.m.–7 p.m. o Sáb 8 a.m.–3 p.m. Te sugerimos enviar recordatorios de cobro en horario hábil.</span>
      </div>

      <div>
        <label for="wa-preview-msg" class="block text-xs font-extrabold uppercase tracking-wider text-ink-muted">
          Mensaje para WhatsApp
        </label>
        <textarea
          id="wa-preview-msg"
          v-model="message"
          rows="6"
          class="mt-1.5 w-full rounded-xl border border-abono bg-abono-soft/60 p-3 text-sm text-ink focus:border-zocalo focus:outline-none"
        />
      </div>

      <a
        :href="whatsAppHref"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-abono px-4 text-base font-bold text-ground hover:bg-abono-hover"
      >
        <MessageCircle class="size-5 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ phoneE164 ? 'Abrir en WhatsApp' : 'Elegir contacto en WhatsApp' }}</span>
      </a>

      <div class="grid grid-cols-2 gap-2.5">
        <UiButton variant="secondary" size="md" block @click="copyMessage">
          <Check v-if="copied" class="size-4 text-abono" :stroke-width="2.4" aria-hidden="true" />
          <Copy v-else class="size-4" :stroke-width="2" aria-hidden="true" />
          <span>{{ copied ? 'Copiado' : 'Copiar texto' }}</span>
        </UiButton>

        <UiButton
          v-if="receiptImagePayload"
          variant="secondary"
          size="md"
          block
          :loading="sharingImage"
          @click="shareOrDownloadImage"
        >
          <Download class="size-4" :stroke-width="2" aria-hidden="true" />
          <span>Imagen PNG</span>
        </UiButton>
      </div>
    </div>
  </UiDrawer>
</template>
