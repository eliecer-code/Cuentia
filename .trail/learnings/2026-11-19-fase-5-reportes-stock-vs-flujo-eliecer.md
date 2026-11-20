---
title: Fase 5 Reportes Stock vs Flujo corte Bogota y exportacion CSV
author: Eliecer
date: 2026-11-19
id: l-5576051b
scope: repo
status: active
src: agent
---

En src/features/reports/services/reports.service.ts, computePeriodReport separa el flujo del periodo (credit_sale y payment vigentes en America/Bogota) de opening_balance y adjustment, y excluye asientos con reversedByEntryId != null para que no distorsionen el cuadre de caja. buildCustomersCsv y buildLedgerCsv exigen rol owner, agregan BOM UTF-8 y neutralizan CSV Formula Injection. En src/features/stores/services/stores.service.ts, updateStoreSettings actualiza la tienda y auditLogs atomicamente.
