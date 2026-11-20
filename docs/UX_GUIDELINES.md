# Guías de Experiencia de Usuario (UX) — Cuentia (MVP)

> **Responsabilidad única (SSOT):** Principios ergonómicos *mobile-first*, arquitectura de navegación, glosario colombiano, diseño conceptual de las 11 pantallas, flujos de WhatsApp y patrones de estado.  
> **Nota Impeccable:** La identidad visual definitiva (paleta, tipografía, tokens y `DESIGN.md`) se establecerá y documentará en Fase 1 mediante el flujo *Operate / code-first* de Impeccable, evitando definir estilos genéricos prematuros aquí.

---

## 1. Principios de Mostrador (*Operate Mode*)

1. **Una sola mano (Thumb Zone):** Navegación inferior fija (`Bottom Nav` con 4 destinos en móvil: *Inicio*, *Clientes*, *Movimientos*, *Más*; `Sidebar` en desktop) y formularios rápidos de fiado/abono en `Drawer` desde abajo (`Dialog` en desktop).
2. **Velocidad < 10 segundos:** Registrar fiado o abono toma ≤ 3 toques desde la ficha del cliente. Teclado numérico inmediato (`inputmode="numeric"`), `Efectivo` preseleccionado en abonos y atajo 1-toque `Saldar todo`.
3. **Ergonomía táctil y legibilidad exterior:** Áreas interactivas ≥ 48×48 px, CTAs primarios de 56 px, contraste ≥ 7:1 (WCAG AAA) para luz solar de mostrador y `tabular-nums` obligatorio en toda cifra monetaria.
4. **Semántica redundante:** Todo estado (fiado, abono, paz y salvo, supera tope, anulado) combina texto claro + ícono direccional + color (nunca solo color).
5. **Prevención de errores de ceros en COP:** Formato en vivo `$ 15.000` sin decimales; chips rápidos aditivos en fiado (`+1.000`, `+2.000`, `+5.000`, `+10.000`, `+20.000`); confirmación inline con monto en letras si el valor supera un umbral inusual (ej. `> $ 200.000`); bloqueo síncrono anti-doble-tap al guardar.

---

## 2. Glosario Obligatorio (Español Colombiano de Barrio)

| Evitar (jerga ERP/bancaria) | Usar en Cuentia |
| :--- | :--- |
| Cuenta por cobrar neta / Cartera activa | **Total por cobrar** ("Plata en la calle hoy") |
| Cargo / Débito / Crédito otorgado | **Fiado** / **Compra fiada** |
| Amortización / Recaudo neto | **Abono** / **Plata que entró** |
| Saldo deudor / Balance | **Debe** / **Saldo pendiente** |
| Liquidado / Saldo cero | **Al día** / **Paz y salvo** |
| Reversión contable / Nota crédito | **Anular movimiento** |
| Límite de crédito aprobado | **Tope de fiado** |
| Saldo inicial de migración | **Saldo de cuaderno** |

---

## 3. Onboarding (< 2 Minutos) y Migración de Cuadernos

1. **Paso 1 — Cuenta:** Nombre, correo y contraseña (con botón visible de mostrar/ocultar).
2. **Paso 2 — Tienda:** Nombre de la tienda (obligatorio) y WhatsApp del negocio (opcional, prefijo `+57`). Moneda (`COP`) y zona horaria (`America/Bogota`) configuradas automáticamente sin preguntas técnicas.
3. **Dashboard con estado vacío accionable:** Dos rutas directas: **`Pasar cliente del cuaderno`** (bucle ultrarrápido Nombre + Saldo actual del cuaderno + WhatsApp opcional + botón *"Guardar y pasar otro"*) y **`Registrar primer fiado nuevo`**.

---

## 4. Diseño Conceptual de las 11 Pantallas

1. **Login y recuperación:** Formulario de una columna, botón grande de ojo en contraseña, CTA `Entrar a mi tienda`, recuperación por correo con enfriamiento de reenvío.
2. **Registro de tienda (Onboarding):** 2 pasos con progreso claro, cero módulos innecesarios.
3. **Dashboard (Inicio):**
   - **Bloque Hero — STOCK:** `TOTAL POR COBRAR HOY` + badge `# clientes deben` + aclaración permanente *"Plata en la calle acumulada · No es ganancia"*.
   - **Botones gemelos inmediatos:** `+ Fiar` y `$ Abonar`.
   - **Bloque separado — FLUJOS DEL PERÍODO** (`Hoy` | `Semana` | `Mes`): **Fiado en el período** vs **Abonos recaudados** (*"Plata que entró · No son ganancias"*).
   - **Top deudores** (3–5 mayores saldos con días sin abonar) y **Movimientos recientes** (últimos 5).
