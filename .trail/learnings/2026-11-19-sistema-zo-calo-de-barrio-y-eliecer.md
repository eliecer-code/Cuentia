---
title: Sistema Zócalo de Barrio y piso táctil 48px
author: Eliecer
date: 2026-11-19
id: l-f1d31df1
scope: repo
status: active
src: agent
---

En `src/app/layouts/AppShellLayout.vue` el rail izquierdo de escritorio usa `<aside>` a altura completa con bloque interno `sticky top-0 h-dvh` porque un `<aside>` sticky de `h-dvh` dejaba un corte beige al crecer el contenido. En `src/features/dashboard/views/DashboardView.vue` y `src/shared/ui/UiDrawer.vue` todos los controles interactivos exigen `>= 48px` (`min-h-12`/`size-12`) y los CTAs de dinero `56px` en una sola línea (`whitespace-nowrap`) sin eyebrows sobre headings.
