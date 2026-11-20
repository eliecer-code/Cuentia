# Diseño de Base de Datos y Motor Ledger — Cuentia (PostgreSQL / Supabase)

> **Responsabilidad única (SSOT):** Modelo relacional, tipos, restricciones, índices, triggers de inmutabilidad y contratos transaccionales de los RPCs en PostgreSQL.  
> Las reglas de negocio que implementa viven en [BUSINESS_RULES.md](./BUSINESS_RULES.md) y las políticas RLS/RBAC en [SECURITY.md](./SECURITY.md).

---

## 1. Consolidación de Entidades (MVP = 7 Tablas)

De las 13 entidades de dominio analizadas, el MVP consolida en **6 tablas core + 1 tabla operativa de invitaciones**:
- **Tablas independientes:** `stores`, `profiles`, `store_memberships`, `store_invitations`, `customers`, `ledger_entries`, `audit_logs`.
- **Consolidadas en MVP (YAGNI):**
  - *Rol y permisos* → `ENUM store_role ('owner', 'admin', 'employee')` en `store_memberships`.
  - *Cuenta de crédito* → 1:1 dentro de `customers` (`current_balance`, `credit_limit`, `credit_status`, `last_ledger_seq`).
  - *Compra fiada, abono, saldo inicial, ajuste y reversión* → unificados en `ledger_entries` por `entry_type`.
  - *Detalle de compra* → `note TEXT` + `line_items JSONB` opcional en `ledger_entries`.
  - *Configuración de tienda* → columnas tipadas financieras + `settings JSONB` en `stores`.

---

## 2. Convenciones Estructurales Obligatorias

1. **Claves primarias:** `UUID` (`gen_random_uuid()`).
2. **Aislamiento cross-tenant a nivel relacional:** Toda tabla padre tenant-scoped declara `UNIQUE (store_id, id)` y sus hijas usan **FKs compuestas** `(store_id, parent_id) REFERENCES parent(store_id, id)`.
3. **Prohibición de `ON DELETE CASCADE` financiero:** Todas las FKs que sostienen historial contable o auditoría usan `ON DELETE RESTRICT`.
4. **RLS forzado:** `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` en el 100 % de tablas en `public`.
5. **Dinero en enteros:** `BIGINT` en pesos enteros COP (`currency_minor_exponent = 0`). Nunca `FLOAT`/`REAL`/`DOUBLE PRECISION`.
6. **Fechas:** Todos los instantes en `TIMESTAMPTZ` (UTC); la fecha contable comercial de la tienda se persiste en `business_date DATE`.

---

## 3. Especificación de Tablas y Enums

### Enums
- `store_status`: `'active'`, `'suspended'`, `'closed'`
- `user_status`: `'active'`, `'disabled'`, `'anonymized'`
- `store_role`: `'owner'`, `'admin'`, `'employee'`
- `membership_status`: `'active'`, `'revoked'`
- `invitation_status`: `'pending'`, `'accepted'`, `'revoked'`, `'expired'`
- `customer_credit_status`: `'active'`, `'frozen'`, `'archived'`
- `ledger_entry_type`: `'credit_sale'`, `'payment'`, `'opening_balance'`, `'adjustment'`, `'reversal'`
- `payment_method_type`: `'cash'`, `'nequi'`, `'daviplata'`, `'bank_transfer'`, `'other'`

