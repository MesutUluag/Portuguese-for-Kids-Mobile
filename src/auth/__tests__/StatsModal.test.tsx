import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StatsModal } from '@/auth/StatsModal';
import { PRIVACY_POLICY_URL } from '@/config';

const mockDeleteAccount = jest.fn().mockResolvedValue(undefined);
const mockSignOutUser = jest.fn().mockResolvedValue(undefined);
const mockRequestParentApproval = jest.fn((action: () => void) => action());

jest.mock('@/auth/AuthContext', () => {
  const { createDefaultProfile } = jest.requireActual<
    typeof import('@/auth/telemetryHelpers')
  >('@/auth/telemetryHelpers');
  const baseProfile = createDefaultProfile('u1', 'parent@example.com', 'BraveOwl');
  return {
    useAuth: () => ({
      profile: {
        ...baseProfile,
        stats: {
          ...baseProfile.stats,
          totalScore: 42,
          currentStreakDays: 3,
          longestStreakDays: 5,
        },
      },
      isStatsModalOpen: true,
      closeStatsModal: jest.fn(),
      signOutUser: mockSignOutUser,
      deleteAccount: mockDeleteAccount,
      openNicknamePicker: jest.fn(),
      requestParentApproval: mockRequestParentApproval,
    }),
  };
});

describe('StatsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers parent approval, confirmation dialog, and deleteAccount', async () => {
    await render(<StatsModal language="en" />);

    expect(screen.getByText('BraveOwl')).toBeTruthy();
    expect(screen.getByText('42 pts')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Delete Account'));
    expect(mockRequestParentApproval).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Permanently Delete Account')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Confirm Delete'));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });

  it('prompts inline password re-authentication when deleteAccount requires password reauth and gates Privacy Policy', async () => {
    mockDeleteAccount
      .mockRejectedValueOnce(new Error('requires-password-reauth'))
      .mockResolvedValueOnce(undefined);
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined);

    await render(<StatsModal language="en" />);

    await fireEvent.press(screen.getByLabelText('Delete Account'));
    await fireEvent.press(screen.getByLabelText('Confirm Delete'));

    await waitFor(() => {
      expect(screen.getByLabelText('Account password for confirmation')).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByLabelText('Account password for confirmation'),
      'secret1234',
    );
    await fireEvent.press(screen.getByLabelText('Confirm Delete'));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenNthCalledWith(2, 'secret1234');
    });

    await fireEvent.press(screen.getByLabelText('Privacy Policy'));
    expect(screen.getByText('Privacy Policy — Portuguese for Kids')).toBeTruthy();
    expect(openUrlSpy).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Open web version'));
    expect(mockRequestParentApproval).toHaveBeenCalled();
    expect(openUrlSpy).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    openUrlSpy.mockRestore();
  });
});
