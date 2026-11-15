import React from 'react';
import { Linking, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AuthModal } from '@/auth/AuthModal';
import { PRIVACY_POLICY_URL } from '@/config';

const mockCloseAuthModal = jest.fn();
const mockSignInWithEmail = jest.fn().mockResolvedValue(undefined);
const mockSignUpWithEmail = jest.fn().mockResolvedValue(undefined);
const mockResetPassword = jest.fn().mockResolvedValue(undefined);

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthModalOpen: true,
    closeAuthModal: mockCloseAuthModal,
    isFirebaseConfigured: true,
    authReason: undefined,
    signInWithGoogle: jest.fn().mockResolvedValue(undefined),
    signInWithApple: jest.fn().mockResolvedValue(undefined),
    signInWithEmail: mockSignInWithEmail,
    signUpWithEmail: mockSignUpWithEmail,
    resetPassword: mockResetPassword,
  }),
}));

jest.mock('expo-apple-authentication', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  const { View: MockView } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppleAuthenticationButtonType: { SIGN_IN: 0 },
    AppleAuthenticationButtonStyle: { BLACK: 2 },
    AppleAuthenticationButton: (props: Record<string, unknown>) =>
      actualReact.createElement(MockView, {
        ...props,
        testID: 'apple-auth-button',
      }),
  };
});

describe('AuthModal', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOs;
    jest.clearAllMocks();
  });

  it('switches between signin, signup, and forgot password tabs', async () => {
    Platform.OS = 'android';
    await render(<AuthModal language="en" />);

    expect(screen.queryByTestId('apple-auth-button')).toBeNull();
    expect(screen.getByLabelText("Parent's email")).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Sign Up' }));
    expect(screen.getByText('Create Parent Account')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Forgot Password' }));
    expect(screen.getByText('Reset Password')).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('renders AppleAuthenticationButton on iOS only', async () => {
    Platform.OS = 'ios';
    await render(<AuthModal language="en" />);

    expect(screen.getByTestId('apple-auth-button')).toBeTruthy();
  });

  it('enforces an 8-character password on signup and exposes a Privacy Policy link', async () => {
    Platform.OS = 'android';
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined);

    await render(<AuthModal language="en" />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Sign Up' }));

    await fireEvent.changeText(screen.getByLabelText("Parent's email"), 'parent@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), '1234567');
    await fireEvent.press(screen.getByLabelText('Create Account'));

    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Privacy Policy'));
    expect(screen.getByText('Privacy Policy — Portuguese for Kids')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Open web version'));
    expect(openUrlSpy).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('Create Parent Account')).toBeTruthy();
    openUrlSpy.mockRestore();
  });
});
