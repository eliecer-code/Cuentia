<script setup lang="ts">
import {
  AlertCircle,
  Check,
  Copy,
  Crown,
  MessageCircle,
  Shield,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppShellLayout from '@/app/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/app/stores/auth.store'
import { useTenantStore } from '@/app/stores/tenant.store'
import { createInvitationSchema } from '@/features/team/schemas/team.schema'
import {
  createStoreInvitation,
  listPendingInvitations,
  listStoreMembers,
  revokeStoreInvitation,
  revokeStoreMember,
  transferStoreOwnership,
  updateStoreMemberRole,
  type CreatedInvitationResult,
  type StoreInvitationItem,
  type StoreMemberItem,
} from '@/features/team/services/team.service'
import { normalizeError } from '@/shared/lib/errors'
import type { StoreRole } from '@/shared/types/domain.types'
import UiBadge from '@/shared/ui/UiBadge.vue'
import UiButton from '@/shared/ui/UiButton.vue'
import UiDrawer from '@/shared/ui/UiDrawer.vue'

const authStore = useAuthStore()
const tenantStore = useTenantStore()

const members = ref<StoreMemberItem[]>([])
const invitations = ref<StoreInvitationItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const feedbackMessage = ref('')

// Drawer invitar
const inviteOpen = ref(false)
const inviteForm = reactive<{ email: string; role: 'admin' | 'employee' }>({ email: '', role: 'employee' })
const inviteError = ref('')
const inviting = ref(false)
const createdInvite = ref<CreatedInvitationResult | null>(null)
const copied = ref(false)

// Drawer revocar miembro
const revokeTarget = ref<StoreMemberItem | null>(null)
const revoking = ref(false)

// Drawer transferir propiedad
const transferTarget = ref<StoreMemberItem | null>(null)
const transferring = ref(false)

const roleLabels: Record<StoreRole, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  employee: 'Empleado',
}

const inviteLink = computed(() =>
  createdInvite.value ? `${window.location.origin}/invitacion/${createdInvite.value.plainToken}` : '',
)

