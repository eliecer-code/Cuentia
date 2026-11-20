# Seguridad, Aislamiento Multi-Tenant y Cumplimiento — Cuentia

> **Responsabilidad única (SSOT):** Controles de aislamiento multi-tenant (`SEC-*`), matriz RBAC, hardening de PostgreSQL/Supabase, gestión de sesiones en dispositivos compartidos, auditoría, backups y cumplimiento legal en Colombia.

---

## 1. Controles Multi-Tenant y Hardening PostgreSQL (`SEC-*`)

- **SEC-01 Default-Deny y `FORCE RLS`:** 100 % de las tablas en `public` habilitan `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`. El rol `anon` no tiene privilegios sobre ninguna tabla operativa ni RPC.
- **SEC-02 `store_id` nunca es prueba de autorización:** El `store_id` enviado por el frontend es solo un selector de intención. Toda política RLS y RPC valida `(select auth.uid())` contra `store_memberships` con `status = 'active'`. Prohibido leer `user_metadata` para autorización.
- **SEC-03 Helpers RLS sin recursión ni exposición:**
  - `store_memberships` permite lectura propia vía `user_id = (select auth.uid())`.
  - Los helpers `private.user_active_store_ids()` y `private.has_store_role(p_store_id, p_roles)` viven en un **esquema `private` no expuesto en PostgREST**, declarados `STABLE SECURITY DEFINER SET search_path = ''`.
- **SEC-04 Hardening estricto de funciones `SECURITY DEFINER`:**
  1. `SET search_path = ''` y calificación explícita de esquemas (`public.*`, `auth.uid()`).
  2. Validación al inicio de `auth.uid() IS NOT NULL`, membresía activa y rol suficiente.
  3. Validación de pertenencia al mismo `p_store_id` de todos los recursos recibidos.
  4. `REVOKE EXECUTE FROM PUBLIC, anon;` y `GRANT EXECUTE` solo a `authenticated`.
  5. Mensajes de error uniformes ante IDs ajenos al tenant (anti-enumeración).
- **SEC-05 Triple barrera sobre `ledger_entries`:**
  1. `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` a `PUBLIC`, `anon`, `authenticated`.
  2. RLS únicamente `FOR SELECT`.
  3. Trigger `BEFORE UPDATE OR DELETE` que aborta siempre.
- **SEC-06 Vistas seguras:** Toda vista en `public` debe declararse con `security_invoker = true`.
- **SEC-07 Inmutabilidad de `store_id`:** Trigger impide cambiar `store_id` en actualizaciones de tablas operativas.
- **SEC-08 Auditoría automática de catálogo en CI:** En cada PR con migraciones, `pgTAP` verifica: 0 tablas sin `FORCE RLS`, 0 funciones `SECURITY DEFINER` sin `search_path`, 0 vistas sin `security_invoker = true`, 0 políticas referenciando `user_metadata` y 0 permisos de escritura directa sobre `ledger_entries`.

---

## 2. Matriz RBAC y Anti-Escalamiento

| Capacidad | `owner` | `admin` | `employee` |
| :--- | :---: | :---: | :---: |
| Editar configuración general, cupos por defecto y plantillas WhatsApp | Sí | Parcial | No |
| Suscripción SaaS, cierre de tienda, transferir propiedad | **Solo `owner`** | No | No |
| Invitar / suspender / cambiar rol a `employee` | Sí | Sí | No |
| Invitar / suspender / cambiar rol a `admin` | **Solo `owner`** | No | No |
| Modificar o revocar al `owner` | Solo transferencia formal | **Prohibido** | **Prohibido** |
| Crear/buscar clientes y editar datos de contacto | Sí | Sí | Sí |
| Modificar `credit_limit` o bloquear (`frozen`) cliente | Sí | Sí (auditado) | **Prohibido** |
| Archivar (`archived`) o anonimizar cliente (ARCO) | **Solo `owner`** | No | No |
| Registrar fiado dentro de cupo y registrar abonos | Sí | Sí | Sí |
| Autorizar sobregiro o registrar `adjustment` | Sí (auditado) | Sí (auditado) | **Prohibido** |
| Revertir movimiento propio reciente | Sí | Sí | Configurable (default: **No**) |
| Revertir movimientos antiguos o de terceros | Sí | Sí (alerta al `owner`) | **Prohibido** |
| Ver dashboard financiero y reportes completos | Sí | Sí | Limitado / No |
| Exportar base completa de clientes/cartera (CSV) | **Solo `owner`** | No | **Prohibido** |
| Consultar `audit_logs` | Sí | Operativos | No |