4. **Listado de clientes:** Buscador sticky (nombre/apodo/teléfono), filtros rápidos (`Con deuda` default, `Todos`, `Al día`), selector de orden (`Mayor deuda`, `Más días sin abonar`, `Reciente`), botón `+ Nuevo cliente` (y CTA inline `+ Crear "[texto buscado]"` si no hay resultados).
5. **Perfil de cliente:** Saldo gigante + estado + barra de tope (si aplica), botón WhatsApp dedicado, extracto cronológico agrupado por fecha mostrando saldo resultante (`Quedó en $X`) y detalle al tocar (con `Anular movimiento`), y barra sticky inferior con `+ Fiar` y `$ Abonar`.
6. **Registrar compra fiada (`Drawer`):** Selector de cliente si se abre desde Dashboard, input COP gigante, chips aditivos, vista previa en vivo (`Debe $30.000 → Queda debiendo $45.000`), alerta de tope/monto alto, nota opcional, CTA anti-doble-tap y Toast con atajo WhatsApp.
7. **Registrar abono (`Drawer`):** Botón 1-toque `Saldar todo ($X)`, input COP + chips, selector táctil 2×2 (`Efectivo` default, `Nequi`, `Daviplata`, `Otro`), vista previa del nuevo saldo (`¡Paz y salvo!` si queda en `$0`), y confirmación con CTA **`Enviar comprobante por WhatsApp`**.
8. **Historial global:** Buscador + filtros por fecha (`Hoy` default, `Ayer`, `7 días`, `Mes`, `Rango`), tipo, método de pago y responsable + tira resumen del filtro activo para cuadrar caja sin calculadora.
9. **Reportes básicos:** Selector de período (`Hoy`, `Esta semana`, `Este mes`), flujo del período, desglose visual de abonos por método de pago (cajón vs celular), foto separada de cartera total, morosos (`+15d`, `+30d`, `+60d`) con botón WhatsApp y exportación CSV (Pro / `owner`).
10. **Configuración de tienda:** 4 secciones claras: Datos de la tienda, Plantillas WhatsApp (selector de tono + chips insertables + vista previa en burbuja), Reglas de fiado/tope/reversión de empleados, y bloque informativo `Colombia · COP · Hora de Bogotá`.
11. **Gestión de empleados:** Explicación simple de roles (`Dueño`, `Administrador`, `Empleado`), lista con estado (`Activo`, `Invitación pendiente`, `Revocado`), invitación con botón `Compartir invitación por WhatsApp` y confirmación clara de revocación garantizando preservación del historial.

---

## 5. WhatsApp y Comprobantes (MVP)

- **Vista previa editable en 1 toque:** Siempre permite revisar/editar el mensaje antes de abrir `https://wa.me/57{tel}?text=...`. Si el cliente no tiene teléfono guardado, ofrece guardarlo inline o abrir `https://wa.me/?text=...` para elegir contacto.
- **Comprobante visual:** Tarjeta limpia en PNG generada en cliente compartible por `navigator.share({ files })` o descargable.
- **Tono respetuoso y privacidad:** Nunca usar lenguaje intimidatorio ni incluir cédulas/direcciones; respetar `whatsapp_opt_out` y mostrar aviso no bloqueante fuera de horario hábil (Ley 2300).

---

## 6. Estados de Carga, Vacío, Error y Sin Conexión

- **Carga:** Skeletons que respetan la geometría de la vista (sin saltos visuales ni overlays bloqueantes); en mutaciones, spinner dentro del propio botón.
- **Estados vacíos:** Siempre accionables (enseñan el siguiente paso útil).
- **Errores:** Español simple indicando `[qué pasó] + [tus datos siguen intactos] + [qué hacer]`. Nunca limpiar un formulario tras un fallo de red.
- **Sin conexión (MVP honesto):** Banner fijo no bloqueante `"Sin internet · Puedes consultar saldos guardados, pero necesitas señal para fiar o abonar"` con sello `"Última actualización: hace X min"`; al reconectar, aviso breve y refresco automático.