const whatsappInviteUrl = computed(() => {
  if (!inviteLink.value) return '#'
  const storeName = tenantStore.activeStore?.name ?? 'mi tienda'
  const text = `Hola, te invito a entrar al cuaderno de fiados de *${storeName}* en Cuentia como ${roleLabels[inviteForm.role]}.\n\nAbre este enlace para aceptar:\n${inviteLink.value}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
})

async function loadTeam() {
  const storeId = tenantStore.activeStoreId
  if (!storeId || !authStore.backendReady) {
    // ponytail: estado demostrativo limpio cuando Supabase local aún no está conectado
    members.value = [
      {
        membershipId: 'demo-owner',
        userId: 'demo-u1',
        fullName: 'Propietario de ejemplo',
        email: 'dueno@tienda.co',
        role: 'owner',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ]
    invitations.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const [m, inv] = await Promise.all([listStoreMembers(storeId), listPendingInvitations(storeId)])
    members.value = m
    invitations.value = inv
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenantEpoch, () => {
  void loadTeam()
})

onMounted(() => {
  void loadTeam()
})

function openInviteDrawer() {
  inviteForm.email = ''
  inviteForm.role = 'employee'
  inviteError.value = ''
  createdInvite.value = null
  copied.value = false
  inviteOpen.value = true
}

async function submitInvitation() {
  inviteError.value = ''
  const parsed = createInvitationSchema.safeParse(inviteForm)
  if (!parsed.success) {
    inviteError.value = parsed.error.issues[0]?.message ?? 'Revisa los datos de la invitación.'
    return
  }
  if (!tenantStore.activeStoreId || !authStore.backendReady) {
    inviteError.value = 'Conecta Firebase en .env para enviar invitaciones reales.'
    return
  }

  inviting.value = true
  try {
    createdInvite.value = await createStoreInvitation(
      tenantStore.activeStoreId,
      parsed.data.email,
      parsed.data.role,
    )
    await loadTeam()
  } catch (err) {
    inviteError.value = normalizeError(err).userMessage
  } finally {
    inviting.value = false
  }
}

async function copyInviteLink() {
  if (!inviteLink.value) return
  await navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

async function cancelInvitation(id: string) {
  if (!tenantStore.activeStoreId) return
  try {
    await revokeStoreInvitation(tenantStore.activeStoreId, id)
    feedbackMessage.value = 'Invitación cancelada.'
    await loadTeam()
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  }
}

async function toggleRole(member: StoreMemberItem) {
  if (!tenantStore.activeStoreId || !tenantStore.isOwner || member.role === 'owner') return
  const nextRole: 'admin' | 'employee' = member.role === 'admin' ? 'employee' : 'admin'
  try {
    await updateStoreMemberRole(tenantStore.activeStoreId, member.userId, nextRole)
    feedbackMessage.value = `${member.fullName} ahora es ${roleLabels[nextRole]}.`
    await loadTeam()
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  }
}

async function confirmRevoke() {
  if (!tenantStore.activeStoreId || !revokeTarget.value) return
  revoking.value = true
  try {
    await revokeStoreMember(tenantStore.activeStoreId, revokeTarget.value.userId)
    feedbackMessage.value = `Acceso revocado a ${revokeTarget.value.fullName}. Su historial quedó intacto.`
    revokeTarget.value = null
    await loadTeam()
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    revoking.value = false
  }
}

async function confirmTransfer() {
  if (!tenantStore.activeStoreId || !transferTarget.value) return
  transferring.value = true
  try {
    await transferStoreOwnership(tenantStore.activeStoreId, transferTarget.value.userId)
    feedbackMessage.value = `Propiedad transferida a ${transferTarget.value.fullName}.`
    transferTarget.value = null
    await tenantStore.loadStores()
    await loadTeam()
  } catch (err) {
    errorMessage.value = normalizeError(err).userMessage
  } finally {
    transferring.value = false
  }
}
</script>

<template>
  <AppShellLayout>
    <template #zocalo>
      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-3 lg:mt-0">
        <div>
          <h1 class="text-xl font-extrabold tracking-tight text-ground">Equipo y permisos</h1>
          <p class="mt-0.5 text-xs font-medium text-zocalo-on-muted">
            Cada persona entra con su propia cuenta para saber quién registró cada fiado o abono.
          </p>
        </div>
        <UiButton variant="secondary" size="md" @click="openInviteDrawer">
          <UserPlus class="size-4" :stroke-width="2.2" aria-hidden="true" />
          <span>Invitar empleado</span>
        </UiButton>
      </div>
    </template>

    <div class="space-y-5">
      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>

      <div
        v-if="feedbackMessage"
        role="status"
        class="rounded-xl border border-abono bg-abono-soft px-3.5 py-2.5 text-sm font-bold text-abono"
      >
        {{ feedbackMessage }}
      </div>

      <!-- Resumen claro de roles -->
      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading" class="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
          Qué puede hacer cada rol
        </h2>
        <div class="grid gap-2.5 sm:grid-cols-3">
          <div class="rounded-xl border border-border bg-surface p-3.5">
            <div class="flex items-center gap-1.5 text-xs font-extrabold text-zocalo">
              <Crown class="size-4" :stroke-width="2.2" aria-hidden="true" />
              <span>Dueño</span>
            </div>
            <p class="mt-1 text-xs text-ink-muted">Control total, reportes, anulaciones, exportación y transferencia de tienda.</p>
          </div>
          <div class="rounded-xl border border-border bg-surface p-3.5">
            <div class="flex items-center gap-1.5 text-xs font-extrabold text-ink">
              <Shield class="size-4" :stroke-width="2.2" aria-hidden="true" />
              <span>Administrador</span>
            </div>
            <p class="mt-1 text-xs text-ink-muted">Gestiona clientes, cupos, anulaciones e invita empleados. No puede remover al dueño.</p>
          </div>
          <div class="rounded-xl border border-border bg-surface p-3.5">
            <div class="flex items-center gap-1.5 text-xs font-extrabold text-ink-muted">
              <Users class="size-4" :stroke-width="2.2" aria-hidden="true" />
              <span>Empleado</span>
            </div>
            <p class="mt-1 text-xs text-ink-muted">Registra fiados y abonos del día. No edita cupos, no borra registros ni exporta cartera.</p>
          </div>
        </div>
      </section>

      <!-- Lista de miembros -->
      <section aria-labelledby="members-heading">
        <h2 id="members-heading" class="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
          Miembros de la tienda
        </h2>
        <div v-if="loading" class="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
          Cargando equipo...
        </div>
        <ul v-else class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          <li
            v-for="member in members"
            :key="member.membershipId"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-extrabold text-ink">{{ member.fullName }}</p>
                <UiBadge :tone="member.role === 'owner' ? 'zocalo' : 'neutral'">
                  {{ roleLabels[member.role] }}
                </UiBadge>
                <UiBadge :tone="member.status === 'active' ? 'abono' : 'danger'">
                  {{ member.status === 'active' ? 'Activo' : 'Revocado' }}
                </UiBadge>
              </div>
              <p v-if="member.email" class="mt-0.5 text-xs text-ink-subtle">{{ member.email }}</p>
            </div>

            <div
              v-if="member.status === 'active' && member.role !== 'owner' && (tenantStore.isOwner || member.role === 'employee')"
              class="flex flex-wrap items-center gap-2"
            >
              <button
                v-if="tenantStore.isOwner"
                type="button"
                class="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold text-ink hover:bg-surface-muted cursor-pointer"
                @click="toggleRole(member)"
              >
                Cambiar a {{ member.role === 'admin' ? 'Empleado' : 'Admin' }}
              </button>
              <button
                v-if="tenantStore.isOwner && member.role === 'admin'"
                type="button"
                class="min-h-12 rounded-xl border border-zocalo bg-zocalo-soft px-3 text-xs font-bold text-zocalo hover:opacity-90 cursor-pointer"
                @click="transferTarget = member"
              >
                Transferir propiedad
              </button>
              <button
                type="button"
                class="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-danger bg-danger-soft px-3 text-xs font-bold text-danger hover:opacity-90 cursor-pointer"
                @click="revokeTarget = member"
              >
                <UserMinus class="size-4" :stroke-width="2" aria-hidden="true" />
                <span>Quitar acceso</span>
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Invitaciones pendientes -->
      <section v-if="invitations.length > 0" aria-labelledby="invites-heading">
        <h2 id="invites-heading" class="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
          Invitaciones pendientes
        </h2>
        <ul class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          <li
            v-for="inv in invitations"
            :key="inv.id"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-ink">{{ inv.invitedEmail }}</p>
              <p class="text-xs text-ink-subtle">Rol: {{ roleLabels[inv.role] }} · Pendiente</p>
            </div>
            <button
              type="button"
              class="min-h-12 rounded-xl border border-border-strong px-3 text-xs font-bold text-danger hover:bg-danger-soft cursor-pointer"
              @click="cancelInvitation(inv.id)"
            >
              Cancelar
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- Drawer: Invitar colaborador -->
    <UiDrawer
      :open="inviteOpen"
      title="Invitar colaborador"
      description="Genera un enlace seguro válido por 72 horas para compartir por WhatsApp."
      @update:open="inviteOpen = $event"
    >
      <div v-if="createdInvite" class="space-y-4">
        <div class="rounded-xl border border-abono bg-abono-soft p-3.5 text-sm text-ink">
          <p class="font-extrabold text-abono">Invitación lista para compartir</p>
          <p class="mt-1 text-xs text-ink-muted">
            Solo funcionará con el correo <strong>{{ inviteForm.email }}</strong> y vence en 72 horas.
          </p>
        </div>

        <a
          :href="whatsappInviteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-abono px-4 text-base font-bold text-ground hover:bg-abono-hover"
        >
          <MessageCircle class="size-5" :stroke-width="2.2" aria-hidden="true" />
          <span>Compartir por WhatsApp</span>
        </a>

        <UiButton variant="secondary" size="lg" block @click="copyInviteLink">
          <Check v-if="copied" class="size-5 text-abono" :stroke-width="2.4" aria-hidden="true" />
          <Copy v-else class="size-5" :stroke-width="2" aria-hidden="true" />
          <span>{{ copied ? 'Enlace copiado' : 'Copiar enlace' }}</span>
        </UiButton>
      </div>

      <form v-else class="space-y-4" novalidate @submit.prevent="submitInvitation">
        <div
          v-if="inviteError"
          role="alert"
          class="rounded-xl border border-danger bg-danger-soft p-3 text-xs font-bold text-danger"
        >
          {{ inviteError }}
        </div>

        <div>
          <label for="invite-email" class="block text-sm font-bold text-ink">Correo del colaborador</label>
          <input
            id="invite-email"
            v-model="inviteForm.email"
            type="email"
            placeholder="empleado@correo.com"
            class="mt-1.5 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink focus:border-zocalo focus:outline-none"
          />
        </div>

        <fieldset>
          <legend class="block text-sm font-bold text-ink">Rol en la tienda</legend>
          <div class="mt-1.5 grid grid-cols-2 gap-2.5">
            <label
              :class="[
                'flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold',
                inviteForm.role === 'employee'
                  ? 'border-zocalo bg-zocalo-soft text-zocalo'
                  : 'border-border-strong bg-surface text-ink-muted',
              ]"
            >
              <input v-model="inviteForm.role" type="radio" value="employee" class="sr-only" />
              Empleado
            </label>
            <label
              v-if="tenantStore.isOwner || !authStore.backendReady"
              :class="[
                'flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold',
                inviteForm.role === 'admin'
                  ? 'border-zocalo bg-zocalo-soft text-zocalo'
                  : 'border-border-strong bg-surface text-ink-muted',
              ]"
            >
              <input v-model="inviteForm.role" type="radio" value="admin" class="sr-only" />
              Administrador
            </label>
          </div>
        </fieldset>

        <UiButton type="submit" variant="zocalo" size="lg" block :loading="inviting">
          Crear invitación
        </UiButton>
      </form>
    </UiDrawer>

    <!-- Drawer: Confirmar revocación -->
    <UiDrawer
      :open="revokeTarget !== null"
      :title="`¿Quitar el acceso a ${revokeTarget?.fullName ?? ''}?`"
      description="No podrá volver a entrar a tu tienda ni ver tus clientes. Todos los fiados y abonos que registró seguirán guardados en el historial."
      @update:open="(val) => { if (!val) revokeTarget = null }"
    >
      <div class="flex gap-2.5">
        <UiButton variant="secondary" size="lg" block @click="revokeTarget = null">
          Cancelar
        </UiButton>
        <UiButton variant="fiado" size="lg" block :loading="revoking" @click="confirmRevoke">
          Sí, quitar acceso
        </UiButton>
      </div>
    </UiDrawer>

    <!-- Drawer: Confirmar transferencia de propiedad -->
    <UiDrawer
      :open="transferTarget !== null"
      :title="`¿Transferir tienda a ${transferTarget?.fullName ?? ''}?`"
      description="Esta persona pasará a ser el nuevo Dueño y tu cuenta quedará como Administrador. Esta acción queda registrada en auditoría."
      @update:open="(val) => { if (!val) transferTarget = null }"
    >
      <div class="flex gap-2.5">
        <UiButton variant="secondary" size="lg" block @click="transferTarget = null">
          Cancelar
        </UiButton>
        <UiButton variant="zocalo" size="lg" block :loading="transferring" @click="confirmTransfer">
          Confirmar transferencia
        </UiButton>
      </div>
    </UiDrawer>
  </AppShellLayout>
</template>
