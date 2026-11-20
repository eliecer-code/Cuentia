# Estrategia de Pruebas y Calidad — Cuentia

> **Responsabilidad única (SSOT):** Pirámide de pruebas adaptada a Vue 3 + Supabase, suites obligatorias de integridad financiera y aislamiento multi-tenant, matriz verificable de casos límite y compuertas de CI/CD.

---

## 1. Pirámide de Pruebas (Reforzada en Base de Datos y Seguridad)

```text
          [ E2E Playwright: Móvil 390×844 + Desktop 1280×800 ]    (~15%)
       [ Suite Seguridad Multi-Tenant & RBAC (JWTs reales) ]      (~20%)
     [ Integración DB: pgTAP + Vitest contra Supabase Local ]     (~35%)
   [ Unitarias: Vitest (Zod, COP, Fechas CO, Composables) ]       (~30%)
```

---

## 2. Capas de Prueba

### 2.1 Unitarias (Vitest)
- **Validadores Zod:** enteros COP seguros (`> 0`, rechazo de decimales, `NaN`, `0`, negativos), teléfonos Colombia (`+573XXXXXXXXX`), `idempotency_key` UUID y enums cerrados.
- **Formateo y parseo COP:** salida `es-CO` sin decimales, limpieza de separadores, cero punto flotante.
- **Fechas Colombia (`America/Bogota`):** `vi.useFakeTimers` probando cortes de `23:59:59 COT` (`04:59:59Z`) y `00:00:00 COT` (`05:00:00Z`), rangos Hoy/Ayer/Semana/Mes.
- **Lógica pura de UI:** persistencia y reutilización de `idempotency_key` ante reintentos, bloqueo de doble envío y generación de enlaces `wa.me`.

### 2.2 Integración de Base de Datos (`pgTAP` + Vitest contra Supabase Local)
- **Auditoría automática de catálogo (`pgTAP`):**
  - 100 % tablas en `public` con `relrowsecurity = true` y `relforcerowsecurity = true`.
  - 0 funciones `SECURITY DEFINER` sin `search_path` explícito.
  - 0 funciones expuestas con `EXECUTE` para `PUBLIC`/`anon`.
  - 0 vistas sin `security_invoker = true`.
  - 0 políticas RLS referenciando `user_metadata`.
  - 0 privilegios `INSERT/UPDATE/DELETE` directos sobre `ledger_entries` para `authenticated`/`anon`.
- **Motor financiero ACID:**
  - Concurrencia real (`Promise.all` con 2–10 operaciones simultáneas sobre el mismo cliente): cero deadlocks, cero *lost updates*, secuencia contigua y saldo exacto (`CL-01`, `CL-02`).
  - Idempotencia secuencial y paralela + error `409` ante payload mutado (`CL-03` a `CL-05`).
  - Inmutabilidad del ledger (`UPDATE`/`DELETE` rechazados por RLS y trigger) + bloqueo de doble reversión y reversión de reversión (`CL-06`).
  - Conciliación property-based: 100+ operaciones aleatorias con semilla fija finalizando con `reconcile_ledger()` en `0` discrepancias (`BR-08`).

### 2.3 Suite de Aislamiento Multi-Tenant y RBAC (JWTs Reales)
Fixtures reales en `auth.users`: Tienda A (`ownerA`, `adminA`, `employeeA`, `revokedA`), Tienda B (`ownerB`, `employeeB`), `orphanUser` y `anon`.

**Pruebas negativas obligatorias (18 escenarios):**
1. Lectura REST masiva y filtrada de Tienda A hacia `store_id = B` → `0` filas.
2. IDOR por UUID conocido de cliente/asiento de Tienda B → `0` filas.
3. Inyección de `store_id = B` en `POST`/`PATCH` o intento de cambiar `store_id` propio → rechazado.
4. `POST`/`PATCH`/`DELETE` directo en `/rest/v1/ledger_entries` incluso como `ownerA` → denegado.
5. Llamadas `anon` y `orphanUser` sobre tablas y RPCs → denegadas 100 %.
6. RPCs financieros y de reportes invocados como `ownerA` con `p_store_id = B` → rechazado.
7. Referencia cruzada en RPC (`p_store_id = A`, `p_customer_id = cliente_B`) → rechazado por validación y FK compuesta.
8. Llamada directa vía `/rest/v1/rpc/` a helpers de esquema `private` → `404`/`403`.
9. Manipulación de `user_metadata` inyectando `role: 'owner'` y `store_id: B` → ignorado y rechazado.
10. Auto-escalamiento de `employee`/`admin` a `owner` → rechazado.
11. `admin` intentando suspender/degradar al `owner` o exportar base completa → rechazado.
12. `employee` intentando editar `credit_limit`, autorizar sobregiro, crear `adjustment`, revertir (con config default) o leer `audit_logs` → rechazado.
13. **Sesión zombie (`revokedA`):** reutilizar JWT válido inmediatamente después de revocar membresía → rechazo inmediato en lecturas y RPCs.
14. Secuestro de invitación por otro usuario o reuso de token consumido/expirado → rechazado.
15. Invariante *Last Owner Standing*: único `owner` intentando degradarse/salir → rechazado.
16. Manipulación directa de `customers.current_balance` vía `PATCH` REST → bloqueado.
17. Fuga cross-tenant en búsquedas por texto, top deudores y reportes agregados → `0` filas/valores de Tienda B.
18. Dispositivo compartido: Usuario A cierra sesión y Usuario B inicia sesión → cero datos cacheados de A.

### 2.4 Pruebas E2E (Playwright: `390×844` y `1280×800`)
Flujos ejecutados contra build de producción + Supabase local:
1. Onboarding completo (2 pasos) sin scroll horizontal móvil.
2. Migración de cliente con saldo inicial de cuaderno (`opening_balance`) y persistencia tras reload.
3. Ciclo completo: fiado → abono parcial → abono total (`Paz y salvo`) → verificación de KPIs.
4. Reversión con motivo obligatorio (asiento original marcado como anulado, botón bloqueado, saldo restaurado).
5. Compartir comprobante por WhatsApp (verificación de enlace `wa.me/57...`, monto COP y nombre de tienda).
6. Cambio de tienda activa + logout con verificación de limpieza total de memoria/storage.
7. Doble tap bajo red lenta (throttling 3G / latencia 2500 ms) → 1 solo movimiento en BD.
8. Modo offline y reconexión → banner honesto, bloqueo de escritura y refresco automático al volver señal.

---

## 3. Compuertas de CI/CD

| Evento | Checks Obligatorios (Bloqueantes) |
| :--- | :--- |
| **Cada Pull Request** | ESLint (fronteras) + `vue-tsc` + schema drift + Vitest unitarias + `supabase db reset` + `pgTAP` + Integración DB + Suite Multi-Tenant/RBAC + `trail build --check` (cuando haya código). |
| **Merge a `staging` / `main`** | Todo lo anterior + Playwright E2E (`390×844` + desktop) + verificación de auditoría visual Impeccable en cambios UI. |
| **Release Candidate (Fase 7)** | 3 corridas consecutivas verdes de E2E + matriz `CL-01` a `CL-16` verificada + simulacro de Backup/Restore + `reconcile_ledger() = 0` + Lighthouse móvil (Perf ≥ 85, A11y ≥ 90, PWA). |