### 3.1 `stores`
- **Columnas:** `id UUID PK`, `owner_user_id UUID NOT NULL`, `name TEXT NOT NULL`, `slug TEXT NOT NULL`, `phone_e164 TEXT`, `currency_code CHAR(3) NOT NULL DEFAULT 'COP'`, `currency_minor_exponent SMALLINT NOT NULL DEFAULT 0`, `timezone TEXT NOT NULL DEFAULT 'America/Bogota'`, `default_credit_limit BIGINT`, `allow_over_limit BOOLEAN NOT NULL DEFAULT true`, `allow_negative_balance BOOLEAN NOT NULL DEFAULT false`, `employee_can_reverse_minutes SMALLINT NOT NULL DEFAULT 0`, `status store_status NOT NULL DEFAULT 'active'`, `settings JSONB NOT NULL DEFAULT '{}'::jsonb`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `owner_user_id → profiles(id) ON DELETE RESTRICT`.
- **Constraints:** `UNIQUE (slug)`, `CHECK (length(btrim(name)) BETWEEN 2 AND 120)`, `CHECK (currency_minor_exponent BETWEEN 0 AND 4)`, `CHECK (default_credit_limit IS NULL OR default_credit_limit >= 0)`, `CHECK (employee_can_reverse_minutes BETWEEN 0 AND 1440)`, `CHECK (jsonb_typeof(settings) = 'object')`.
- **Índices:** PK `(id)`, `UNIQUE (slug)`, `(owner_user_id)`.

### 3.2 `profiles`
- **Columnas:** `id UUID PK`, `full_name TEXT NOT NULL`, `email TEXT`, `phone_e164 TEXT`, `status user_status NOT NULL DEFAULT 'active'`, `anonymized_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `id → auth.users(id) ON DELETE RESTRICT`.
- **Constraints:** `CHECK (length(btrim(full_name)) >= 1)`, `CHECK ((status = 'anonymized') = (anonymized_at IS NOT NULL))`.
- **Índices:** PK `(id)`, `UNIQUE (lower(email)) WHERE email IS NOT NULL`.

### 3.3 `store_memberships`
- **Columnas:** `id UUID PK`, `store_id UUID NOT NULL`, `user_id UUID NOT NULL`, `role store_role NOT NULL`, `status membership_status NOT NULL DEFAULT 'active'`, `invited_by UUID`, `revoked_at TIMESTAMPTZ`, `revoked_by UUID`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `store_id → stores(id) ON DELETE RESTRICT`; `user_id`, `invited_by`, `revoked_by → profiles(id) ON DELETE RESTRICT`.
- **Constraints:** `UNIQUE (store_id, user_id)`, `UNIQUE (store_id, id)`, `UNIQUE (store_id) WHERE role = 'owner' AND status = 'active'`, `CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))`.
- **Índices:** `(user_id, status, store_id)` *(crítico para RLS)*, `(store_id, status, role)`.

### 3.4 `store_invitations`
- **Columnas:** `id UUID PK`, `store_id UUID NOT NULL`, `invited_email TEXT NOT NULL`, `role store_role NOT NULL`, `token_hash TEXT NOT NULL`, `status invitation_status NOT NULL DEFAULT 'pending'`, `invited_by UUID NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `accepted_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `store_id → stores(id) ON DELETE RESTRICT`, `invited_by → profiles(id) ON DELETE RESTRICT`.
- **Constraints:** `CHECK (role IN ('admin', 'employee'))`, `UNIQUE (token_hash)`, `UNIQUE (store_id, lower(invited_email)) WHERE status = 'pending'`.
- **Índices:** `(store_id, status)`, `(token_hash)`.

### 3.5 `customers`
- **Columnas:** `id UUID PK`, `store_id UUID NOT NULL`, `full_name TEXT NOT NULL`, `nickname TEXT`, `phone_e164 TEXT`, `document_number TEXT`, `address TEXT`, `notes TEXT`, `whatsapp_opt_out BOOLEAN NOT NULL DEFAULT false`, `consent_recorded_at TIMESTAMPTZ`, `credit_status customer_credit_status NOT NULL DEFAULT 'active'`, `credit_limit BIGINT`, `current_balance BIGINT NOT NULL DEFAULT 0`, `last_ledger_seq BIGINT NOT NULL DEFAULT 0`, `last_credit_sale_at TIMESTAMPTZ`, `last_payment_at TIMESTAMPTZ`, `last_activity_at TIMESTAMPTZ`, `balance_updated_at TIMESTAMPTZ`, `search_text TEXT NOT NULL DEFAULT ''`, `created_by UUID NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `store_id → stores(id) ON DELETE RESTRICT`, `created_by → profiles(id) ON DELETE RESTRICT`.
- **Constraints:** `UNIQUE (store_id, id)`, `CHECK (length(btrim(full_name)) BETWEEN 2 AND 120)`, `CHECK (credit_limit IS NULL OR credit_limit >= 0)`, `CHECK (last_ledger_seq >= 0)`, `CHECK (credit_status <> 'archived' OR current_balance = 0)`, `UNIQUE (store_id, document_number) WHERE document_number IS NOT NULL AND credit_status <> 'archived'`.
- **Triggers:**
  - Normalización automática de `search_text` (minúsculas sin tildes combinando `full_name`, `nickname`, `phone_e164`, `document_number`).
  - Guarda de inmutabilidad de `store_id` y de columnas financieras (`current_balance`, `last_ledger_seq`, `last_credit_sale_at`, `last_payment_at`, `balance_updated_at`) salvo cuando la transacción RPC establece `set_config('cuentia.ledger_write', 'on', true)`.
