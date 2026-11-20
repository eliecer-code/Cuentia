---
name: Cuentia
description: Zócalo de Barrio — Sistema visual mobile-first de alto contraste solar para gestión de fiados en tiendas de barrio de Colombia.
colors:
  zocalo-esmalte: "#145343"
  zocalo-profundo: "#0E3B30"
  zocalo-hover: "#104437"
  zocalo-suave: "#E6F2EE"
  zocalo-texto-claro: "#CBEAD9"
  terracota-fiado: "#B44C1E"
  terracota-fiado-hover: "#963E18"
  terracota-fiado-suave: "#FBECE5"
  verde-abono: "#157A4A"
  verde-abono-hover: "#10633C"
  verde-abono-suave: "#E5F5EC"
  rojo-alerta: "#B42318"
  rojo-alerta-suave: "#FEECEB"
  cal-mate: "#FAF9F6"
  papel-blanco: "#FFFFFF"
  cal-borde-suave: "#ECEAE3"
  borde-nítido: "#E2DFD5"
  borde-fuerte: "#C9C4B6"
  tinta-carbon: "#18211E"
  tinta-secundaria: "#4A5954"
  tinta-sutil: "#5B6B65"
typography:
  display:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-fiado:
    backgroundColor: "{colors.terracota-fiado}"
    textColor: "{colors.cal-mate}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "0 20px"
  button-fiado-hover:
    backgroundColor: "{colors.terracota-fiado-hover}"
  button-abono:
    backgroundColor: "{colors.verde-abono}"
    textColor: "{colors.cal-mate}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "0 20px"
  button-abono-hover:
    backgroundColor: "{colors.verde-abono-hover}"
  button-secondary:
    backgroundColor: "{colors.papel-blanco}"
    textColor: "{colors.tinta-carbon}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "0 16px"
  badge-folio:
    backgroundColor: "{colors.zocalo-suave}"
    textColor: "{colors.zocalo-esmalte}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  card-flat:
    backgroundColor: "{colors.papel-blanco}"
    textColor: "{colors.tinta-carbon}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  input-cop:
    backgroundColor: "{colors.papel-blanco}"
    textColor: "{colors.tinta-carbon}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "12px 16px"
---

# Design System: Cuentia

## Overview

**Creative North Star: "Zócalo de Barrio"**

Cuentia traduce la arquitectura cotidiana de una tienda de esquina colombiana —pared blanca de cal mate rematada por un zócalo verde esmalte sólido— a una interfaz operativa *mobile-first* hecha para leerse bajo luz solar y usarse con una sola mano detrás del mostrador. En lugar de tarjetas flotantes grises con acento azul genérico, una banda estructural verde esmalte ancla la identidad de la tienda, el estado de red y el saldo patrimonial acumulado (*Total por cobrar*), dejando la pared clara libre para la acción diaria.

El sistema privilegia velocidad de lectura, cero ruido decorativo y honestidad financiera: bloques planos sin gradientes ni sombras artificiales, contraste WCAG AAA en cifras críticas, numeración secuencial `#seq` en registros del libro mayor y barras proporcionales de deuda que permiten ubicar morosos en menos de dos segundos.

**Key Characteristics:**
- Banda estructural verde esmalte (superior en móvil, rail lateral izquierdo a altura completa en escritorio) con moldura sólida de 4px.
- Superficies planas sobre cal mate separadas por bordes nítidos de 1px, sin sombras suaves ni glassmorphism.
- Codificación semántica inequívoca con ícono + texto + color: terracota para fiados/mora y verde hoja para abonos/paz y salvo.
- Ergonomía de mostrador: áreas táctiles mínimas de 48px, CTAs principales de 56px y numerales tabulares (`tabular-nums`) en todo valor COP.

## Colors

Paleta contenida de alto contraste solar que asigna un trabajo operativo exacto a cada color.

### Primary
- **Zócalo Esmalte** (`zocalo-esmalte`): Banda superior móvil, rail de navegación en escritorio, enlaces de acción y foco activo.
- **Zócalo Profundo** (`zocalo-profundo`): Borde arquitectónico de 4px del zócalo, cápsulas internas de estado y estado presionado.
- **Zócalo Suave** (`zocalo-suave`): Fondo exclusivo de folios secuenciales (`#042`) e íconos de sección.

