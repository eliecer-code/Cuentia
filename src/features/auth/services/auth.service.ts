import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { ForgotPasswordInput, LoginInput, RegisterInput } from '@/features/auth/schemas/auth.schema'
import { normalizeError } from '@/shared/lib/errors'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/shared/lib/firebase'

export interface AuthUserProfile {
  id: string
  email: string
  fullName: string
}

export interface AuthSessionSnapshot {
  user: AuthUserProfile | null
}

function mapFirebaseUser(user: User | null): AuthUserProfile | null {
  if (!user) return null
  return {
    id: user.uid,
    email: user.email ?? '',
    fullName: user.displayName || user.email?.split('@')[0] || 'Usuario',
  }
}

export function isAuthBackendAvailable(): boolean {
  return isFirebaseConfigured()
}

export async function getCurrentSession(): Promise<AuthSessionSnapshot> {
  if (!isFirebaseConfigured()) {
    return { user: null }
  }
  const auth = getFirebaseAuth()
  await auth.authStateReady()
  return { user: mapFirebaseUser(auth.currentUser) }
}

export function subscribeAuthState(callback: (snapshot: AuthSessionSnapshot) => void): () => void {
  if (!isFirebaseConfigured()) return () => {}
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    callback({ user: mapFirebaseUser(user) })
  })
}

export async function signInWithPassword(input: LoginInput): Promise<AuthSessionSnapshot> {
  try {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), input.email, input.password)
    return { user: mapFirebaseUser(cred.user) }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function signUpWithEmail(input: RegisterInput): Promise<AuthSessionSnapshot> {
  try {
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password)
    await updateProfile(cred.user, { displayName: input.fullName })

    await setDoc(doc(db, 'users', cred.user.uid), {
      fullName: input.fullName,
      email: (cred.user.email ?? input.email).toLowerCase(),
      phoneE164: null,
      status: 'active',
      anonymizedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return {
      user: {
        id: cred.user.uid,
        email: cred.user.email ?? input.email,
        fullName: input.fullName,
      },
    }
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), input.email)
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function signOutSession(): Promise<void> {
  if (!isFirebaseConfigured()) return
  try {
    await signOut(getFirebaseAuth())
  } catch (err) {
    throw normalizeError(err)
  }
}