- **Índices:** `(store_id, credit_status, current_balance DESC)`, parcial `(store_id, current_balance DESC, last_payment_at ASC) WHERE current_balance > 0`, `(store_id, phone_e164) WHERE phone_e164 IS NOT NULL`, `GIN (store_id, search_text gin_trgm_ops)` (con extensiones `pg_trgm` + `btree_gin`).

### 3.6 `ledger_entries`
- **Columnas:** `id UUID PK`, `store_id UUID NOT NULL`, `customer_id UUID NOT NULL`, `customer_seq BIGINT NOT NULL`, `entry_type ledger_entry_type NOT NULL`, `signed_amount BIGINT NOT NULL`, `balance_before BIGINT NOT NULL`, `balance_after BIGINT NOT NULL`, `payment_method payment_method_type`, `reverses_entry_id UUID`, `idempotency_key UUID NOT NULL`, `payload_hash TEXT NOT NULL`, `note TEXT`, `reason TEXT`, `line_items JSONB`, `occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `business_date DATE NOT NULL`, `created_by UUID NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `store_id → stores(id) ON DELETE RESTRICT`; `(store_id, customer_id) → customers(store_id, id) ON DELETE RESTRICT`; `(store_id, customer_id, reverses_entry_id) → ledger_entries(store_id, customer_id, id) ON DELETE RESTRICT`; `created_by → profiles(id) ON DELETE RESTRICT`.
- **Constraints:**
  - `UNIQUE (store_id, customer_id, id)`
  - `UNIQUE (store_id, customer_id, customer_seq)`
  - `UNIQUE (store_id, idempotency_key)`
  - `UNIQUE (store_id, reverses_entry_id) WHERE reverses_entry_id IS NOT NULL`
  - `CHECK (signed_amount <> 0)`, `CHECK (balance_after = balance_before + signed_amount)`, `CHECK (customer_seq >= 1)`
  - `CHECK` de coherencia estricta por `entry_type` (ver `BR-09` a `BR-15`).
  - `CHECK (line_items IS NULL OR (jsonb_typeof(line_items) = 'array' AND jsonb_array_length(line_items) <= 100 AND pg_column_size(line_items) <= 16384))`.
- **Triggers:**
  - `BEFORE UPDATE OR DELETE`: aborta siempre (`ERRCODE '55000'`) — inmutabilidad total incluso frente a `service_role`.
  - `BEFORE INSERT` para `reversal`: valida `orig.entry_type <> 'reversal'` y `NEW.signed_amount = -orig.signed_amount`.
- **Índices:** `(store_id, customer_id, customer_seq DESC)`, `(store_id, business_date DESC, created_at DESC)`, `(store_id, entry_type, business_date DESC)`, `(store_id, occurred_at DESC)`, `(store_id, created_by, business_date DESC)`.

