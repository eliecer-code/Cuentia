import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { normalizeError } from '@/shared/lib/errors'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/shared/lib/firebase'
import type { InvitationStatus, MembershipStatus, StoreRole } from '@/shared/types/domain.types'
import { generateSecureTokenHex, sha256Hex } from '@/shared/utils/crypto'

export interface StoreMemberItem {
  membershipId: string
  userId: string
  fullName: string
  email: string | null
  role: StoreRole
  status: MembershipStatus
  createdAt: string
}

export interface StoreInvitationItem {
  id: string
  invitedEmail: string
  role: StoreRole
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

export interface CreatedInvitationResult {
  invitationId: string
  plainToken: string
  expiresAt: string
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

export async function listStoreMembers(storeId: string): Promise<StoreMemberItem[]> {
  if (!isFirebaseConfigured()) return []
  try {
    const db = getFirebaseDb()
    const snap = await getDocs(
      query(collection(db, 'stores', storeId, 'members'), orderBy('createdAt', 'asc')),
    )
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        membershipId: d.id,
        userId: String(data.userId ?? d.id),
        fullName: String(data.fullName ?? 'Usuario'),
        email: (data.email as string | null) ?? null,
        role: data.role as StoreRole,
        status: data.status as MembershipStatus,
        createdAt: toIso(data.createdAt),
      }
    })
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function listPendingInvitations(storeId: string): Promise<StoreInvitationItem[]> {
  if (!isFirebaseConfigured()) return []
  try {
    const db = getFirebaseDb()
    const snap = await getDocs(
      query(
        collection(db, 'invitations'),
        where('storeId', '==', storeId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
      ),
    )
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        invitedEmail: String(data.invitedEmail ?? ''),
        role: data.role as StoreRole,
        status: data.status as InvitationStatus,
        expiresAt: toIso(data.expiresAt),
        createdAt: toIso(data.createdAt),
      }
    })
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function createStoreInvitation(
  storeId: string,
  email: string,
  role: Extract<StoreRole, 'admin' | 'employee'>,
): Promise<CreatedInvitationResult> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const cleanEmail = email.trim().toLowerCase()
    const plainToken = generateSecureTokenHex(32)
    const tokenHash = await sha256Hex(plainToken)
    const expiresDate = new Date(Date.now() + 72 * 60 * 60 * 1000)

