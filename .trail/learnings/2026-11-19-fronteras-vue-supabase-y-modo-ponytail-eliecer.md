---
title: Fronteras Vue + Supabase y modo Ponytail
author: Eliecer
date: 2026-11-19
id: l-3aa9efc1
scope: repo
status: active
src: agent
---

En `eslint.config.js` bloqueamos imports de `src/shared/lib/supabase.ts` (`getSupabaseClient`) desde `views/`, `components/`, `composables/` y `app/` porque Cuentia usa arquitectura Feature-Based con Pinia sin TanStack Query (ADR-02 / ponytail). Todo acceso a Supabase debe vivir en `services/` y traducir fallos con `normalizeError` en `src/shared/lib/errors.ts` para nunca exponer SQL crudo en UI.
