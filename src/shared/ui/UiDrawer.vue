<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

defineProps<{
  open: boolean
  title: string
  description?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ink/50" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t border-border-strong bg-ground p-5 pb-safe focus:outline-none md:inset-y-auto md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:rounded-2xl md:border"
      >
        <div class="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <DialogTitle class="text-lg font-extrabold tracking-tight text-ink">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-ink-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
            aria-label="Cerrar"
          >
            <X class="size-5" :stroke-width="2" />
          </DialogClose>
        </div>
        <div class="pt-4">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
