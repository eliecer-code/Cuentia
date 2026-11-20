# Requisitos Funcionales y No Funcionales — Cuentia (MVP)

> **Responsabilidad única (SSOT):** Catálogo numerado de qué debe hacer el sistema (`RF-*`) y niveles de calidad obligatorios (`RNF-*`).  
> Las invariantes contables viven en [BUSINESS_RULES.md](./BUSINESS_RULES.md); el esquema en [DATABASE_DESIGN.md](./DATABASE_DESIGN.md); los controles de seguridad en [SECURITY.md](./SECURITY.md).

---

## 1. Requisitos Funcionales (`RF-*`)

### 1.1 Autenticación, Onboarding y Multi-Tienda
- **RF-01 Registro e inicio de sesión:** El usuario puede registrarse con nombre, correo y contraseña, iniciar sesión, cerrar sesión y recuperar contraseña mediante Supabase Auth.
- **RF-02 Creación inicial de tienda:** Tras registrarse, el usuario crea su tienda (nombre obligatorio, WhatsApp opcional) en un flujo de máximo 2 pasos y queda vinculado atómicamente como `owner`.
- **RF-03 Selección de tienda activa:** Un usuario miembro de más de una tienda puede cambiar la tienda activa sin contaminar caché ni datos entre sesiones.
- **RF-04 Gestión de equipo e invitaciones:** `owner` (para `admin`/`employee`) y `admin` (para `employee`) pueden invitar colaboradores por correo/enlace con expiración, ver su estado, cambiar roles permitidos y revocar acceso con efecto inmediato.
- **RF-05 Transferencia de propiedad:** El `owner` puede transferir la propiedad de la tienda a un `admin` activo mediante confirmación en dos pasos, quedando degradado a `admin`.

### 1.2 Gestión de Clientes y Migración de Cuadernos
- **RF-06 Alta rápida de clientes:** Crear un cliente con solo `full_name` obligatorio y campos opcionales (`nickname`, `phone_e164`, `document_number`, `address`, `notes`, `credit_limit`).
- **RF-07 Búsqueda y filtrado instantáneo:** Buscar clientes tolerando tildes y mayúsculas por nombre, apodo, teléfono o cédula; filtrar por `Con deuda`, `Todos`, `Al día`, `Bloqueados` e `Inactivos`; ordenar por mayor deuda, antigüedad sin abonar o actividad reciente.
- **RF-08 Detección de posibles duplicados:** Sugerir clientes existentes con nombre similar o mismo teléfono sin impedir homónimos ni hogares con celular compartido.
- **RF-09 Migración de saldo de cuaderno:** Registrar un `opening_balance` auditable al crear un cliente (o en bucle rápido *"Pasar cliente del cuaderno"*) sin exigir historial previo.
- **RF-10 Gestión de estados de cliente:** Cambiar estado entre `active`, `frozen` (bloqueado para fiar, habilitado para abonar) y `archived` (solo si `current_balance = 0`).

### 1.3 Motor de Fiados, Abonos y Movimientos
- **RF-11 Registro de compra fiada:** Registrar múltiples compras fiadas por día para un cliente activo con monto entero COP, fecha/hora y descripción opcional (y detalle opcional).
- **RF-12 Registro de abonos:** Registrar abonos parciales o totales (atajo *"Saldar todo"*) indicando método de pago (`cash`, `nequi`, `daviplata`, `bank_transfer`, `other`) y nota opcional.
- **RF-13 Reversión de movimientos:** Permitir anular un movimiento con motivo obligatorio generando un contra-asiento inmutable (`reversal`) vinculado al movimiento original.
- **RF-14 Ajustes y condonaciones:** Permitir a `owner`/`admin` registrar un `adjustment` (descuento, corrección de migración o castigo de deuda) con motivo obligatorio sin alterar los indicadores de dinero recaudado.
- **RF-15 Historial cronológico:** Consultar extracto completo por cliente (con saldo resultante por asiento) e historial global de la tienda filtrable por fecha, tipo, método de pago y usuario responsable.

