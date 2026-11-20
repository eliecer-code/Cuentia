---
title: Migración de Backend a Firebase Auth + Firestore (ADR-09)
author: Eliecer
date: 2026-11-19
id: l-5708c975
scope: repo
status: active
src: agent
---

Se migró el backend de Supabase a Firebase Auth + Cloud Firestore (ADR-09). `eslint.config.js` restringe imports de `firebase/*` y `src/shared/lib/firebase.ts` exclusivamente a `src/features/*/services/*.service.ts`. El aislamiento multi-tenant, RBAC, inmutabilidad de `auditLogs` y `Kill Switch` inmediato (`status == active`) se imponen en `firestore.rules` con pruebas en `tests/integration/multitenant-rbac.test.ts` usando `@firebase/rules-unit-testing`.
