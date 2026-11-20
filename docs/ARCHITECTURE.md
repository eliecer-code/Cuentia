# Arquitectura Técnica — Cuentia

> **Responsabilidad única (SSOT):** Decisiones arquitectónicas (`ADR-*`), estructura modular del frontend Vue 3, fronteras de comunicación con Supabase, manejo centralizado de errores, estrategia PWA y CI/CD.  
> El esquema SQL vive en [DATABASE_DESIGN.md](./DATABASE_DESIGN.md); RLS y cumplimiento en [SECURITY.md](./SECURITY.md); el orden de entrega en [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

---

## 1. Decisiones Arquitectónicas Aprobadas (`ADR-*`)

| ID | Decisión | Justificación y Trade-off |
| :--- | :--- | :--- |
| **ADR-01** | **Bloqueo por defecto de sobrepagos (`allow_negative_balance = false`)** | Evita errores de ceros en COP en mostrador (`$200.000` vs `$20.000`). Esquema preparado con `BIGINT` con signo para habilitar *opt-in* por tienda en el futuro. |
| **ADR-02** | **Feature-Based Modular + Solo Pinia y Composables Nativos** | En Supabase + PostgreSQL la verdad de dominio reside en BD; Clean Architecture OOP añade ceremonia innecesaria en Vue 3. Con `/ponytail` activo, se omite `@tanstack/vue-query` para evitar dependencias extra: Pinia gestiona sesión/tienda/caché mínima reactiva y los composables encapsulan carga, invalidación y estado de red. |
| **ADR-03** | **Roles `owner`, `admin` y `employee` desde Fase 2** | Evita que tiendas familiares compartan la contraseña del dueño sin trazabilidad en el ledger. |
| **ADR-04** | **Reversión por empleados desactivada por defecto + `adjustment` separado** | `employee_can_reverse_minutes = 0` por defecto (configurable). `adjustment` (`owner`/`admin`) separa descuentos/condonaciones del recaudo real en efectivo. |
| **ADR-05** | **Ledger inmutable con `BIGINT` COP y RPCs ACID** | Cero punto flotante, precisión exacta, bloqueo por fila `FOR UPDATE`, `idempotency_key` y `business_date` en `America/Bogota`. |
| **ADR-06** | **PWA Online-First Resiliente + Modo Solo Lectura Ético** | Escrituras financieras bloqueadas sin internet en MVP (cero riesgo de evicción de IndexedDB/divergencia multi-cajero). Ante vencimiento de suscripción nunca se secuestran consultas, exportaciones ni abonos. |
| **ADR-07** | **Shift-Left Mobile-First y Seguridad** | App Shell mobile-first nace en Fase 1 y la suite Multi-Tenant/RBAC nace en Fase 2 (no postergados a Fases 6–7). |
| **ADR-08** | **Disciplina `/ponytail` (full) + Grafo `trail-code`** | YAGNI estricto: cero abstracciones especulativas, cero dependencias evitables, simplificaciones intencionales marcadas con `// ponytail:`. El grafo estructural (`trail`) y aprendizajes en `.trail/` se mantienen actualizados desde Fase 0. |
| **ADR-09** | **Cambio de Backend a Firebase (Auth + Cloud Firestore)** | Adoptado por decisión del propietario del producto en Fase 2. Permite operar en el plan Spark sin Docker ni pausas por inactividad, manteniendo aislamiento multi-tenant jerárquico (`/stores/{storeId}/...`), validación en servidor vía `firestore.rules` (lectura en tiempo real de `members/{uid}.status == 'active'`), ledger inmutable (`allow update, delete: if false;`), idempotencia nativa usando `idempotencyKey` como `documentId` y transacciones ACID (`runTransaction` / `writeBatch`). Solo `src/shared/lib/firebase.ts` y `src/features/*/services/*.service.ts` importan Firebase (verificado por ESLint). |

---

## 2. Arquitectura Frontend (Vue 3 Feature-Based)

### 2.1 Estructura de Carpetas

```text
src/
├── app/                         # Bootstrapping y composición global
│   ├── main.ts
│   ├── App.vue
│   ├── layouts/                 # AppShellLayout (BottomNav móvil + Sidebar desktop), AuthLayout
│   ├── router/                  # Rutas y guards (auth, activeStore, roleGuard)
│   └── stores/                  # auth.store.ts, tenant.store.ts, ui.store.ts
├── features/                    # Módulos verticales aislados (sin imports cruzados internos)
│   ├── auth/                    # Login, registro, recuperación de contraseña
│   ├── stores/                  # Onboarding tienda (2 pasos), selector multi-tienda
│   ├── customers/               # Directorio, búsqueda, alta rápida, perfil, estados
│   ├── ledger/                  # Fiado, abono, saldo inicial, reversión, ajuste, historial, WhatsApp
│   ├── dashboard/               # KPIs stock vs flujo, top deudores, recientes
│   ├── reports/                 # Períodos, desglose por método de pago, morosos, CSV
│   ├── settings/                # Configuración tienda, reglas fiado, plantillas WhatsApp
│   └── team/                    # Empleados, invitaciones, roles, transferencia de propiedad
│       └── <feature>/           # Crear solo subcarpetas realmente necesarias (YAGNI)
│           ├── components/      # Componentes presentacionales (props in, emits out)
│           ├── views/           # Vistas conectadas a rutas
│           ├── composables/     # Orquestación reactiva, estados de carga/error, invalidación
│           ├── services/        # Único punto que invoca el cliente Supabase
│           ├── schemas/         # Validaciones Zod + DTOs derivados
│           └── routes.ts
└── shared/                      # Código transversal agnóstico del dominio
    ├── ui/                      # Primitivas shadcn-vue / Reka UI
    ├── lib/                     # supabase.ts, errors.ts, whatsapp.ts
    ├── utils/                   # cop.ts, datesCO.ts, idempotency.ts
    ├── types/                   # database.types.ts (AUTO-GENERADO), appError.ts
    └── composables/             # useOnlineStatus.ts, useDebounce.ts
```

### 2.2 Fronteras y Reglas de Dependencia (Verificables por ESLint)
- Dirección estricta: `app → features → shared`.
- Prohibido `shared → features` y prohibido que `featureA` importe archivos internos de `featureB`.
- **Aislamiento del SDK:** Solo `src/shared/lib/supabase.ts` y `src/features/*/services/*.service.ts` pueden importar el cliente Supabase. Los componentes UI jamás hacen queries directas.
- **Purga de estado cross-tenant:** Al cambiar de tienda activa o cerrar sesión, `tenant.store` y los caches reactivos en memoria/almacenamiento local se limpian por completo de forma síncrona.

---

## 3. Frontera Backend en Supabase: PostgREST vs. RPC vs. Edge Functions

| Mecanismo | Uso permitido | Ejemplos en Cuentia |
| :--- | :--- | :--- |
| **PostgREST directo (`supabase.from()`)** | Solo lecturas protegidas por RLS y ediciones simples no financieras de una sola tabla. | Listar/buscar clientes, consultar historial del ledger, actualizar nombre/teléfono/notas de cliente. |
| **PostgreSQL RPC (`supabase.rpc()`)** | **Obligatorio** para toda mutación financiera, operación multi-tabla, cambio de roles/membresías y agregaciones de dashboard/reportes. | `create_store_with_owner`, `create_customer_with_opening_balance`, `post_ledger_entry`, `reverse_ledger_entry`, `transfer_store_ownership`, `get_store_dashboard_summary`. |
| **Edge Functions (Deno)** | **Solo** I/O externo, secretos de terceros o webhooks entrantes. Nunca como proxy CRUD. | Correos transaccionales con marca propia (Resend) para invitaciones si se requiere en producción, webhooks futuros de suscripción SaaS. |

### Manejo Centralizado de Errores
Las funciones RPC emiten códigos de dominio explícitos (`CU_*`). `src/shared/lib/errors.ts` normaliza errores de Postgres, PostgREST, Auth y red en un tipo único `AppError` (`{ code, userMessage, retryable, field? }`):

| Código técnico | `AppError.code` | Mensaje en español colombiano |
| :--- | :--- | :--- |
| `CU_CREDIT_LIMIT_EXCEEDED` | `CREDIT_LIMIT_EXCEEDED` | "Este fiado supera el tope autorizado del cliente." |
| `CU_PAYMENT_EXCEEDS_BALANCE` | `PAYMENT_EXCEEDS_BALANCE` | "El abono supera el saldo pendiente de la cuenta." |
| `CU_ALREADY_REVERSED` | `ALREADY_REVERSED` | "Este movimiento ya fue anulado." |
| `CU_IDEMPOTENCY_CONFLICT` | `IDEMPOTENCY_CONFLICT` | "Esta operación ya se envió con otros datos. Recarga e intenta de nuevo." |
| `CU_FORBIDDEN` / PG `42501` | `FORBIDDEN` | "No tienes permisos para hacer esta acción en esta tienda." |
| PG `23505` | `CONFLICT_DUPLICATE` | Mapeo según restricción (ej. cédula duplicada). |
| Red / `Failed to fetch` | `NETWORK_UNAVAILABLE` | "Sin conexión estable. Tus datos siguen aquí; intenta de nuevo cuando vuelva la señal." |

**Regla de seguridad:** Jamás mostrar `error.message` ni `error.details` crudos de PostgreSQL al usuario final.

---

## 4. PWA y Conectividad Inestable

- **MVP (Online-First Resiliente):**
  - `vite-plugin-pwa` (Workbox) precachea **únicamente** App Shell estático (HTML/JS/CSS/íconos).
  - Todas las rutas de Supabase (`/rest/v1/*`, `/auth/v1/*`, `/rpc/*`) usan estrategia **`NetworkOnly` estricta** en el Service Worker (protege dispositivos compartidos y evita saldos fantasma).
  - Lectura tolerante a microcortes: estado reactivo en memoria (y opcionalmente snapshot local particionado por `userId + storeId`, purgado en logout/cambio de tienda) mostrando banner `"Sin internet · Modo solo consulta · Última actualización: hace X min"`.
  - **Escrituras financieras bloqueadas sin conexión.** Cortes de señal *en vuelo* quedan cubiertos reutilizando la misma `idempotency_key` al reintentar.
- **Post-MVP (Offline-Capable):** Solo cuando el core esté validado: cola *Transactional Outbox* en IndexedDB cifrada con Web Crypto API + *Sync Engine* FIFO + bandeja de conciliación para conflictos de cupo offline.

---

## 5. Ambientes, CI/CD y Despliegue

| Ambiente | Frontend | Backend | Notas |
| :--- | :--- | :--- | :--- |
| **Local** | Vite (`localhost:5173`) | Supabase CLI + Docker (`supabase start`) | Desarrollo diario gratuito y reproducible con `supabase/seed.sql`. |
| **Staging** | Cloudflare Pages (rama `staging` / Previews) | Proyecto Supabase Staging | QA, verificación de migraciones y demos piloto. |
| **Production** | **Cloudflare Pages** (rama `main`) | **Supabase Pro** (`$25/mes` + PITR) | Sin pausa por inactividad, backups diarios + PITR, ancho de banda libre comercial. |

### Pipeline CI (GitHub Actions)
1. **En cada PR:** `pnpm lint` (incluye fronteras de features) → `pnpm typecheck` (`vue-tsc --noEmit`) + verificación de *schema drift* (`database.types.ts`) → `pnpm test:unit` (Vitest) → `supabase db reset` + `supabase test db` (`pgTAP`) → Integración DB y Suite Multi-Tenant/RBAC.
2. **En merge a `staging` / `main`:** Suite E2E Playwright (`390×844` + desktop) → `supabase db push` → Deploy Cloudflare Pages → Smoke check post-despliegue.
