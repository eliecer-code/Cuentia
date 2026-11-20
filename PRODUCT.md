# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vue 3 (Composition API, `<script setup>`), TypeScript (`strict: true`), Vite, Pinia + composables nativos (sin `@tanstack/vue-query`, siguiendo modo `/ponytail`), Vue Router, Tailwind CSS, shadcn-vue / Reka UI, Zod, **Firebase** (Firebase Auth, Cloud Firestore con `firestore.rules` multi-tenant + transacciones ACID, Cloud Functions solo cuando se requiera I/O externo o facturación SaaS), Vitest, `@firebase/rules-unit-testing`, Playwright. Gestor de paquetes: `pnpm`. Despliegue objetivo: Cloudflare Pages o Firebase Hosting + Firebase Cloud Firestore.

## Users

- **Tendero propietario (`owner`)**: Dueño de una tienda de barrio, granero o cigarrería en Colombia. Opera de pie en el mostrador, frecuentemente con una sola mano en un celular Android de gama media-baja y bajo presión de filas. Tiene poca o mediana experiencia tecnológica y actualmente lleva las cuentas fiadas en cuadernos de papel.
- **Administrador (`admin`)**: Familiar de confianza o encargado de tienda que supervisa el fiado, registra movimientos, ajusta cupos y apoya la cobranza.
- **Empleado / vendedor (`employee`)**: Ayudante de mostrador que registra fiados y abonos del día, con permisos restringidos (sin poder alterar cupos, borrar cobros ni exportar la base completa).

## Product Purpose

Reemplazar el cuaderno físico de fiados por una aplicación SaaS multi-tenant rápida, confiable y auditable para gestionar ventas fiadas, abonos y cuentas por cobrar en tiendas de barrio de Colombia.

**Qué significa el éxito:**
- Registrar una compra fiada o un abono en mostrador en menos de 10 segundos.
- Eliminar errores matemáticos, disputas con clientes y pérdida de cartera por extravío o deterioro del cuaderno.
- Dar claridad inmediata sobre cuánto dinero está pendiente por cobrar (stock), cuánto se fió en el período y cuánto efectivamente se recaudó (flujo), sin confundir ninguno con ganancias.
- Facilitar la migración desde cuadernos de papel en pocos minutos mediante saldos iniciales auditables.

## Positioning

Cuentia es exclusivamente una **herramienta tecnológica de registro y control de cuentas por cobrar (cuaderno de fiados digital)** — no un ERP, no un sistema de inventarios/POS, no facturación electrónica DIAN y **no una entidad financiera** (no otorga créditos, no intermedia dinero, no cobra intereses ni cruza datos de morosos entre tiendas). Su ventaja radica en unir velocidad de mostrador para baja alfabetización digital con integridad contable estricta en base de datos (ledger inmutable, precisión entera en COP, idempotencia y aislamiento multi-tenant por RLS).

## Operating Context

- **Entorno físico:** Mostrador de tienda de barrio en Colombia, iluminación fuerte o exterior, interrupciones constantes, conectividad 3G/4G intermitente y uso frecuente de dispositivos compartidos entre dueño y empleados.
- **Rituales existentes:** El tendero identifica a los vecinos por nombre o apodo ("Doña Marta", "El del taller"); muchos hogares comparten un único número de WhatsApp; los pagos se reciben en Efectivo, Nequi, Daviplata o transferencia; el comprobante informal aceptado por el cliente es un mensaje de WhatsApp.
- **Migración:** Al adoptar Cuentia, las tiendas ya tienen decenas de clientes con deudas acumuladas en cuadernos físicos y necesitan cargar su saldo actual sin transcribir meses de historial.
- **Zona horaria y moneda:** Colombia (`America/Bogota`, UTC-5 sin cambio horario) y Pesos Colombianos (`COP`, enteros sin centavos).

## Capabilities and Constraints

