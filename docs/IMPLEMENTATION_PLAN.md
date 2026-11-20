# Plan de Implementación por Fases — Cuentia (MVP)

> **Responsabilidad única (SSOT):** Secuencia de ejecución (Fases 0 a 8), dependencias, camino crítico, paralelización, riesgos y Definition of Done (DoD) por fase.  
> Referencia las reglas en [BUSINESS_RULES.md](./BUSINESS_RULES.md), el esquema en [DATABASE_DESIGN.md](./DATABASE_DESIGN.md), seguridad en [SECURITY.md](./SECURITY.md) y pruebas en [TEST_STRATEGY.md](./TEST_STRATEGY.md).

---

## 1. Camino Crítico y Principio Shift-Left

- **Camino Crítico:** `Fase 0 → Fase 1 → Fase 2 → Fase 3 (BD) → Fase 4 (Motor Ledger BD) → Fase 4 (UI) → Fase 5 → Fase 7 → Fase 8`.
- **Cuello de botella #1:** `Fase 4-BD` (ledger inmutable, `FOR UPDATE`, idempotencia y reversiones). Revisión SQL estricta antes de construir pantallas encima.
- **Ajustes Shift-Left aprobados (ADR-07):**
  - El **App Shell Mobile-First** y la dirección visual Impeccable nacen en **Fase 1** (evita retrabajo del 40 % en Fase 6).
  - La **Suite Multi-Tenant/RBAC** nace en **Fase 2** y se extiende obligatoriamente en Fases 3, 4 y 5.

---

## 2. Detalle por Fase

### Fase 0 — Descubrimiento, Definición del MVP y Documentación Base *(Actual)*
- **Objetivo:** Congelar alcance MVP, ADRs, documentación SSOT e inicializar repositorio Git + grafo `trail-code`.
- **Dependencias:** Aprobación de ADRs.
- **Entregables:** `PRODUCT.md`, `.impeccable/config.json`, 8 documentos en `/docs/`, `.gitignore`, `git init`, `trail init`.
- **Criterio de Aceptación (DoD):** Los 9 documentos coherentes y sin contradicciones; `trail` inicializado; 0 decisiones financieras bloqueantes abiertas.

### Fase 1 — Arquitectura, Scaffolding, Base Mobile-First y Supabase Local
- **Objetivo:** Levantar Vue 3 + TS strict + Tailwind + shadcn-vue/Reka UI + Pinia + Zod + Supabase CLI local + CI + dirección visual Impeccable (*Operate / code-first*).
- **Dependencias:** Fase 0.
- **Tareas Frontend:** Scaffolding `pnpm`, ESLint con reglas de fronteras `app → features → shared`, proceso Impeccable `new-work` para fijar el mundo visual de Cuentia (sin slops), App Shell mobile-first (`390×844` + desktop), utilidades `cop.ts`, `datesCO.ts`, `idempotency.ts`, `errors.ts`.
- **Tareas BD:** `supabase init`, extensiones (`pgcrypto`, `pg_trgm`, `btree_gin`, `pgtap`), esquema `private`, tests base `pgTAP` de catálogo.
- **Seguridad:** Variables de entorno limpias (cero `service_role` en frontend), escaneo de secretos en CI.
- **Pruebas:** 100 % unitarias en COP/Zod/fechas CO; `supabase db reset` + smoke `pgTAP` + smoke Playwright `390×844`; `trail build`.
- **DoD:** Entorno local operativo < 5 min; CI verde; App Shell verificado visualmente en `390×844` sin overflow horizontal; dirección visual Impeccable registrada en surface brief.
- **Riesgo:** Divergencia tipos TS/Postgres → Mitigación: generación automatizada de `database.types.ts` verificada en CI.

