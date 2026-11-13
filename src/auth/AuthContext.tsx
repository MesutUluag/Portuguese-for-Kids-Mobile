import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { Directory, Paths } from 'expo-file-system';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { fetchWithAuth } from '@/api/client';
import {
  auth,
  configureGoogleSignIn,
  isFirebaseConfigured,
} from '@/auth/firebase';
import { shouldPromptNickname } from '@/auth/nicknameGenerator';
import { isUserProfile, type UserProfile } from '@/auth/types';
import { PASSWORD_RESET_CONTINUE_URL } from '@/config';
import {
  clearAppStorage,
  nicknameConfirmedKey,
  setJSON,
} from '@/utils/storage';

interface ParentalGateRequest {
  reason?: string;
  onSuccess: () => void;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  isFirebaseConfigured: boolean;
  isAuthModalOpen: boolean;
  authReason?: string;
  isStatsModalOpen: boolean;
  isLeaderboardModalOpen: boolean;
  isNicknamePickerOpen: boolean;
  needsNickname: boolean;
  parentalGateRequest: ParentalGateRequest | null;
  requestParentApproval: (action: () => void, reason?: string) => void;
  closeParentalGate: () => void;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  openStatsModal: () => void;
  closeStatsModal: () => void;
  openLeaderboardModal: () => void;
  closeLeaderboardModal: () => void;
  openNicknamePicker: () => void;
  closeNicknamePicker: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmNickname: (nickname: string) => Promise<void>;
  deleteAccount: (passwordForReauth?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  registerBeforeSignOut: (callback: () => Promise<void>) => void;
  registerFlushHandler: (callback: () => Promise<void>) => void;
  registerDiscardOutboxHandler: (callback: () => void) => void;
}

export type AuthStateContextType = Pick<
  AuthContextType,
  | 'user'
  | 'profile'
  | 'authReady'
  | 'isFirebaseConfigured'
  | 'setProfile'
  | 'refreshProfile'
  | 'registerBeforeSignOut'
  | 'registerFlushHandler'
  | 'registerDiscardOutboxHandler'
>;

export type AuthUiContextType = Omit<AuthContextType, keyof AuthStateContextType>;

const AuthStateContext = createContext<AuthStateContextType | null>(null);
const AuthUiContext = createContext<AuthUiContextType | null>(null);

async function buildAppleCredential() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign-In did not return an identity token.');
  }
  const provider = new OAuthProvider('apple.com');
  return provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });
}

