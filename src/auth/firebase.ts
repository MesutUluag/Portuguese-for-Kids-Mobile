import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.projectId !== 'your-project-id',
);

export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
export const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let googleConfigured = false;

export function configureGoogleSignIn(): boolean {
  if (!googleWebClientId && !googleIosClientId) {
    return false;
  }
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    });
    googleConfigured = true;
  }
  return true;
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function initFirebase(): { app: FirebaseApp | null; auth: Auth | null } {
  if (!isFirebaseConfigured) {
    return { app: null, auth: null };
  }

  try {
    const existingApp = getApps()[0];
    if (existingApp) {
      appInstance = existingApp;
      authInstance = getAuth(existingApp);
      return { app: appInstance, auth: authInstance };
    }

    appInstance = initializeApp(firebaseConfig);
    authInstance = initializeAuth(appInstance, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    return { app: appInstance, auth: authInstance };
  } catch (err) {
    console.warn('[auth] Firebase initialization failed:', err);
    return { app: null, auth: null };
  }
}

const initialized = initFirebase();
export const app = initialized.app;
export const auth = initialized.auth;

/**
 * Returns the current user's Firebase ID token, or null if signed out / unconfigured.
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (!auth?.currentUser) {
    return null;
  }
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}
