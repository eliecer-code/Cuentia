---
version: 1
slug: "src-app-layouts-appshelllayout-vue"
primary_target: "src/app/layouts/AppShellLayout.vue"
related_targets: ["src/features/dashboard/views/DashboardView.vue"]
---

# Surface Brief — Cuentia App Shell & Dashboard

- **Scope:** App Shell mobile-first (`AppShellLayout.vue`) y vista principal de inicio (`DashboardView.vue`).
- **Visitor mode:** Operate (`code-led`).
- **Audience & job:** Tendero colombiano de pie en el mostrador bajo luz intensa, con una sola mano en celular `390×844` (y escritorio `1280×800`), que necesita leer en 3 segundos su cartera acumulada (*Total por cobrar*) separada del movimiento del período (*Fiado hoy* vs *Abonos hoy*) y lanzar un fiado o abono en menos de 10 segundos.
- **Constraints:** Contraste >= 7:1 en cifras críticas, áreas táctiles >= 48 px (CTAs 56 px), `tabular-nums` en montos COP enteros, cero jerga bancaria/ERP, cero confusión entre cartera/abonos y ganancias, sin overflow horizontal en `390×844`.
- **Chosen sketch:** `.impeccable/mocks/decision/assigned.html` (Zócalo de Barrio).

## Direction contract

THESIS: Cuentia sustituye la tarjeta SaaS genérica flotando sobre gris frío por un **Zócalo de Barrio** arquitectónico: una banda superior verde esmalte ancla tienda activa, señal de red y saldo patrimonial acumulado sobre pared clara mate de máxima legibilidad solar, negándose al dashboard fintech neutro con acento azul.

OWN-WORLD: Superficie cal mate (`#FAF9F6`), tarjetas blancas planas con borde nítido (`#E2DFD5`, cero gradientes ni sombras artificiales), zócalo verde esmalte (`#145343`, borde `#0E3B30`), terracota ladrillo (`#B44C1E`) para salidas de fiado y alertas de mora, verde hoja (`#157A4A`) para abonos y paz y salvo, tinta carbón vegetal (`#18211E`). Tipografía única workhorse `Public Sans` con `tabular-nums`, etiquetas secuenciales `#042` y barras proporcionales de magnitud en filas de deudores.

STORY: El tendero confirma de un vistazo que está en su tienda correcta y con señal, lee su Total por cobrar (stock) claramente separado de Fiado hoy y Abonos hoy (flujos que no son ganancias), identifica deudores atrasados por barra y días, y toca `+ Fiar` o `$ Abonar` con el pulgar.

FIRST VIEWPORT: En `390×844`: (1) banda superior Zócalo full-bleed verde esmalte con tienda + pill de estado de red + `TOTAL POR COBRAR HOY` a `38px` bold tabular + badge de clientes + nota "No es ganancia"; (2) botones gemelos `h-14` (`+ Fiar` terracota, `$ Abonar` verde hoja); (3) sección `Movimiento del período` con selector `Hoy / Semana / Mes` y dos tarjetas planas lado a lado (`Fiado` vs `Abonos`); (4) lista `Los que más deben` con folio `#seq`, barra proporcional y días sin abono; (5) barra inferior fija de 4 destinos (`Inicio`, `Clientes`, `Movimientos`, `Más`). En `>= 1024px`, la barra inferior pasa a rail lateral izquierdo verde esmalte manteniendo la misma gramática.

FORM: Zócalo de Barrio (candidato #4 de la lista grounded), seed:d19f308d1375d54f. Elevado con escala proporcional de deuda (Carta Celeste), numeración secuencial `#seq` (Catálogo Industrial), ritmo vertical con prueba inmediata (Monocromo SaaS) y bloques planos sin gradientes (Mapa de Parque).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
