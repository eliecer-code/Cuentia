# Reglas de Negocio e Invariantes de Dominio — Cuentia

> **Responsabilidad única (SSOT):** Reglas normativas (`BR-*`) y casos límite (`CL-*`) de dominio y contabilidad.  
> La implementación en PostgreSQL se detalla en [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) y su verificación en [TEST_STRATEGY.md](./TEST_STRATEGY.md).

---

## 1. Catálogo de Invariantes Financieras (`BR-*`)

### Moneda, Signos y Fuente de Verdad
- **BR-01 Precisión entera en COP:** Todos los montos monetarios se expresan y almacenan como enteros exactos en la unidad mínima de la moneda de la tienda (`COP` → exponente `0`, `1` unidad = `\$1 COP`). Prohibido usar punto flotante (`float`/`double`) en base de datos o cálculos de negocio.
- **BR-02 Convención única de signo:** Positivo (`> 0`) incrementa la deuda del cliente; negativo (`< 0`) reduce la deuda del cliente. Un saldo `> 0` significa que el cliente debe a la tienda; `= 0` significa paz y salvo; `< 0` significa saldo a favor del cliente.
- **BR-03 Fuente de verdad del saldo:** El libro mayor inmutable (`ledger_entries`) es la única fuente de verdad. El saldo materializado en el cliente (`current_balance`) solo puede actualizarse atómicamente en la misma transacción que inserta un asiento. **El frontend nunca calcula ni persiste el saldo definitivo.**
- **BR-04 Inmutabilidad absoluta del ledger:** Ningún asiento histórico puede editarse ni eliminarse (`UPDATE`/`DELETE` prohibidos). Toda corrección se realiza mediante un asiento compensatorio (`reversal`) o un ajuste explícito (`adjustment`) con motivo obligatorio.
- **BR-05 Secuencia monotónica por cliente:** Cada asiento de un cliente recibe un número consecutivo (`customer_seq = 1, 2, 3...`) y guarda `balance_before` y `balance_after = balance_before + signed_amount`, garantizando un historial determinista aunque dos operaciones coincidan en timestamp.
- **BR-06 Idempotencia obligatoria:** Toda mutación financiera exige una `idempotency_key` (UUID generado por el cliente por intención de acción) única por tienda. Reintentos con igual llave y payload retornan el asiento existente sin duplicar; reutilizar la llave con distinto payload se rechaza (`409`).
- **BR-07 Serialización concurrente:** Operaciones simultáneas sobre el mismo cliente deben serializarse en base de datos (`SELECT ... FOR UPDATE`) para evitar *lost updates*, saltos de secuencia o violación concurrente de cupos.
- **BR-08 Conciliación contable:** En todo momento debe cumplirse `customers.current_balance = COALESCE(SUM(ledger_entries.signed_amount), 0)` y continuidad sin huecos de `customer_seq`. Una tarea diaria verifica el 100 % de las cuentas.

### Compras Fiadas, Abonos, Reversiones y Ajustes
- **BR-09 Compras fiadas (`credit_sale`):** `signed_amount > 0`. Se permiten múltiples compras al día por cliente. Descripción opcional (texto libre hasta 150 caracteres); detalle de artículos opcional. Bloqueada si el cliente está `frozen` o `archived`.
- **BR-10 Límite de crédito (`credit_limit`):** Opcional por cliente (si es `NULL`, hereda `stores.default_credit_limit`). Si `stores.allow_over_limit = true` (default MVP), el exceso muestra advertencia y exige confirmación explícita (`owner`/`admin`); `employee` no puede autorizar sobregiros. Si `allow_over_limit = false`, se bloquea en servidor.
- **BR-11 Abonos (`payment`):** `signed_amount < 0`. Exige método de pago (`cash`, `nequi`, `daviplata`, `bank_transfer`, `other`). Se aplica al **saldo global** del cliente (cuenta corriente), no a compras individuales. Permitido en clientes `active` y `frozen`; bloqueado en `archived`.
- **BR-12 Política de sobrepagos (ADR-01):** En MVP `stores.allow_negative_balance = false` por defecto: el servidor rechaza abonos cuyo monto exceda `current_balance` para prevenir errores de ceros en COP. Si se activa *opt-in* por tienda en el futuro, el saldo a favor jamás se resta de la cartera por cobrar (KPI `Por cobrar = SUM(GREATEST(balance, 0))` y `A favor = ABS(SUM(LEAST(balance, 0)))`).
- **BR-13 Reversiones (`reversal`):** Requieren `reverses_entry_id` perteneciente a la misma tienda y cliente, `reason` obligatorio (≥ 5 caracteres) y `signed_amount = -orig.signed_amount`. Un asiento solo puede revertirse **una vez** y **no se puede revertir una reversión**. Por defecto `employee` no puede revertir (`employee_can_reverse_minutes = 0`); si el dueño habilita ventana corta, aplica solo a asientos propios.
- **BR-14 Ajustes y condonaciones (`adjustment`):** Reservado a `owner`/`admin` con `reason` obligatorio (≥ 5 caracteres). Permite registrar descuentos de cierre, correcciones de migración o castigos de cartera incobrable sin contabilizarlos como abonos recaudados en efectivo.

