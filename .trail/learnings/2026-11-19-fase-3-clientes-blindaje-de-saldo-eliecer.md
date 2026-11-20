---
title: "Fase 3 Clientes: blindaje de saldo y duplicados en Firestore"
author: Eliecer
date: 2026-11-19
id: l-29fd9712
scope: repo
status: active
src: agent
---

En `firestore.rules` la subcolección `/stores/{storeId}/customers/{customerId}` bloquea cualquier mutación de `currentBalance` y `lastLedgerSeq` en updates CRUD, exige `currentBalance == 0` para archivar (`BR-16`), restringe `creditLimit`/`creditStatus` a `owner`/`admin` y prohíbe `delete`. En frontend (`CustomerFormDrawer.vue` y `customers.service.ts`), `findPossibleDuplicates` advierte homónimos y celulares compartidos con confirmación explícita para hogares sin bloquear creación.