- **Anti-escalamiento:** Nadie puede auto-elevar su rol ni asignar un rol ≥ al propio; `owner` no es asignable en invitaciones; invariante *Last Owner Standing* impide tiendas sin propietario.
- **`platform_superadmin` separado:** Nunca existe en `store_memberships`. Vive en `internal.platform_admins` con acceso *break-glass* temporal (ticket + autorización del `owner` o aprobación dual, solo lectura por defecto y auditoría visible para la tienda).

---

## 3. Autenticación, Invitaciones y Dispositivos Compartidos

- **Supabase Auth:** Contraseñas ≥ 10 caracteres + validación contra contraseñas filtradas, verificación de email, anti-bot (Turnstile) y rate limiting.
- **Invitaciones seguras:** Token ≥ 256 bits hasheado (SHA-256), expiración 72 h, respuesta uniforme anti-enumeración y validación de email verificado al aceptar.
- **Dispositivos compartidos en tienda:**
  - Cuentas individuales obligatorias; prohibido compartir credenciales del `owner`.
  - Bloqueo por inactividad (10–15 min) y cierre rápido de sesión con purga total de memoria y almacenamiento local.
  - Access tokens cortos (15–30 min) + *Refresh Token Rotation*.
  - **Kill Switch inmediato:** al revocar `store_memberships.status = 'revoked'`, toda llamada siguiente falla en milisegundos aunque el JWT no haya expirado.

---

## 4. Auditoría, Backups, Secretos y Retención

- **Auditoría (`audit_logs`):** Inmutable, captura en servidor `now()`, `auth.uid()`, rol, acción, entidad y diff sanitizado (reversiones, sobregiros, ajustes, cambios de cupo, bloqueos, exportaciones, cambios de rol, transferencia de propiedad y accesos *break-glass*). Retención mínima: 1–3 años.
- **Backups y DR:** Supabase Pro + PITR (RPO ≤ 5 min, RTO ≤ 1–2 h) + respaldo lógico cifrado en cuenta externa (3-2-1). Pruebas trimestrales de restauración verificando RLS y `reconcile_ledger() = 0`. Registro *tombstone* para re-aplicar anonimizaciones tras restauraciones históricas.
- **Secretos:** `anon` key pública en frontend; `service_role` **estrictamente prohibida** en frontend, variables `VITE_*`, Git o logs. Escaneo de secretos en CI y proyectos Supabase separados por ambiente (`local`, `staging`, `prod`).

---

## 5. Cumplimiento Legal en Colombia

- **Posicionamiento:** Cuentia es exclusivamente una **herramienta tecnológica de registro de cuentas por cobrar**. **NO** es entidad financiera vigilada por la SFC, no otorga créditos, no capta ni intermedia dinero, no cobra intereses y no es central de riesgo. **Prohibido cruzar historiales de morosidad entre distintas tiendas** (riesgo Ley 1266/2008).
- **Ley 1581 de 2012 y Decreto 1377 de 2013 (Habeas Data):**
  - La **Tienda** es *Responsable del Tratamiento* de sus clientes; **Cuentia** es *Encargado* (y *Responsable* de los usuarios de la plataforma).
  - Controles *Privacy by Design*: registro de autorización (`consent_recorded_at`), minimización de datos, `whatsapp_opt_out`, flujos ARCO (exportación individual, rectificación auditada, anonimización sin romper el ledger).
- **Ley 2300 de 2023:** Aviso preventivo no bloqueante al enviar recordatorios de cobro por WhatsApp fuera de horarios hábiles (L–V 7:00–19:00, Sáb 8:00–15:00; sin domingos ni festivos).
- **Validación jurídica obligatoria antes de lanzamiento comercial:**
  1. Términos y Condiciones + Acuerdo de Transmisión de Datos (DPA) e indemnidad.
  2. Concepto sobre alcance de Ley 2300 para recordatorios informativos de tiendas de barrio.
  3. Alcance probatorio de comprobantes WhatsApp bajo Ley 527 de 1999 (no son título valor).
  4. Transmisión internacional de datos (Supabase/AWS) y aplicabilidad del RNBD.
  5. Revisión tributaria y facturación electrónica DIAN de la suscripción SaaS de Cuentia.
