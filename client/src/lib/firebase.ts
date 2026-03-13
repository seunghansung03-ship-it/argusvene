import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { isDevAuthBypassEnabled, type DevAuthUser } from "./dev-auth";

export type User = DevAuthUser;

const defaultFirebaseConfig = {
  apiKey: "AIzaSyDvLRDUmC4BAkfyTacmuMxkRzbqMfJHPkE",
  projectId: "argusvene",
  appId: "1:757572510741:web:a0098482cd6d9469e9da1c",
};

const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: `${firebaseProjectId}.firebaseapp.com`,
  projectId: firebaseProjectId,
  storageBucket: `${firebaseProjectId}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const googleProvider = auth ? new GoogleAuthProvider() : null;

function mapFirebaseUser(user: FirebaseUser): User {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

function requireAuth() {
  if (!auth || !googleProvider) {
    throw new Error("Firebase auth is not configured. Set VITE_FIREBASE_* or enable VITE_DEV_AUTH_BYPASS=true.");
  }

  return { auth, googleProvider };
}

export async function loginWithGoogle() {
  const { auth, googleProvider } = requireAuth();
  const result = await signInWithPopup(auth, googleProvider);
  return mapFirebaseUser(result.user);
}

export async function loginWithEmail(email: string, password: string) {
  const { auth } = requireAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return mapFirebaseUser(result.user);
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const { auth } = requireAuth();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName });
  }
  return mapFirebaseUser(result.user);
}

export async function logout() {
  if (isDevAuthBypassEnabled) return;
  if (!auth) return;
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  if (isDevAuthBypassEnabled || !auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => callback(user ? mapFirebaseUser(user) : null));
}

export async function getIdToken(): Promise<string | null> {
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export { auth };
