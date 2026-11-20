---
title: Aislamiento Multi-Tenant Fase 2 y purga síncrona de tenant
author: Eliecer
date: 2026-11-19
id: l-46c06b6f
scope: repo
status: active
src: agent
---

En `supabase/migrations/20261119000002_phase2_auth_multitenant.sql`, todas las tablas usan `FORCE ROW LEVEL SECURITY`, helpers en esquema `private` no expuesto y RPCs `SECURITY DEFINER` con `SET search_path = ''` (incluyendo `create_store_with_owner`, `create_invitation` SHA-256, `revoke_member` Kill Switch y `transfer_store_ownership`). En frontend, `switchStore` en `src/app/stores/tenant.store.ts` y `logout` en `src/app/stores/auth.store.ts` limpian `sessionStorage`, `localStorage` e incrementan `tenantEpoch` para impedir contaminación visual cross-tenant.
