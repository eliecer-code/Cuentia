---
title: Fase 7 Hardening RC 4 invariantes de conciliacion Tombstone Habeas Data y PII scrubber
author: Eliecer
date: 2026-11-19
id: l-6245f9a1
scope: repo
status: active
src: agent
---

En src/features/ledger/services/ledger.service.ts, reconcileCustomerEntries y reconcileStorePortfolio verifican las 4 invariantes contables (suma exacta, secuencia continua #seq, cadena balanceAfter y paridad/anti-doble-reversion) y applyHabeasDataTombstonesToSnapshot re-aplica anonimizaciones ARCO tras un restore preservando saldos. En src/shared/lib/errors.ts, scrubPiiText y scrubTelemetryPayload redactan correos, celulares +57, tokens Bearer y llaves API.
