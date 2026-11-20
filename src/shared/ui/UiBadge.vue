<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'zocalo' | 'fiado' | 'abono' | 'neutral' | 'danger'
  }>(),
  { tone: 'neutral' },
)

const toneClasses: Record<string, string> = {
  zocalo: 'bg-zocalo-soft text-zocalo',
  fiado: 'bg-fiado-soft text-fiado',
  abono: 'bg-abono-soft text-abono',
  neutral: 'bg-surface-muted text-ink-muted',
  danger: 'bg-danger-soft text-danger',
}
</script>

<template>
  <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold tabular-cop', toneClasses[tone]]">
    <slot />
  </span>
</template>