### Migración, Clientes y Tiempo
- **BR-15 Saldo inicial de cuaderno (`opening_balance`):** Permite cargar la deuda vigente del cuaderno al migrar un cliente. Incrementa `Total por cobrar` (stock), pero **no** suma a `Fiado del período` (flujo). Solo puede existir un `opening_balance` activo (no revertido) por cliente. Si hubo error al transcribir, se revierte o se corrige mediante `adjustment` con motivo.
- **BR-16 Estados del cliente:**
  - `active`: puede fiar y abonar.
  - `frozen` (bloqueado): no puede fiar; sí puede abonar, recibir ajustes/reversiones y permanece visible en cartera por cobrar.
  - `archived` (inactivo): prohibido si `current_balance <> 0` (`CHECK` duro en BD); no permite movimientos hasta reactivarse.
- **BR-17 Identidad de clientes (homónimos y celulares compartidos):** Dos clientes pueden compartir el mismo nombre (se sugiere usar `nickname`). Dos clientes pueden compartir el mismo teléfono (hogares con un solo WhatsApp; la UI advierte y pide confirmación). La cédula (`document_number`), si se registra, es única por tienda entre clientes no archivados.
- **BR-18 Separación financiera de indicadores:** Nunca sumar ni confundir `Total por cobrar` (stock), `Fiado del período` (flujo de ventas a crédito), `Abonos recaudados` (flujo de caja de cartera), `Ajustes/descuentos` y `Ganancias` (utilidad, que Cuentia no calcula al no manejar costos ni ventas de contado).
- **BR-19 Zona horaria y fecha comercial:** Todo timestamp se persiste en UTC (`TIMESTAMPTZ`). Cada asiento calcula y persiste `business_date` según `stores.timezone` (por defecto `America/Bogota`, UTC-5). Todo corte diario y reporte agrupa por `business_date`, evitando que las ventas posteriores a las 7:00 p. m. COT pasen al día siguiente UTC.

---

## 2. Matriz de Casos Límite Obligatorios (`CL-01` a `CL-16`)

| ID | Caso Límite | Regla de Resolución |
| :-: | :--- | :--- |
| **CL-01** | Compras simultáneas | Lock pesimista por fila `customers` serializa ambos fiados; secuencia contigua sin *lost updates*. |
| **CL-02** | Abonos simultáneos | Lock pesimista serializa ambos abonos; si el segundo excede saldo restante (`allow_negative_balance = false`), se rechaza limpiamente con saldo vigente. |
| **CL-03** | Error de conexión / corte en vuelo | UI conserva formulario e `idempotency_key`; al reintentar, el RPC devuelve el asiento original si ya hizo commit. |
| **CL-04** | Doble clic / doble tap | Botón bloqueado síncronamente + `UNIQUE (store_id, idempotency_key)` en BD garantiza 1 solo registro. |
| **CL-05** | Reintento con payload mutado | `payload_hash` no coincide con el guardado para esa `idempotency_key` → error `409`, cero mutación. |
| **CL-06** | Cancelación de compra | Reversión compensatoria (`reversal`) con motivo; original permanece visible marcado como anulado; prohibida doble reversión y reversión de reversión. |
| **CL-07** | Abono registrado incorrectamente | Flujo *"Anular y corregir"*: revierte abono erróneo y registra el correcto; ambos auditables. |
| **CL-08** | Desactivación de cliente con deuda | Imposible pasar a `archived` con saldo `<> 0`; usar `frozen` (bloqueado) o saldar/condonar primero. |
| **CL-09** | Cuenta con saldo cero | Badge `Paz y salvo`, excluido del filtro *"Con deuda"*, historial intacto, botón de abono deshabilitado si no hay saldo a favor. |
| **CL-10** | Saldo negativo (a favor) | Bloqueado por defecto en MVP (`BR-12`). Si se habilita por tienda, se etiqueta *"Saldo a favor"* y se excluye del KPI *Por cobrar*. |
| **CL-11** | Cambio de propietario | Flujo 2 pasos + RPC atómica con lock sobre tienda y membresías; prohibido dejar 0 `owner` activos; auditado en `audit_logs`. |
| **CL-12** | Usuario eliminado con historial | `ON DELETE RESTRICT` protege el ledger; salida laboral = revocar membresía; supresión Ley 1581 = anonimizar `profiles` sin mutar `ledger_entries`. |
| **CL-13** | Diferencias de zona horaria | Cálculos siempre contra `stores.timezone` (`America/Bogota`), ignorando la TZ local del navegador. |
| **CL-14** | Operaciones cerca de medianoche | `23:55 COT` y `00:05 COT` quedan en fechas `business_date` distintas y exactas. |
| **CL-15** | Clientes con nombres repetidos | Permitidos; UI advierte similitud y destaca `nickname` + últimos 4 dígitos del teléfono en búsquedas y confirmaciones. |
| **CL-16** | Restauración y recuperación | Backup diario + PITR + respaldo lógico externo; tras cualquier restore se valida `FORCE RLS` y `reconcile_ledger() = 0` discrepancias. |
