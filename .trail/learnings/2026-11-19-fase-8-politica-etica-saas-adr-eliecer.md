---
title: Fase 8 Politica Etica SaaS ADR-06 Marco Legal Colombia y Despliegue Firebase Hosting
author: Eliecer
date: 2026-11-19
id: l-0b088513
scope: repo
status: active
src: agent
---

En src/shared/lib/planPolicy.ts, evaluateStorePlanCapabilities garantiza que incluso en read_only_expired permanecen siempre habilitados canViewPortfolioAndHistory, canExportCsv y canRecordPayments. En src/features/settings/views/LegalComplianceView.vue (/legal) se documentan Ley 1581, Ley 2300, no entidad financiera (SFC/Ley 1266) y el compromiso etico de datos. El build de produccion se despliega a Firebase Hosting en cuentia-55460.
