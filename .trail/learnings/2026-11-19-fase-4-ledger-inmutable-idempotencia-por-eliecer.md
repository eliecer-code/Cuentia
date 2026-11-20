---
title: "Fase 4 Ledger inmutable, idempotencia por docId y candado de reversiones"
author: Eliecer
date: 2026-11-19
id: l-e7474f4d
scope: repo
status: active
src: agent
---

En `firestore.rules` y `src/features/ledger/services/ledger.service.ts`, `/stores/{storeId}/ledgerEntries/{entryId}` usa `idempotencyKey` como `documentId` para lograr idempotencia nativa atómica dentro de `runTransaction`, validando `payloadHash` contra colisiones (`CU_IDEMPOTENCY_CONFLICT`). Las reversiones crean un candado único en `/reversals/{originalEntryId}` que impide doble reversión incluso bajo concurrencia, y `customers/{id}` solo permite cambiar `currentBalance` si existe un asiento en el mismo commit.