### Fase 2 — Autenticación, Aislamiento Multi-Tenant y Gestión de Equipo
- **Objetivo:** Registro, login, onboarding de tienda (< 2 min), multi-tienda, RBAC (`owner`/`admin`/`employee`) e invitaciones seguras.
- **Dependencias:** Fase 1.
- **Tareas Frontend:** Pantallas 1, 2 y 11; `auth.store` y `tenant.store` con purga total al cambiar tienda/logout; guards de ruta por rol.
- **Tareas BD:** Migraciones de `profiles`, `stores`, `store_memberships`, `store_invitations`, `audit_logs`; helpers `private.*`; RPCs `create_store_with_owner`, `create_invitation`, `accept_invitation`, `update_member_role`, `revoke_member`, `transfer_store_ownership`; políticas RLS completas.
- **Seguridad:** `SEC-01` a `SEC-08`, tokens de invitación SHA-256, anti-escalamiento, *Kill Switch* inmediato al revocar.
- **Pruebas:** Nacimiento de la Suite Multi-Tenant/RBAC con JWTs reales (Tienda A vs B + roles + `revokedA` + `anon`); `CL-11`; E2E onboarding + cambio tienda + logout.
- **DoD:** 0 fugas cross-tenant; revocación inmediata verificada; logout purga 100 % del estado local.
- **Riesgo:** Recursión en RLS de `store_memberships` → Mitigación: lectura propia directa + helpers en esquema `private`.

### Fase 3 — Gestión de Clientes (Base de Cartera)
- **Objetivo:** Alta rápida (< 15 s), búsqueda tolerante a tildes, homónimos/celulares compartidos, estados y blindaje de saldo.
- **Dependencias:** Fase 2.
- **Tareas Frontend:** Pantalla 4 (listado, filtros, orden) y base de Pantalla 5 (perfil); alertas de homónimos y celular compartido; estados vacíos accionables.
- **Tareas BD:** Tabla `customers` (`UNIQUE (store_id, id)`, `search_text`, índice `GIN pg_trgm`, `CHECK archived ⇒ balance = 0`, trigger bloqueando `UPDATE` directo de columnas financieras), políticas RLS y auditoría de cambios de cupo/estado.
- **Seguridad:** Imposibilidad de mutar `current_balance` o `store_id` vía PostgREST; cambios de `credit_limit`/`credit_status` restringidos a `owner`/`admin`.
- **Pruebas:** Extensión de Suite Multi-Tenant/RBAC a `customers`; `CL-08`, `CL-15`; rechazo de `PATCH current_balance`; E2E móvil de clientes.
- **DoD:** Crear/buscar cliente en ≤ 3 toques; saldo inalterable por REST; 0 fugas cross-tenant.

### Fase 4 — Motor Financiero: Fiados, Abonos, Saldos Iniciales, Reversiones y WhatsApp
- **Objetivo:** Implementar el ledger inmutable ACID, migración desde cuadernos y comprobantes WhatsApp.
- **Dependencias:** Fase 3.
- **Tareas Frontend:** Pantallas 5 (completa), 6 (`Drawer` fiado), 7 (`Drawer` abono), 8 (historial global), flujo *"Pasar cliente del cuaderno"*, máquina anti-doble-tap con `idempotency_key` persistente, vista previa editable WhatsApp (`wa.me` + comprobante PNG/Web Share) y aviso horario Ley 2300.
- **Tareas BD:** Tabla `ledger_entries` (doble FK compuesta + triple barrera de inmutabilidad); RPCs con `SELECT ... FOR UPDATE`: `create_customer_with_opening_balance`, `post_ledger_entry`, `reverse_ledger_entry`; función `reconcile_ledger()`.
- **Seguridad:** `created_by` exclusivo de `auth.uid()`; cero escritura REST al ledger; permisos diferenciados para `adjustment`, sobregiro y `reversal`.
- **Pruebas:** Concurrencia real `Promise.all` 10x (`CL-01`, `CL-02`), idempotencia + `409` (`CL-03` a `CL-05`), inmutabilidad y doble reversión (`CL-06`, `CL-07`), saldo cero/negativo (`CL-09`, `CL-10`), usuario revocado/anonimizado (`CL-12`), conciliación property-based 100+ ops, Suite Multi-Tenant en todos los RPCs, E2E móvil completo + doble clic en 3G.
- **DoD:** 0 discrepancias en `reconcile_ledger()`; 0 duplicados bajo doble clic/concurrencia; 100 % RPCs blindados cross-tenant.