async function clearCachedStoryImages(): Promise<void> {
  try {
    const storyCacheDir = new Directory(Paths.cache, 'story-images');
    if (storyCacheDir.exists) {
      storyCacheDir.delete();
    }
  } catch (err) {
    console.warn('[auth] Failed to clear cached story images:', err);
  }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [isNicknamePickerOpen, setIsNicknamePickerOpen] = useState(false);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [parentalGateRequest, setParentalGateRequest] =
    useState<ParentalGateRequest | null>(null);

  const beforeSignOutRef = useRef<(() => Promise<void>) | null>(null);
  const flushHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const discardOutboxHandlerRef = useRef<(() => void) | null>(null);

  const evaluateNicknameNeed = useCallback(
    async (firebaseUser: User, loadedProfile: UserProfile | null) => {
      const effectiveName = loadedProfile?.displayName ?? firebaseUser.displayName;
      const needed = shouldPromptNickname(effectiveName);
      setNeedsNickname(needed);
      if (needed) {
        setIsNicknamePickerOpen(true);
      }
    },
    [],
  );

  const fetchProfile = useCallback(
    async (targetUser?: User | null): Promise<UserProfile | null> => {
      const activeUser = targetUser ?? auth?.currentUser ?? null;
      if (!activeUser) {
        setProfile(null);
        return null;
      }
      const requestedUid = activeUser.uid;
      try {
        const data = await fetchWithAuth<UserProfile>('/user/me', {
          requireAuth: true,
          validate: isUserProfile,
        });
        if (auth?.currentUser && auth.currentUser.uid !== requestedUid) {
          return null;
        }
        setProfile(data);
        await evaluateNicknameNeed(activeUser, data);
        return data;
      } catch (err) {
        console.warn('[auth] Failed to fetch user profile:', err);
        if (auth?.currentUser && auth.currentUser.uid !== requestedUid) {
          return null;
        }
        await evaluateNicknameNeed(activeUser, null);
        return null;
      }
    },
    [evaluateNicknameNeed],
  );

  useEffect(() => {
    configureGoogleSignIn();
    if (!auth || !isFirebaseConfigured) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        void fetchProfile(firebaseUser);
      } else {
        setProfile(null);
        setNeedsNickname(false);
        setIsNicknamePickerOpen(false);
      }
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const requestParentApproval = useCallback(
    (action: () => void, reason?: string) => {
      setParentalGateRequest({
        reason,
        onSuccess: () => {
          setParentalGateRequest(null);
          action();
        },
      });
    },
    [],
  );

  const closeParentalGate = useCallback(() => {
    setParentalGateRequest(null);
  }, []);

  const openAuthModal = useCallback(
    (reason?: string) => {
      requestParentApproval(() => {
        setAuthReason(reason);
        setIsAuthModalOpen(true);
      }, reason);
    },
    [requestParentApproval],
  );

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthReason(undefined);
  }, []);

  const openStatsModal = useCallback(() => {
    setIsStatsModalOpen(true);
    void (async () => {
      if (flushHandlerRef.current) {
        await flushHandlerRef.current();
      }
      await fetchProfile();
    })();
  }, [fetchProfile]);

  const closeStatsModal = useCallback(() => {
    setIsStatsModalOpen(false);
  }, []);

  const openLeaderboardModal = useCallback(() => {
    setIsLeaderboardModalOpen(true);
    void (async () => {
      if (flushHandlerRef.current) {
        await flushHandlerRef.current();
      }
      await fetchProfile();
    })();
  }, [fetchProfile]);

  const closeLeaderboardModal = useCallback(() => {
    setIsLeaderboardModalOpen(false);
  }, []);

  const openNicknamePicker = useCallback(() => {
    requestParentApproval(() => {
      setIsNicknamePickerOpen(true);
    });
  }, [requestParentApproval]);

  const closeNicknamePicker = useCallback(() => {
    setIsNicknamePickerOpen(false);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      throw new Error('Firebase Auth is not configured.');
    }
    if (!configureGoogleSignIn()) {
      throw new Error(
        'Google OAuth client ID is not configured. Check .env.local.',
      );
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return;
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In did not return an ID token.');
    }
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    closeAuthModal();
  }, [closeAuthModal]);

  const signInWithApple = useCallback(async () => {
    if (!auth) {
      throw new Error('Firebase Auth is not configured.');
    }
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is available on iOS devices only.');
    }
    try {
      const credential = await buildAppleCredential();
      await signInWithCredential(auth, credential);
      closeAuthModal();
    } catch (err) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      throw err;
    }
  }, [closeAuthModal]);

  const signInWithEmail = useCallback(
    async (email: string, pass: string) => {
      if (!auth) {
        throw new Error('Firebase Auth is not configured.');
      }
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      closeAuthModal();
    },
    [closeAuthModal],
  );

  const signUpWithEmail = useCallback(
    async (email: string, pass: string) => {
      if (!auth) {
        throw new Error('Firebase Auth is not configured.');
      }
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      void sendEmailVerification(cred.user).catch(() => {});
      closeAuthModal();
      setNeedsNickname(true);
      setIsNicknamePickerOpen(true);
    },
    [closeAuthModal],
  );

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not configured.');
    }
    await sendPasswordResetEmail(auth, email.trim(), {
      url: PASSWORD_RESET_CONTINUE_URL,
    });
  }, []);

  const confirmNickname = useCallback(
    async (nickname: string) => {
      if (!auth?.currentUser) return;
      await updateProfile(auth.currentUser, { displayName: nickname });
      await auth.currentUser.getIdToken(true);
      await setJSON(nicknameConfirmedKey(auth.currentUser.uid), true);
      setNeedsNickname(false);
      setIsNicknamePickerOpen(false);
      await fetchProfile(auth.currentUser);
    },
    [fetchProfile],
  );

  const signOutUser = useCallback(async () => {
    if (beforeSignOutRef.current) {
      try {
        await beforeSignOutRef.current();
      } catch (err) {
        console.warn('[auth] beforeSignOut flush failed:', err);
      }
    }
    try {
      if (configureGoogleSignIn()) {
        await GoogleSignin.signOut();
      }
    } catch {
      // Ignore if Google wasn't signed in
    }
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
    setNeedsNickname(false);
    setIsNicknamePickerOpen(false);
    setIsStatsModalOpen(false);
    setIsLeaderboardModalOpen(false);
  }, []);

  const deleteAccount = useCallback(async (passwordForReauth?: string) => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;

    if (passwordForReauth && currentUser.email) {
      await reauthenticateWithCredential(
        currentUser,
        EmailAuthProvider.credential(currentUser.email, passwordForReauth),
      );
    }

    // Delete server-side Firestore profile & evict leaderboard cache while ID token is still valid.
    await fetchWithAuth<void>('/user/me', {
      method: 'DELETE',
      requireAuth: true,
    });

    const tryProviderReauthAndDelete = async () => {
      const providerIds = currentUser.providerData.map((p) => p.providerId);
      if (providerIds.includes('google.com') && configureGoogleSignIn()) {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = await GoogleSignin.signIn();
        if (!isSuccessResponse(res) || !res.data.idToken) {
          throw new Error('reauth-cancelled');
        }
        await reauthenticateWithCredential(
          currentUser,
          GoogleAuthProvider.credential(res.data.idToken),
        );
        await deleteUser(currentUser);
        return;
      }
      if (providerIds.includes('apple.com') && Platform.OS === 'ios') {
        const appleCred = await buildAppleCredential();
        await reauthenticateWithCredential(currentUser, appleCred);
        await deleteUser(currentUser);
        return;
      }
      if (providerIds.includes('password') && !passwordForReauth) {
        throw new Error('requires-password-reauth');
      }
      throw new Error('requires-recent-login');
    };

    try {
      await deleteUser(currentUser);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code: unknown }).code
          : null;
      if (code === 'auth/requires-recent-login') {
        await tryProviderReauthAndDelete();
      } else {
        throw err;
      }
    }

    discardOutboxHandlerRef.current?.();
    await clearAppStorage();
    await clearCachedStoryImages();
    try {
      if (configureGoogleSignIn()) {
        await GoogleSignin.signOut();
      }
    } catch {
      // ignore
    }

    setUser(null);
    setProfile(null);
    setNeedsNickname(false);
    setIsNicknamePickerOpen(false);
    setIsStatsModalOpen(false);
    setIsLeaderboardModalOpen(false);
  }, []);

  const registerBeforeSignOut = useCallback((callback: () => Promise<void>) => {
    beforeSignOutRef.current = callback;
  }, []);

  const registerFlushHandler = useCallback((callback: () => Promise<void>) => {
    flushHandlerRef.current = callback;
  }, []);

  const registerDiscardOutboxHandler = useCallback((callback: () => void) => {
    discardOutboxHandlerRef.current = callback;
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const stateValue = useMemo<AuthStateContextType>(
    () => ({
      user,
      profile,
      authReady,
      isFirebaseConfigured,
      setProfile,
      refreshProfile,
      registerBeforeSignOut,
      registerFlushHandler,
      registerDiscardOutboxHandler,
    }),
    [
      authReady,
      profile,
      refreshProfile,
      registerBeforeSignOut,
      registerDiscardOutboxHandler,
      registerFlushHandler,
      user,
    ],
  );

  const uiValue = useMemo<AuthUiContextType>(
    () => ({
      isAuthModalOpen,
      authReason,
      isStatsModalOpen,
      isLeaderboardModalOpen,
      isNicknamePickerOpen,
      needsNickname,
      parentalGateRequest,
      requestParentApproval,
      closeParentalGate,
      openAuthModal,
      closeAuthModal,
      openStatsModal,
      closeStatsModal,
      openLeaderboardModal,
      closeLeaderboardModal,
      openNicknamePicker,
      closeNicknamePicker,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      confirmNickname,
      deleteAccount,
      signOutUser,
    }),
    [
      authReason,
      closeAuthModal,
      closeLeaderboardModal,
      closeNicknamePicker,
      closeParentalGate,
      closeStatsModal,
      confirmNickname,
      deleteAccount,
      isAuthModalOpen,
      isLeaderboardModalOpen,
      isNicknamePickerOpen,
      isStatsModalOpen,
      needsNickname,
      openAuthModal,
      openLeaderboardModal,
      openNicknamePicker,
      openStatsModal,
      parentalGateRequest,
      requestParentApproval,
      resetPassword,
      signInWithApple,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      signUpWithEmail,
    ],
  );

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthUiContext.Provider value={uiValue}>{children}</AuthUiContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuthState(): AuthStateContextType {
  const ctx = useContext(AuthStateContext);
  if (!ctx) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return ctx;
}

export function useAuthUi(): AuthUiContextType {
  const ctx = useContext(AuthUiContext);
  if (!ctx) {
    throw new Error('useAuthUi must be used within an AuthProvider');
  }
  return ctx;
}

export function useAuth(): AuthContextType {
  const state = useAuthState();
  const ui = useAuthUi();
  return useMemo(() => ({ ...state, ...ui }), [state, ui]);
}
