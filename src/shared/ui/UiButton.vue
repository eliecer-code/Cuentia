<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    variant?: 'zocalo' | 'fiado' | 'abono' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
  }>(),
  {
    variant: 'zocalo',
    size: 'lg',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
)

const variantClasses: Record<string, string> = {
  zocalo: 'bg-zocalo text-ground hover:bg-zocalo-hover active:bg-zocalo-deep border border-zocalo-deep',
  fiado: 'bg-fiado text-ground hover:bg-fiado-hover active:opacity-95 border border-fiado-hover',
  abono: 'bg-abono text-ground hover:bg-abono-hover active:opacity-95 border border-abono-hover',
  secondary: 'bg-surface text-ink hover:bg-surface-muted active:bg-border border border-border-strong',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink border border-transparent',
}

const sizeClasses: Record<string, string> = {
  md: 'min-h-12 px-4 text-sm rounded-xl',
  lg: 'min-h-14 px-5 text-base rounded-xl',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
    :class="[
      'inline-flex items-center justify-center gap-2 font-bold transition-colors duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
      variantClasses[variant],
      sizeClasses[size],
      block ? 'w-full' : '',
    ]"
  >
    <Loader2 v-if="loading" class="size-5 animate-spin shrink-0" :stroke-width="2.2" aria-hidden="true" />
    <slot />
  </button>
</template>