### 1.4 Dashboard, Reportes y Configuración
- **RF-16 Dashboard operativo:** Mostrar de forma claramente separada: (a) **Total por cobrar hoy** y número de clientes con deuda (stock), (b) **Fiado en el período** y **Abonos recaudados en el período** (flujos por `Hoy`, `Semana`, `Mes`), (c) clientes con mayores saldos y (d) movimientos recientes.
- **RF-17 Reportes básicos y morosidad:** Desglosar abonos por método de pago en un período (`Hoy`, `Semana`, `Mes`, rango), listar clientes con deuda sin abonar (`+15`, `+30`, `+60` días) y permitir exportación CSV (restringida a `owner` / plan Pro).
- **RF-18 Configuración de tienda:** Editar datos básicos de la tienda, tope de fiado sugerido, política ante sobrepasar tope, permiso opcional de reversión para empleados y plantillas de WhatsApp.

### 1.5 WhatsApp y Comprobantes (MVP sin API Oficial)
- **RF-19 Comprobantes y recordatorios vía WhatsApp:** Generar vista previa editable y abrir enlace `wa.me/57...` (o `wa.me/?text=...` si no tiene teléfono) para comprobantes de abono, resúmenes de cuenta y recordatorios respetuosos.
- **RF-20 Comprobante visual compartible:** Generar en cliente una imagen limpia (PNG) de comprobante compartible por Web Share API o descargable.
- **RF-21 Controles de privacidad WhatsApp:** Respetar `whatsapp_opt_out` por cliente y mostrar aviso preventivo no bloqueante si un recordatorio de cobro se envía fuera de horarios hábiles (Ley 2300).

### 1.6 Modelo Comercial SaaS (Base Preparatoria MVP)
- **RF-22 Límites de plan y modo solo lectura ético:** Preparar la estructura para planes (Gratis, Pro, Negocio) garantizando que ante vencimiento de suscripción nunca se bloqueen consultas, exportaciones CSV/PDF ni (por política recomendada) abonos sobre deudas existentes.

---

## 2. Requisitos No Funcionales (`RNF-*`)

| ID | Categoría | Requisito Verificable |
| :--- | :--- | :--- |
| **RNF-01** | **Integridad financiera** | 100 % de las mutaciones monetarias se ejecutan en transacciones ACID en PostgreSQL con aritmética entera (`BIGINT`), idempotencia obligatoria y conciliación `0` discrepancias (ver `BR-01` a `BR-08`). |
| **RNF-02** | **Aislamiento multi-tenant** | `0` fugas de lectura o escritura entre tiendas verificadas en CI mediante `FORCE RLS`, FKs compuestas y pruebas con JWTs reales (ver [SECURITY.md](./SECURITY.md)). |
| **RNF-03** | **Velocidad en mostrador** | Flujo de registrar fiado o abono desde ficha de cliente en ≤ 3 toques y < 10 s; consultas de cartera y dashboard p95 < 200 ms con 50.000 asientos por tienda. |
| **RNF-04** | **Mobile-first y gama baja** | Diseño primario para `390×844` sin scroll horizontal, LCP móvil < 2.5 s en red 4G simulada, Lighthouse Performance ≥ 85 y Accessibility ≥ 90. |
| **RNF-05** | **PWA y conectividad** | Instalable en Android Chrome e iOS Safari; Service Worker con `NetworkOnly` estricto para APIs autenticadas; escrituras financieras bloqueadas con aviso claro sin conexión; reintentos seguros ante cortes en vuelo. |
| **RNF-06** | **Precisión horaria** | Cortes diarios y reportes calculados siempre en `store.timezone` (`America/Bogota`, UTC-5), independientes de la zona horaria del dispositivo o servidor UTC. |
| **RNF-07** | **Mantenibilidad y calidad** | TypeScript `strict: true`, cero errores de lint/typecheck, fronteras de módulos verificadas por ESLint, cobertura unitaria 100 % en dinero/fechas y suite automatizada bloqueante en CI. |
| **RNF-08** | **Costos operativos lean** | Arquitectura monolítica modular sin microservicios; costo de operación inicial ≤ `\$35 USD/mes` para las primeras cientos de tiendas. |