**Dentro del MVP:**
- Multi-tenant estricto por tienda (`store_id` + RLS), roles `owner`, `admin` y `employee`, invitaciones seguras y selector multi-tienda.
- Alta rápida de clientes (< 15 s), búsqueda tolerante a tildes (nombre, apodo, teléfono), detección de homónimos y teléfonos compartidos sin bloquear hogares.
- Motor financiero *append-only* (`ledger_entries`): compras fiadas, abonos con método de pago, saldos iniciales de cuaderno, reversiones compensatorias con motivo y ajustes/descuentos (`owner`/`admin`).
- Bloqueo por defecto de abonos superiores a la deuda (`allow_negative_balance = false`) para prevenir errores de ceros en COP, con esquema listo para *opt-in* futuro.
- Dashboard operativo (stock vs. flujo), historial cronológico, reportes por período y morosidad (`+15/30/60 días`), configuración de tienda y gestión de equipo.
- Comprobantes y recordatorios por WhatsApp vía enlaces `wa.me` + comprobante visual compartible (sin API oficial de Meta).
- PWA instalable (*online-first* resiliente): lectura de datos recientes con indicador de frescura y **bloqueo seguro de escrituras financieras offline** en MVP; protección contra doble toque y cortes de señal mediante `idempotency_key`.

**Fuera del MVP (explícito):**
- Inventarios, catálogo de productos/SKUs, POS de ventas de contado, facturación electrónica DIAN, contabilidad PUC, pasarelas de pago, WhatsApp Business API, multi-sucursal consolidado y cola de escritura 100 % offline (Outbox).

**Terminología obligatoria (español colombiano de barrio):**
- Usar *Total por cobrar*, *Fiado*, *Abono*, *Debe*, *Al día / Paz y salvo*, *Tope de fiado*, *Anular movimiento*, *Saldo de cuaderno*. Evitar jerga bancaria/contable (*Cargo*, *Amortización*, *Cartera neta*, *Nota crédito*).

**Hechos deliberadamente no decididos aún:**
- Precios comerciales de planes SaaS (Gratis / Pro / Negocio) y tope exacto de clientes del Plan Gratis (hipótesis inicial: 15–25 clientes activos; a validar en piloto).
- Validación jurídica final de Términos y Condiciones, DPA (Ley 1581 de 2012) y alcance exacto de la Ley 2300 de 2023 para recordatorios de tiendas de barrio antes del lanzamiento comercial.

## Brand Commitments

- **Nombre:** Cuentia.
- **Punto de partida:** Proyecto *greenfield* sin logo, identidad visual ni activos gráficos previos que preservar.
- **Voz:** Cercana, respetuosa, directa y clara; cuida la relación vecinal entre el tendero y sus clientes (sin tono intimidatorio ni lenguaje de cobranza jurídica).

## Evidence on Hand

- Ningún activo gráfico, testimonio, caso de estudio ni métrica de clientes reales existe todavía (proyecto en fase 0).
- **Restricción:** No fabricar testimonios, cifras de clientes, precios validados ni certificaciones legales/financieras.

## Product Principles

1. **Más rápido que el cuaderno:** Toda acción frecuente en mostrador (buscar cliente, fiar, abonar) debe completarse en pocos toques y menos de 10 segundos.
2. **Integridad financiera innegociable:** El saldo nunca lo calcula el cliente; toda mutación monetaria es inmutable, atómica, entera (COP) e idempotente en PostgreSQL.
3. **Claridad sin jerga ni ambigüedad:** Separar siempre cartera pendiente (stock), fiado del período (flujo) y abonos recaudados (caja), dejando claro que no equivalen a ganancias.
4. **Simplicidad radical (YAGNI):** Resolver excepcionalmente bien el fiado sin complejidad de ERP, dependencias evitables ni sobre-ingeniería.
5. **Confianza y respeto por los datos:** Aislamiento estricto entre tiendas, cumplimiento de Habeas Data y compromiso ético de nunca secuestrar los datos financieros del tendero si vence su suscripción.

## Accessibility & Inclusion

- Operación cómoda con una sola mano en pantallas móviles pequeñas (`390×844` como referencia base) con áreas táctiles generosas (`>= 48 px`).
- Alto contraste legible bajo luz solar o iluminación intensa de mostrador (`>= 7:1` en cifras y etiquetas críticas) y numerales tabulares (`tabular-nums`) para evitar errores de lectura en montos COP.
- Semántica siempre reforzada por texto e ícono (nunca solo por color).
