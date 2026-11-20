<script setup lang="ts">
import { ArrowLeft, CheckCircle2, FileText, Lock, Scale, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import {
  evaluateStorePlanCapabilities,
  FREE_PLAN_MAX_ACTIVE_CUSTOMERS,
} from '@/shared/lib/planPolicy'
import UiBadge from '@/shared/ui/UiBadge.vue'

const activePlanCapabilities = computed(() =>
  evaluateStorePlanCapabilities({
    planTier: 'free',
    lifecycleState: 'active',
    activeCustomersCount: 3,
  }),
)
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 flex items-center gap-2.5 lg:mt-0">
        <RouterLink
          to="/mas"
          class="inline-flex size-12 items-center justify-center rounded-xl border border-zocalo-border bg-zocalo-deep text-ground hover:bg-zocalo"
          aria-label="Volver a Más opciones"
        >
          <ArrowLeft class="size-5" :stroke-width="2.2" aria-hidden="true" />
        </RouterLink>
        <div>
          <h1 class="text-xl font-extrabold tracking-tight text-ground">
            Marco legal Colombia y compromiso de datos
          </h1>
          <p class="text-xs font-medium text-zocalo-on-muted">
            Ley 1581 de 2012 (Habeas Data) · Ley 2300 de 2023 · Política ética de datos
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <!-- 1. Naturaleza tecnológica: No Entidad Financiera -->
      <section aria-labelledby="legal-nature-heading" class="space-y-2.5 rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Scale class="size-5 text-zocalo" :stroke-width="2" aria-hidden="true" />
            <h2 id="legal-nature-heading" class="text-sm font-extrabold text-ink">
              Naturaleza del servicio (No somos entidad financiera)
            </h2>
          </div>
          <UiBadge tone="zocalo">Cuaderno digital</UiBadge>
        </div>

        <p class="text-xs leading-relaxed text-ink-muted">
          <strong class="font-bold text-ink">Cuentia</strong> es exclusivamente una herramienta tecnológica de registro y control de cuentas por cobrar para comercios de barrio. No somos una entidad financiera vigilada por la Superintendencia Financiera de Colombia (SFC), no captamos ni intermediamos dinero, no otorgamos créditos, no cobramos intereses ni actuamos como central de riesgo.
        </p>
        <p class="text-xs leading-relaxed text-ink-muted">
          En cumplimiento estricto de la <strong class="font-bold text-ink">Ley 1266 de 2008</strong>, cada tienda opera en un contenedor completamente aislado: jamás cruzamos ni compartimos listados de clientes o saldos pendientes entre distintas tiendas.
        </p>
      </section>

      <!-- 2. Ley 1581 de 2012 (Habeas Data) y Derechos ARCO -->
      <section aria-labelledby="habeas-data-heading" class="space-y-2.5 rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center gap-2">
          <ShieldCheck class="size-5 text-zocalo" :stroke-width="2" aria-hidden="true" />
          <h2 id="habeas-data-heading" class="text-sm font-extrabold text-ink">
            Protección de Datos Personales (Ley 1581 de 2012 y Decreto 1377 de 2013)
          </h2>
        </div>

        <ul class="space-y-2 text-xs leading-relaxed text-ink-muted">
          <li>
            • <strong class="font-bold text-ink">Responsable y Encargado:</strong> El propietario de cada tienda actúa como <em>Responsable del Tratamiento</em> de los datos de contacto de sus clientes vecinales; Cuentia actúa como <em>Encargado del Tratamiento</em> proveyendo la infraestructura segura y aislada.
          </li>
          <li>
            • <strong class="font-bold text-ink">Minimización de PII en WhatsApp:</strong> Los comprobantes y recordatorios enviados por <code>wa.me</code> incluyen únicamente el nombre del cliente, el nombre de la tienda y el valor en pesos (cero números de cédula ni direcciones domiciliarias).
          </li>
          <li>
            • <strong class="font-bold text-ink">Derechos ARCO y bloqueo de WhatsApp:</strong> En cualquier momento puedes actualizar datos, activar el indicador <em>No enviar mensajes de WhatsApp</em> en la ficha del cliente o anonimizar un registro histórico conservando la cuadratura contable.
          </li>
        </ul>
      </section>

      <!-- 3. Ley 2300 de 2023 ("Ley Dejen de Fregar") -->
      <section aria-labelledby="ley-2300-heading" class="space-y-2.5 rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center gap-2">
          <FileText class="size-5 text-fiado" :stroke-width="2" aria-hidden="true" />
          <h2 id="ley-2300-heading" class="text-sm font-extrabold text-ink">
            Recordatorios respetuosos (Ley 2300 de 2023)
          </h2>
        </div>

        <p class="text-xs leading-relaxed text-ink-muted">
          Para proteger la relación con tus vecinos y cumplir con la <strong class="font-bold text-ink">Ley 2300 de 2023</strong>, Cuentia verifica automáticamente la hora oficial de Bogotá (<code>America/Bogota</code>) y muestra un aviso preventivo cuando intentas enviar un recordatorio de saldo fuera del horario hábil permitido (lunes a viernes de 7:00 a.m. a 7:00 p.m. y sábados de 8:00 a.m. a 3:00 p.m.; domingos sin gestión de cobro).
        </p>
      </section>

      <!-- 4. Política Ética de Planes y Propiedad de Datos (ADR-06) -->
      <section aria-labelledby="ethical-plan-heading" class="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Lock class="size-5 text-abono" :stroke-width="2" aria-hidden="true" />
            <h2 id="ethical-plan-heading" class="text-sm font-extrabold text-ink">
              Compromiso ético: tu cartera y tu plata nunca se bloquean
            </h2>
          </div>
          <UiBadge tone="abono">
            Plan Gratis activo (hasta {{ FREE_PLAN_MAX_ACTIVE_CUSTOMERS }} clientes)
          </UiBadge>
        </div>

        <p class="text-xs leading-relaxed text-ink-muted">
          Cuentia jamás cobra comisión por tus fiados o abonos. Incluso si en el futuro decides no renovar un plan pago, nuestro motor garantiza tres derechos permanentes (<strong class="font-bold text-ink">Política Ética ADR-06</strong>):
        </p>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div class="flex items-start gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs">
            <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-abono" :stroke-width="2.2" aria-hidden="true" />
            <div>
              <p class="font-extrabold text-ink">Consulta siempre abierta</p>
              <p class="mt-0.5 text-ink-muted">Acceso total a saldos e historial de cada cliente.</p>
            </div>
          </div>

          <div class="flex items-start gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs">
            <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-abono" :stroke-width="2.2" aria-hidden="true" />
            <div>
              <p class="font-extrabold text-ink">Abonos siempre activos</p>
              <p class="mt-0.5 text-ink-muted">Siempre podrás registrar pagos para recuperar tu cartera.</p>
            </div>
          </div>

          <div class="flex items-start gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs">
            <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-abono" :stroke-width="2.2" aria-hidden="true" />
            <div>
              <p class="font-extrabold text-ink">Exportación CSV libre</p>
              <p class="mt-0.5 text-ink-muted">Descarga tu cartera completa a Excel cuando quieras.</p>
            </div>
          </div>
        </div>

        <p class="text-xs font-semibold text-ink-subtle tabular-cop">
          Estado verificado del motor: Lectura={{ activePlanCapabilities.canViewPortfolioAndHistory ? 'SI' : 'NO' }} ·
          Abonos={{ activePlanCapabilities.canRecordPayments ? 'SI' : 'NO' }} ·
          Exportación CSV={{ activePlanCapabilities.canExportCsv ? 'SI' : 'NO' }}
        </p>
      </section>
    </div>
  </AppShellLayout>
</template>