### Fase 5 — Dashboard, Reportes Operativos y Configuración de Tienda
- **Objetivo:** Visibilidad financiera exacta (Stock vs Flujo) en zona horaria `America/Bogota`, morosos, exportación CSV y configuración.
- **Dependencias:** Fase 4. *(Paralelizable con Fase 6).*
- **Tareas Frontend:** Pantallas 3 (Dashboard), 9 (Reportes) y 10 (Configuración + editor de plantillas WhatsApp).
- **Tareas BD:** RPCs `get_store_dashboard_summary`, `get_period_report`, `get_overdue_customers`; verificación `EXPLAIN` con 50k asientos sintéticos.
- **Seguridad:** Exportación CSV solo `owner`; cero fugas en agregaciones; límites de rango anti-DoS.
- **Pruebas:** Cortes de medianoche `23:55 COT` vs `00:05 COT` (`CL-13`, `CL-14`); exactitud al peso (separando `adjustment` de `payment`); cross-tenant en RPCs de reportes.
- **DoD:** KPIs exactos al peso; p95 < 200 ms con 50k asientos; 0 confusión visual con ganancias.

### Fase 6 — Experiencia Móvil Avanzada, PWA y Resiliencia de Red
- **Objetivo:** PWA instalable, segura en dispositivos compartidos y resiliente a señal 3G/4G intermitente.
- **Dependencias:** Fase 4 (puede correr en paralelo al cierre de Fase 5).
- **Tareas Frontend:** `vite-plugin-pwa` con `NetworkOnly` en `/rest/v1/*`, `/auth/v1/*`, `/rpc/*`; banner honesto offline bloqueando escrituras; caché de lectura con sello de frescura purgado en logout/inactividad; auditoría táctil/contraste + pasada `impeccable detect` / `polish`.
- **Seguridad:** Cero datos de Tienda A expuestos tras cambio de usuario en dispositivo compartido.
- **Pruebas:** E2E offline/reconexión y Slow 3G; prueba de dispositivo compartido; Lighthouse móvil (Perf ≥ 85, A11y ≥ 90, PWA).
- **DoD:** Instalable en Android Chrome e iOS Safari; 0 APIs financieras cacheadas por SW; LCP < 2.5 s; `DESIGN.md` documentado desde el sistema construido.

### Fase 7 — Hardening, Pruebas Integrales, Seguridad y Estabilización (RC)
- **Objetivo:** *Feature freeze*, pruebas adversariales, observabilidad y simulacro real de recuperación ante desastres.
- **Dependencias:** Fases 5 y 6.
- **Tareas Frontend:** Corrección cross-browser (Android Chrome, iOS Safari), Sentry con scrubbing PII, headers HTTP (CSP, HSTS).
- **Tareas BD:** Auditoría catálogo SQL, carga concurrente multi-tienda, **simulacro Backup/Restore + `reconcile_ledger()`** en Staging (`CL-16`), `pg_cron` de conciliación diaria.
- **Pruebas:** 16 casos límite verificados con evidencia automatizada; 3 corridas E2E consecutivas 100 % verdes; auditoría OWASP/Supabase sin hallazgos medios/altos.
- **DoD:** Release Candidate firmado; 0 bugs críticos/altos; acta de restore y runbook de incidentes listos.

### Fase 8 — Preparación Comercial, Cumplimiento y Despliegue a Producción
- **Objetivo:** Lanzar en producción con monitoreo financiero activo, páginas legales y piloto controlado (3–5 tiendas).
- **Dependencias:** Go/No-Go de Fase 7 + revisión jurídica de textos legales.
- **Tareas Frontend:** Variables producción, dominio HTTPS en Cloudflare Pages, páginas Términos/Habeas Data, límites de plan con política ética de solo lectura.
- **Tareas BD:** Supabase Pro + PITR + respaldo externo cifrado, migraciones exclusivamente por CI/CD, alerta P1 de conciliación diaria.
- **Seguridad:** MFA en cuentas admin de infraestructura, separación estricta de secretos.
- **Pruebas:** Smoke test no destructivo en producción con Tienda QA interna + prueba en vivo de alertas.
- **DoD:** 3–5 tiendas piloto operando sin incidentes P1/P2 durante 7 días; backups/PITR y conciliación diaria en `OK`.

---

## 3. Paralelización Segura (Contract-First)

1. Al iniciar Fases 2, 3, 4 y 5 se congelan primero las firmas de RPCs, códigos `CU_*` y `database.types.ts`.
2. Con el contrato congelado, Frontend (vistas + Zod + unit tests) y QA (harness Multi-Tenant + E2E) avanzan en paralelo al cierre de BD, convergiendo siempre contra Supabase local real antes de cerrar la fase.
3. En cada fase se ejecuta `trail build` (y `trail note` para decisiones arquitectónicas no obvias) manteniendo el grafo del repositorio siempre sincronizado.