### Secondary
- **Terracota Fiado** (`terracota-fiado`): Acción primaria `+ Fiar`, indicadores de salidas a crédito, barras proporcionales de deuda y alertas de días sin abonar o montos altos (con fondo `terracota-fiado-suave`).

### Tertiary
- **Verde Abono** (`verde-abono`): Acción primaria `Abonar`, entradas de recaudo y estados de cuenta al día / paz y salvo (con fondo `verde-abono-suave`).
- **Rojo Alerta** (`rojo-alerta`): Reservado estrictamente para errores de validación, bloqueos de cuenta y anulaciones destructivas.

### Neutral
- **Cal Mate** (`cal-mate`): Fondo principal de toda la aplicación y color de texto sobre superficies oscuras del zócalo y CTAs.
- **Papel Blanco** (`papel-blanco`): Superficie de tarjetas planas, filas de clientes, campos de texto y barra inferior móvil.
- **Borde Nítido / Fuerte** (`borde-nítido`, `borde-fuerte`): Delimitación de 1px en tarjetas, divisores de lista y bordes de inputs táctiles.
- **Tinta Carbón / Secundaria / Sutil** (`tinta-carbon`, `tinta-secundaria`, `tinta-sutil`): Jerarquía tipográfica manteniendo siempre contraste superior a 5.5:1 sobre blanco.

### Named Rules
**The Zócalo Anchor Rule.** El verde esmalte pertenece exclusivamente a la arquitectura de navegación, la banda patrimonial superior y los enlaces de contexto; nunca invade las tarjetas de flujo diario ni los botones de acción de dinero.

**The Semantic Money Rule.** Terracota significa deuda que sube o mora; verde hoja significa plata que entra o cuenta saldada. Nunca se intercambian ni se usan como decoración.

## Typography

**Display & Body Font:** `Public Sans Variable` (autoalojada con `@fontsource-variable/public-sans`, respaldo `system-ui, sans-serif`).

**Character:** Familia única neo-grotesca de gran altura-x y claridad cívica, diseñada para leerse a distancia bajo reflejo de luz sin necesidad de emparejamientos editoriales.

### Hierarchy
- **Display** (`800`, `2.25rem` móvil / `3rem` escritorio, `line-height 1.05`, `tabular-nums`): Exclusivo para el monto hero de *Total por cobrar hoy*.
- **Headline** (`800`, `1.5rem`, `line-height 1.15`, `tabular-nums`): Totales de flujo (*Fiado hoy*, *Abonos hoy*) e input numérico COP en el Drawer (`1.875rem`).
- **Title** (`800`, `1rem–1.125rem`, `line-height 1.25`): Títulos de Drawer, encabezados de vista secundaria y nombres de clientes.
- **Body** (`500`, `0.875rem`, `line-height 1.45`): Descripciones breves, referencias de clientes y mensajes de estado o error.
- **Label** (`800`, `0.75rem`, `letter-spacing 0.06em`, mayúsculas): Encabezados de sección (*Movimiento del período*, *Los que más deben*) y etiquetas de navegación.

### Named Rules
**The Tabular COP Rule.** Toda cifra de dinero, folio secuencial (`#042`), contador de clientes y conteo de días aplica `font-variant-numeric: tabular-nums` y `whitespace-nowrap` en el par símbolo-monto (`$ 250.000`) para evitar saltos visuales o cortes huérfanos.

## Layout

Arquitectura responsiva de columna única centrada (`max-w-4xl`) sobre `390×844` como lienzo primario:
- **Móvil (`< 1024px`):** Banda superior Zócalo full-bleed, área de trabajo con padding horizontal `16px` y ritmo vertical `16px`, y navegación inferior `sticky bottom-0` de 4 destinos con `safe-area-inset-bottom`.
- **Escritorio (`>= 1024px`):** Grilla de dos columnas (`248px` de rail lateral izquierdo verde esmalte cubriendo el 100% de altura + contenido fluido con padding `32px`).
- **Regla de ritmo:** Siempre existe más espacio encima de un encabezado de sección (`16–20px`) que debajo (`6–8px`).

## Elevation & Depth

