import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

let cachedApp: FirebaseApp | null = null
let cachedAuth: Auth | null = null
let cachedDb: Firestore | null = null
let emulatorsConnected = false

export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY
    && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    && import.meta.env.VITE_FIREBASE_PROJECT_ID
    && import.meta.env.VITE_FIREBASE_APP_ID,
  )
}

function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp

  if (!isFirebaseConfigured()) {
    throw new Error('Faltan variables VITE_FIREBASE_* en el archivo .env.')
  }

  const existing = getApps()[0]
  cachedApp = existing ?? initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  return cachedApp
}

function maybeConnectEmulators(auth: Auth, db: Firestore) {
  if (emulatorsConnected || import.meta.env.VITE_FIREBASE_USE_EMULATORS !== 'true') return
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  emulatorsConnected = true
}

/** Cliente singleton de Firebase Auth (solo debe importarse desde servicios). */
export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp())
    if (cachedDb) maybeConnectEmulators(cachedAuth, cachedDb)
  }
  return cachedAuth
}

/** Cliente singleton de Cloud Firestore (solo debe importarse desde servicios). */
export function getFirebaseDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(getFirebaseApp())
    if (cachedAuth) maybeConnectEmulators(cachedAuth, cachedDb)
  }
  return cachedDb
}