    const batch = writeBatch(db)
    batch.set(doc(db, 'invitations', tokenHash), {
      storeId,
      invitedEmail: cleanEmail,
      role,
      status: 'pending',
      invitedBy: user.uid,
      expiresAt: Timestamp.fromDate(expiresDate),
      acceptedAt: null,
      createdAt: serverTimestamp(),
    })

    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole: 'manager',
      action: 'invitation.created',
      entityType: 'store_invitation',
      entityId: tokenHash,
      beforeState: null,
      afterState: { invitedEmail: cleanEmail, role },
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      invitationId: tokenHash,
      plainToken,
      expiresAt: expiresDate.toISOString(),
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function acceptStoreInvitation(plainToken: string): Promise<{ storeId: string; role: StoreRole }> {
  const user = getFirebaseAuth().currentUser
  if (!user || !user.email) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const tokenHash = await sha256Hex(plainToken)
    const invRef = doc(db, 'invitations', tokenHash)

    return await runTransaction(db, async (tx) => {
      const invSnap = await tx.get(invRef)
      if (!invSnap.exists()) throw { code: 'CU_INVITATION_INVALID' }

      const inv = invSnap.data()
      if (inv.status !== 'pending') throw { code: 'CU_INVITATION_INVALID' }
      if (inv.expiresAt instanceof Timestamp && inv.expiresAt.toDate() < new Date()) {
        throw { code: 'CU_INVITATION_INVALID' }
      }
      if (String(inv.invitedEmail).toLowerCase() !== user.email!.toLowerCase()) {
        throw { code: 'CU_INVITATION_EMAIL_MISMATCH' }
      }

      const storeId = String(inv.storeId)
      const role = inv.role as StoreRole
      const memberRef = doc(db, 'stores', storeId, 'members', user.uid)
      const userMembershipRef = doc(db, 'users', user.uid, 'memberships', storeId)

      tx.update(invRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      })

      tx.set(
        memberRef,
        {
          storeId,
          userId: user.uid,
          fullName: user.displayName || user.email!.split('@')[0] || 'Colaborador',
          email: user.email!.toLowerCase(),
          role,
          status: 'active',
          invitedBy: inv.invitedBy,
          invitationTokenHash: tokenHash,
          revokedAt: null,
          revokedBy: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      tx.set(userMembershipRef, {
        storeId,
        role,
        status: 'active',
        updatedAt: serverTimestamp(),
      })

      tx.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
        storeId,
        actorUserId: user.uid,
        actorRole: role,
        action: 'invitation.accepted',
        entityType: 'store_invitation',
        entityId: tokenHash,
        beforeState: null,
        afterState: { userId: user.uid, role },
        createdAt: serverTimestamp(),
      })

      return { storeId, role }
    })
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function revokeStoreInvitation(storeId: string, invitationId: string): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const batch = writeBatch(db)
    batch.update(doc(db, 'invitations', invitationId), {
      status: 'revoked',
    })
    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole: 'manager',
      action: 'invitation.revoked',
      entityType: 'store_invitation',
      entityId: invitationId,
      beforeState: null,
      afterState: { status: 'revoked' },
      createdAt: serverTimestamp(),
    })
    await batch.commit()
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function updateStoreMemberRole(
  storeId: string,
  targetUserId: string,
  newRole: Extract<StoreRole, 'admin' | 'employee'>,
): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const memberRef = doc(db, 'stores', storeId, 'members', targetUserId)
    const snap = await getDoc(memberRef)
    if (!snap.exists()) throw { code: 'CU_FORBIDDEN' }
    const prevRole = snap.data().role as StoreRole

    const batch = writeBatch(db)
    batch.update(memberRef, { role: newRole, updatedAt: serverTimestamp() })
    batch.set(
      doc(db, 'users', targetUserId, 'memberships', storeId),
      { storeId, role: newRole, status: 'active', updatedAt: serverTimestamp() },
      { merge: true },
    )
    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole: 'owner',
      action: 'member.role_changed',
      entityType: 'store_membership',
      entityId: targetUserId,
      beforeState: { role: prevRole },
      afterState: { role: newRole },
      createdAt: serverTimestamp(),
    })
    await batch.commit()
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function revokeStoreMember(storeId: string, targetUserId: string): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    const memberRef = doc(db, 'stores', storeId, 'members', targetUserId)
    const snap = await getDoc(memberRef)
    if (!snap.exists()) throw { code: 'CU_FORBIDDEN' }
    if (snap.data().role === 'owner') throw { code: 'CU_LAST_OWNER' }

    const batch = writeBatch(db)
    batch.update(memberRef, {
      status: 'revoked',
      revokedAt: serverTimestamp(),
      revokedBy: user.uid,
      updatedAt: serverTimestamp(),
    })
    batch.set(
      doc(db, 'users', targetUserId, 'memberships', storeId),
      { storeId, role: snap.data().role, status: 'revoked', updatedAt: serverTimestamp() },
      { merge: true },
    )
    batch.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
      storeId,
      actorUserId: user.uid,
      actorRole: 'manager',
      action: 'member.revoked',
      entityType: 'store_membership',
      entityId: targetUserId,
      beforeState: { status: 'active' },
      afterState: { status: 'revoked' },
      createdAt: serverTimestamp(),
    })
    await batch.commit()
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function transferStoreOwnership(storeId: string, newOwnerId: string): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user || newOwnerId === user.uid) throw normalizeError({ code: 'CU_FORBIDDEN' })

  try {
    const db = getFirebaseDb()
    await runTransaction(db, async (tx) => {
      const storeRef = doc(db, 'stores', storeId)
      const oldOwnerRef = doc(db, 'stores', storeId, 'members', user.uid)
      const newOwnerRef = doc(db, 'stores', storeId, 'members', newOwnerId)

      const [storeSnap, oldSnap, newSnap] = await Promise.all([
        tx.get(storeRef),
        tx.get(oldOwnerRef),
        tx.get(newOwnerRef),
      ])

      if (!storeSnap.exists() || storeSnap.data().ownerUserId !== user.uid) throw { code: 'CU_FORBIDDEN' }
      if (!oldSnap.exists() || oldSnap.data().role !== 'owner') throw { code: 'CU_FORBIDDEN' }
      if (!newSnap.exists() || newSnap.data().role !== 'admin' || newSnap.data().status !== 'active') {
        throw { code: 'CU_FORBIDDEN' }
      }

      tx.update(storeRef, { ownerUserId: newOwnerId, updatedAt: serverTimestamp() })
      tx.update(oldOwnerRef, { role: 'admin', updatedAt: serverTimestamp() })
      tx.update(newOwnerRef, { role: 'owner', updatedAt: serverTimestamp() })
      tx.set(
        doc(db, 'users', user.uid, 'memberships', storeId),
        { storeId, role: 'admin', status: 'active', updatedAt: serverTimestamp() },
        { merge: true },
      )
      tx.set(
        doc(db, 'users', newOwnerId, 'memberships', storeId),
        { storeId, role: 'owner', status: 'active', updatedAt: serverTimestamp() },
        { merge: true },
      )
      tx.set(doc(collection(db, 'stores', storeId, 'auditLogs')), {
        storeId,
        actorUserId: user.uid,
        actorRole: 'owner',
        action: 'store.ownership_transferred',
        entityType: 'store',
        entityId: storeId,
        beforeState: { ownerUserId: user.uid },
        afterState: { ownerUserId: newOwnerId },
        createdAt: serverTimestamp(),
      })
    })
  } catch (err) {
    throw normalizeError(err)
  }
}
