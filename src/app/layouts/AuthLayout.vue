<script setup lang="ts">
import { Store } from 'lucide-vue-next'

defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-zocalo text-ink">
    <div class="fixed inset-x-0 top-0 z-50 h-safe-top bg-zocalo pointer-events-none" aria-hidden="true" />
    <header class="bg-zocalo text-ground border-b-4 border-zocalo-deep px-5 pt-safe pb-6">
      <div class="mx-auto flex w-full max-w-md items-center gap-3">
        <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zocalo-deep text-zocalo-on-muted">
          <Store class="size-6" :stroke-width="2" aria-hidden="true" />
        </div>
        <div>
          <p class="text-lg font-extrabold tracking-tight text-ground">Cuentia</p>
          <p class="text-xs font-semibold text-zocalo-on-muted">Tu cuaderno de fiados, siempre claro</p>
        </div>
      </div>
    </header>

    <main class="flex flex-1 flex-col justify-center bg-ground px-4 py-6">
      <section class="mx-auto w-full max-w-md rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h1 class="text-xl font-extrabold tracking-tight text-ink">
          {{ title }}
        </h1>
        <p class="mt-1 text-sm text-ink-muted">
          {{ subtitle }}
        </p>

        <div class="mt-5">
          <slot />
        </div>
      </section>
    </main>
  </div>
</template>
