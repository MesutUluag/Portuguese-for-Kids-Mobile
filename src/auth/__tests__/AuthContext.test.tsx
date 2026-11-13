import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import {
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  type User,
} from 'firebase/auth';
import { fetchWithAuth } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { auth } from '@/auth/firebase';
import { createDefaultProfile } from '@/auth/telemetryHelpers';
import { clearAppStorage } from '@/utils/storage';

const mockDeleteDir = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  Directory: jest.fn(() => ({
    exists: true,
    delete: mockDeleteDir,
  })),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  isSuccessResponse: jest.fn(() => false),
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

jest.mock('@/auth/firebase', () => ({
  auth: { currentUser: null },
  configureGoogleSignIn: jest.fn(() => false),
  isFirebaseConfigured: true,
}));

jest.mock('@/api/client', () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock('@/utils/storage', () => ({
  STORAGE_KEYS: { OUTBOX: 'pk_outbox' },
  clearAppStorage: jest.fn().mockResolvedValue(undefined),
  nicknameConfirmedKey: (uid: string) => `pk_nick_${uid}`,
  setJSON: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn(),
  EmailAuthProvider: {
    credential: jest.fn((email: string, pass: string) => ({
      providerId: 'password',
      email,
      pass,
    })),
  },
  GoogleAuthProvider: { credential: jest.fn() },
  OAuthProvider: jest.fn(),
  onAuthStateChanged: jest.fn(),
  reauthenticateWithCredential: jest.fn().mockResolvedValue(undefined),
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn().mockResolvedValue(undefined),
  updateProfile: jest.fn(),
}));

const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>;
const mockDeleteUser = deleteUser as jest.MockedFunction<typeof deleteUser>;
const mockOnAuthStateChanged = onAuthStateChanged as jest.MockedFunction<
  typeof onAuthStateChanged
>;
const mockReauth = reauthenticateWithCredential as jest.MockedFunction<
  typeof reauthenticateWithCredential
>;
const mockClearAppStorage = clearAppStorage as jest.MockedFunction<
  typeof clearAppStorage
>;

describe('AuthContext', () => {
  let latestCtx: ReturnType<typeof useAuth> | null = null;
  let authCallback: ((u: User | null) => void) | null = null;
  const mockDiscardOutbox = jest.fn();

  function Harness() {
    latestCtx = useAuth();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    latestCtx = null;
    authCallback = null;
    (auth as unknown as { currentUser: User | null }).currentUser = null;
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      authCallback = cb as (u: User | null) => void;
      return jest.fn();
    });
  });

  it('calls DELETE /user/me before deleteUser(), clears storage and image cache, and discards outbox', async () => {
    const firebaseUser = {
      uid: 'u1',
      email: 'parent@example.com',
      displayName: 'BraveOwl',
      providerData: [{ providerId: 'password' }],
    } as unknown as User;
    (auth as unknown as { currentUser: User | null }).currentUser = firebaseUser;

    const callOrder: string[] = [];
    mockFetchWithAuth
      .mockResolvedValueOnce(createDefaultProfile('u1', 'parent@example.com', 'BraveOwl'))
      .mockImplementationOnce(async (path, opts) => {
        callOrder.push(`api:${opts?.method}:${path}`);
        return undefined;
      });
    mockDeleteUser.mockImplementationOnce(async () => {
      callOrder.push('firebase:deleteUser');
    });

    await render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await act(async () => {
      authCallback?.(firebaseUser);
    });
    await waitFor(() => expect(latestCtx?.profile?.uid).toBe('u1'));

    latestCtx!.registerDiscardOutboxHandler(mockDiscardOutbox);

    await act(async () => {
      await latestCtx!.deleteAccount();
    });

    expect(callOrder).toEqual(['api:DELETE:/user/me', 'firebase:deleteUser']);
    expect(mockDiscardOutbox).toHaveBeenCalledTimes(1);
    expect(mockClearAppStorage).toHaveBeenCalledTimes(1);
    expect(mockDeleteDir).toHaveBeenCalledTimes(1);
    expect(latestCtx?.user).toBeNull();
  });

  it('prompts for password reauth on auth/requires-recent-login and reauthenticates when provided', async () => {
    const firebaseUser = {
      uid: 'u1',
      email: 'parent@example.com',
      displayName: 'BraveOwl',
      providerData: [{ providerId: 'password' }],
    } as unknown as User;
    (auth as unknown as { currentUser: User | null }).currentUser = firebaseUser;

    mockFetchWithAuth.mockResolvedValue(
      createDefaultProfile('u1', 'parent@example.com', 'BraveOwl'),
    );

    await render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await act(async () => {
      authCallback?.(firebaseUser);
    });
    await waitFor(() => expect(latestCtx?.profile?.uid).toBe('u1'));

    const recentErr = Object.assign(new Error('Recent login required'), {
      code: 'auth/requires-recent-login',
    });
    mockDeleteUser.mockRejectedValueOnce(recentErr);

    await expect(latestCtx!.deleteAccount()).rejects.toThrow(
      'requires-password-reauth',
    );

    mockDeleteUser.mockResolvedValueOnce(undefined);
    await act(async () => {
      await latestCtx!.deleteAccount('secret123');
    });

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
      'parent@example.com',
      'secret123',
    );
    expect(mockReauth).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('ignores stale /user/me responses if auth.currentUser switched mid-flight', async () => {
    const userA = {
      uid: 'user-a',
      displayName: 'BraveOwl',
      providerData: [],
    } as unknown as User;
    const userB = {
      uid: 'user-b',
      displayName: 'SwiftFox',
      providerData: [],
    } as unknown as User;

    let resolveProfileA!: (p: ReturnType<typeof createDefaultProfile>) => void;
    mockFetchWithAuth.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfileA = resolve;
        }),
    );

    await render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    (auth as unknown as { currentUser: User | null }).currentUser = userA;
    await act(async () => {
      authCallback?.(userA);
    });

    // Switch currentUser to userB before userA profile finishes resolving
    (auth as unknown as { currentUser: User | null }).currentUser = userB;
    await act(async () => {
      resolveProfileA(createDefaultProfile('user-a', 'a@example.com', 'BraveOwl'));
    });

    expect(latestCtx?.profile).toBeNull();
  });
});
