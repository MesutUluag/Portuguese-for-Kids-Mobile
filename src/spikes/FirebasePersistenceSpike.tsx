import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { colors, radii, spacing, touchTargets } from '@/theme/tokens';

function getFirebaseConfig() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId || projectId === 'your-project-id') {
    return null;
  }
  return { apiKey, authDomain, projectId, appId };
}

function getOrInitSpikeAuth(): {
  auth: Auth | null;
  status: string;
  error: string | null;
} {
  try {
    const cfg = getFirebaseConfig();
    if (!cfg) {
      return {
        auth: null,
        status:
          'Missing EXPO_PUBLIC_FIREBASE_* env vars. Add .env.local to test live Firebase persistence.',
        error: null,
      };
    }

    let app: FirebaseApp;
    const existing = getApps()[0];
    if (existing) {
      app = existing;
      return {
        auth: getAuth(app),
        status: 'Reused existing Firebase app.',
        error: null,
      };
    }

    app = initializeApp(cfg);
    const auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    return {
      auth,
      status: 'Initialized Firebase Auth with getReactNativePersistence(AsyncStorage).',
      error: null,
    };
  } catch (err) {
    return {
      auth: null,
      status: 'Firebase initialization failed.',
      error: err instanceof Error ? err.message : 'Firebase initialization error',
    };
  }
}

export function FirebasePersistenceSpike() {
  const [initResult] = useState(() => getOrInitSpikeAuth());
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(initResult.error);

  useEffect(() => {
    if (!initResult.auth) {
      return undefined;
    }
    return onAuthStateChanged(initResult.auth, (nextUser) => {
      setUser(nextUser);
    });
  }, [initResult.auth]);

  const handleEmailSignIn = async () => {
    if (!initResult.auth) return;
    if (!email.trim() || !password) {
      setActionError('Enter an email and password from your Firebase project.');
      return;
    }
    setActionError(null);
    try {
      await signInWithEmailAndPassword(initResult.auth, email.trim(), password);
      setPassword('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Email sign-in failed');
    }
  };

  const handleTestAnonSignIn = async () => {
    if (!initResult.auth) return;
    setActionError(null);
    try {
      await signInAnonymously(initResult.auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      if (msg.includes('auth/admin-restricted-operation')) {
        setActionError(
          'Anonymous sign-in is disabled in Firebase Console (normal for production). Use Email/Password above to test AsyncStorage persistence.',
        );
      } else {
        setActionError(msg);
      }
    }
  };

  const handleSignOut = async () => {
    if (!initResult.auth) return;
    setActionError(null);
    try {
      await signOut(initResult.auth);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Sign-out failed');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Spike A: Firebase Auth Persistence</Text>
      <Text style={styles.status}>{initResult.status}</Text>
      <Text style={styles.meta}>
        Persisted User:{' '}
        {user
          ? `Signed in (${user.email ?? `uid prefix: ${user.uid.slice(0, 6)}...`})`
          : 'None'}
      </Text>
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <View style={styles.inputs}>
        <TextInput
          accessibilityLabel="Test account email"
          autoCapitalize="none"
          autoCorrect={false}
          editable={Boolean(initResult.auth) && !user}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Firebase user email"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={email}
        />
        <TextInput
          accessibilityLabel="Test account password"
          editable={Boolean(initResult.auth) && !user}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in with email and password to test AsyncStorage persistence"
          disabled={!initResult.auth || Boolean(user)}
          onPress={handleEmailSignIn}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            (!initResult.auth || Boolean(user)) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.btnText}>Sign In with Email</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in anonymously to test AsyncStorage persistence"
          disabled={!initResult.auth || Boolean(user)}
          onPress={handleTestAnonSignIn}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            (!initResult.auth || Boolean(user)) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.btnSecondaryText}>Test Anonymous Sign-In</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out test user"
          disabled={!initResult.auth || !user}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            (!initResult.auth || !user) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.btnSecondaryText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Pass check: Sign in, fully kill the app, relaunch, and confirm &ldquo;Persisted User&rdquo;
        remains signed in without re-authenticating.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.amberLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
  },
  status: {
    fontSize: 14,
    color: colors.textDark,
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.skyDark,
  },
  error: {
    fontSize: 13,
    color: colors.red,
  },
  inputs: {
    gap: spacing.sm,
  },
  input: {
    minHeight: touchTargets.min,
    borderWidth: 2,
    borderColor: colors.blueLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.textDark,
    backgroundColor: colors.white,
    fontSize: 14,
  },
  actions: {
    gap: spacing.sm,
  },
  btn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: {
    backgroundColor: colors.purple,
  },
  btnSecondary: {
    backgroundColor: colors.amberPale,
    borderWidth: 2,
    borderColor: colors.amber,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  btnSecondaryText: {
    color: colors.textDark,
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