Sistema **estrictamente plano (cero sombras decorativas)** que expresa jerarquía mediante contraste tonal y bordes nítidos de `1px` (`borde-nítido`) sobre `cal-mate`. La única separación arquitectónica gruesa es el borde de `4px` (`zocalo-profundo`) que remata la banda del zócalo y su rail lateral. Los overlays (`UiDrawer`) usan un velo neutro (`tinta-carbon` al 50%) para aislar el foco sin desenfoques decorativos.

### Named Rules
**The Flat Countertop Rule.** Las superficies descansan planas con bordes nítidos de 1px; nunca se apilan tarjetas dentro de tarjetas ni se añaden sombras difusas o halos de color.

## Shapes

Geometría funcional y táctil: esquinas medianas (`12px`) en botones, tarjetas e inputs; esquinas compactas (`6px`) en folios `#seq` y badges de conteo; `16px` exclusivamente en el borde superior del Drawer móvil (y completo en modal escritorio); cápsula completa (`9999px`) solo en el indicador de conectividad y barras proporcionales de deuda.

## Components

### Buttons (`UiButton`)
Controles táctiles firmes y previsibles en todo el sistema:
- **Shape:** Esquinas medianas (`12px`), altura mínima `56px` (`lg`) para CTAs de mostrador y `48px` (`md`) para acciones secundarias.
- **Variantes:** `fiado` (`terracota-fiado`), `abono` (`verde-abono`), `zocalo` (`zocalo-esmalte`), `secondary` (`papel-blanco` con borde `borde-fuerte`) y `ghost`.
- **Estados:** Transición rápida de color (`150ms`), foco visible de `2.5px` en `zocalo-esmalte`, estado `disabled` al 50% y estado `loading` con spinner inline sin colapsar ancho.

### Badges & Folios (`UiBadge`)
Etiquetas compactas tabulares (`6px` de radio, `2px 8px` de padding) usadas para folios secuenciales (`#042` en `zocalo-suave`), estados de cuenta y alertas de mora.

### Flat Cards & Lists
Contenedores planos en `papel-blanco` con borde `1px` en `borde-nítido`, radio `12px` y divisores internos de `1px`. En listas de clientes integran folio secuencial + barra proporcional de deuda (`6px` de alto).

### COP Amount Input & Quick Chips
Input monetario de `56px+` con prefijo `$` fijo, borde de `2px` en `borde-fuerte` que vira a `zocalo-esmalte` al enfocar, teclado `inputmode="numeric"` y chips aditivos (`+1.000`, `+5.000`, `+10.000`, `+20.000`) de `48px` de alto mínimo.

### Drawer (`UiDrawer` / Reka UI)
Sheet inferior anclado en móvil (`rounded-t-2xl`, `pb-safe`) que se transforma en diálogo centrado desde `768px`, con botón de cierre de `48×48px` y bloqueo de foco accesible.

### Navigation (`AppShellLayout`)
Barra inferior fija (`sticky bottom-0`) con 4 destinos (`Inicio`, `Clientes`, `Movimientos`, `Más`) y marcador superior de `4px` en el ítem activo; en `>= 1024px` se convierte en rail lateral izquierdo verde esmalte con estado de conexión en la base.

## Do's and Don'ts

### Do:
- **Do** mantener todo objetivo táctil en `>= 48px` (tabs, enlaces de acción, botón de cerrar) y los CTAs de dinero en `56px`.
- **Do** separar visualmente *Total por cobrar* (stock en el zócalo) de *Fiado* y *Abonos* del período (flujo en tarjetas planas), aclarando que no son ganancias.
- **Do** usar íconos uniformes de `lucide-vue-next` (`stroke-width` 2–2.4) en lugar de flechas o puntos Unicode.
- **Do** conservar la misma altura y una sola línea (`whitespace-nowrap`) en pares de botones de confirmación dentro de Drawers.

### Don't:
- **Don't** colocar eyebrows o kickers encima de un heading; el propio encabezado lleva la jerarquía.
- **Don't** usar gradientes, sombras difusas, glassmorphism, bordes laterales gruesos de acento (`border-l-4`) ni tarjetas anidadas.
- **Don't** exponer jerga bancaria/ERP ni mensajes SQL crudos en la interfaz del tendero.
- **Don't** usar colores sin texto ni ícono acompañante para diferenciar fiados, abonos o estados de red.
