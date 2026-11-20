---
title: Fase 6 PWA NetworkOnly y cache particionado por userId y storeId
author: Eliecer
date: 2026-11-19
id: l-b0048b83
scope: repo
status: active
src: agent
---

En src/shared/lib/pwa.ts y public/sw.js, isFinancialOrAuthApiUrl garantiza NetworkOnly estricto para cualquier endpoint de Firebase, Google APIs o REST/RPC (cero endpoints financieros cacheados por SW). En src/shared/utils/tenantCache.ts, writeTenantCache y readTenantCache particionan las lecturas recientes por userId:storeId con TTL de 15 min y purgeAllTenantCaches limpia memoria, sessionStorage y localStorage en logout o switchStore para proteger dispositivos compartidos.
