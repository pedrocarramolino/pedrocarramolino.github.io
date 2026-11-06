'use client';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  waitForPendingWrites,
  type Firestore,
} from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === '1';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function assertConfig() {
  if (!config.apiKey || !config.projectId || !config.authDomain) {
    throw new Error(
      'Faltan las variables NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN y NEXT_PUBLIC_FIREBASE_PROJECT_ID. Revisa .env.local o la configuración de Vercel.',
    );
  }
}

export function firebaseApp(): FirebaseApp {
  if (!app) {
    assertConfig();
    app = getApps().length ? getApp() : initializeApp(config);
  }
  return app;
}

export function firebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(firebaseApp());
    auth.languageCode = 'es';
    if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

/**
 * Firestore con caché local persistente (IndexedDB): la app abre al instante
 * y sigue mostrando datos con mala cobertura. La fuente de verdad es el servidor.
 */
/** Espera (con límite) a que el servidor reciba los cambios guardados en el dispositivo. */
export async function flushWrites(timeoutMs = 4000) {
  if (!db) return;
  await Promise.race([waitForPendingWrites(db), new Promise((r) => setTimeout(r, timeoutMs))]).catch(() => {});
}

export function firestore(): Firestore {
  if (!db) {
    db = initializeFirestore(firebaseApp(), {
      ignoreUndefinedProperties: true,
      localCache:
        typeof window !== 'undefined' ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) : memoryLocalCache(),
    });
    if (useEmulators) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      // solo en pruebas: permite esperar a que lo guardado llegue al servidor
      (window as unknown as { __auloraFlush?: () => Promise<void> }).__auloraFlush = () => flushWrites(10_000);
    }
  }
  return db;
}