### 3.7 `audit_logs`
- **Columnas:** `id UUID PK`, `store_id UUID NOT NULL`, `actor_user_id UUID NOT NULL`, `actor_role TEXT NOT NULL`, `action TEXT NOT NULL`, `entity_type TEXT NOT NULL`, `entity_id UUID NOT NULL`, `before_state JSONB`, `after_state JSONB`, `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **FKs:** `store_id → stores(id) ON DELETE RESTRICT`, `actor_user_id → profiles(id) ON DELETE RESTRICT`.
- **Constraints & Triggers:** `CHECK (length(btrim(action)) >= 3)`; trigger `BEFORE UPDATE OR DELETE` inmutable.
- **Índices:** `(store_id, created_at DESC)`, `(store_id, entity_type, entity_id, created_at DESC)`.

---

## 4. Contratos Transaccionales de RPCs

Todas las RPCs operativas fijan `SET search_path = ''`, `lock_timeout = '3s'`, `statement_timeout = '10s'`, validan `auth.uid()` + membresía activa + rol y retornan tipos estrictos.

| RPC | Responsabilidad y Flujo Atómico |
| :--- | :--- |
| `create_store_with_owner(p_name, p_phone_e164)` | Crea `stores`, inserta `store_memberships(role='owner')` y registra `audit_logs` en 1 transacción. |
| `create_invitation(p_store_id, p_email, p_role)` | Valida jerarquía de rol, guarda `token_hash` (SHA-256) con expiración 72 h, retorna token plano una sola vez al creador. |
| `accept_invitation(p_token)` | Verifica hash, expiración, coincidencia con email verificado de `auth.users`, crea membresía activa y marca invitación `accepted`. |
| `update_member_role` / `revoke_member` | Valida anti-escalamiento y protección de `owner`; actualiza membresía y escribe `audit_logs`. |
| `transfer_store_ownership(p_store_id, p_new_owner_id)` | Lock ordenado (`stores`, luego ambas filas `store_memberships` por `user_id ASC`), degrada saliente a `admin`, promueve entrante a `owner`, actualiza `stores.owner_user_id` y registra `audit_logs`. |
| `create_customer_with_opening_balance(...)` | Crea fila en `customers` y, si `p_opening_balance > 0`, asienta `opening_balance` con `idempotency_key` dentro de la misma transacción. |
| `post_ledger_entry(p_store_id, p_customer_id, p_entry_type, p_amount, p_idempotency_key, ...)` | Lock `customers FOR UPDATE` → verifica `idempotency_key` + `payload_hash` → valida estado, cupo, sobrepago y rol → calcula `business_date` en `store.timezone` → inserta `ledger_entries` → actualiza `customers.current_balance` y `last_ledger_seq` → escribe `audit_logs` (si ajuste o sobregiro). |
| `reverse_ledger_entry(p_store_id, p_entry_id, p_reason, p_idempotency_key)` | Valida rol/ventana, lock `customers FOR UPDATE`, verifica `idempotency_key`, valida original no revertido y `orig.entry_type <> 'reversal'`, inserta `reversal` con `-orig.signed_amount`, actualiza `customers` y registra `audit_logs`. |
| `get_store_dashboard_summary(p_store_id, p_period)` | Agrega cartera (`GREATEST(balance, 0)`), saldos a favor (`ABS(LEAST(balance, 0))`), clientes con deuda, fiado del período (`entry_type = 'credit_sale'`) y abonos (`entry_type = 'payment'`) usando `business_date`. |
| `get_period_report(p_store_id, p_from_date, p_to_date)` | Flujos del período + desglose de abonos por `payment_method` + ajustes separados del recaudo. |
| `reconcile_ledger(p_store_id DEFAULT NULL)` | Retorna clientes con discrepancias (0 filas = integridad 100 %): saldo vs `SUM`, `last_ledger_seq` vs `MAX/COUNT`, cadena `balance_after` y paridad de reversiones. Ejecutada diariamente por `pg_cron`. |
