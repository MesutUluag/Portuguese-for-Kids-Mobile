import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import { cancelSpeech } from '@/audio/speech';
import { ErrorBoundary } from '@/commons/ErrorBoundary';
import { reportCaughtError, scrubPii } from '@/observability/crashReporter';

jest.mock('@/audio/speech', () => ({
  cancelSpeech: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));

jest.mock('expo-updates', () => ({
  runtimeVersion: '1.0.0',
  updateId: 'upd-test-123',
}));

const mockedDigest = jest.mocked(Crypto.digestStringAsync);
const mockedCancelSpeech = jest.mocked(cancelSpeech);

function BrokenChild({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error(
      'Failed for parent@example.com with Bearer secret-token-123 and ?token=abc999',
    );
  }
  return <Text testID="healthy-child">All good</Text>;
}

describe('crashReporter & ErrorBoundary', () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedDigest.mockResolvedValue('deadbeef1234567890abcdef');
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('scrubs emails, bearer tokens, JWTs, and query secrets', () => {
    const sampleToken = ['eyJ' + 'testheader', 'eyJ' + 'testpayload', 'testsig0000'].join('.');
    const dirty = `User parent@example.com failed with Bearer abc.def and ${sampleToken} ?imagePrompt=secret`;
    const clean = scrubPii(dirty);
    expect(clean).not.toContain('parent@example.com');
    expect(clean).not.toContain('abc.def');
    expect(clean).not.toContain(sampleToken);
    expect(clean).not.toContain('=secret');
    expect(clean).toContain('[redacted-email]');
    expect(clean).toContain('Bearer [redacted]');
    expect(clean).toContain('[redacted-jwt]');
    expect(clean).toContain('?imagePrompt=[redacted]');
  });

  it('hashes uid instead of logging raw user identifiers', async () => {
    const payload = await reportCaughtError(new Error('Crash by user@domain.com'), {
      mode: 'story-0',
      uid: 'firebase-raw-uid-123',
    });

    expect(payload.uidHash).toBe('deadbeef12345678');
    expect(payload.message).toBe('Crash by [redacted-email]');
    expect(payload.appVersion).toBe('1.0.0');
    expect(payload.runtimeVersion).toBe('1.0.0');
    expect(payload.updateId).toBe('upd-test-123');
    expect(JSON.stringify(payload)).not.toContain('firebase-raw-uid-123');
  });

  it('renders bilingual fallback, stops speech, reports scrubbed error, and resets to flashcards', async () => {
    const onResetToCards = jest.fn();

    const { getByTestId, getByText, queryByTestId, rerender } = await render(
      <ErrorBoundary
        resetKey="story-0"
        language="en"
        uid="uid-xyz"
        onResetToCards={onResetToCards}
      >
        <BrokenChild shouldThrow />
      </ErrorBoundary>,
    );

    expect(getByTestId('error-boundary-fallback')).toBeTruthy();
    expect(getByText('Oops! Something went wrong.')).toBeTruthy();
    expect(mockedCancelSpeech).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockedDigest).toHaveBeenCalledWith('SHA-256', 'uid-xyz');
    });

    await fireEvent.press(getByTestId('error-boundary-reset-btn'));
    expect(onResetToCards).toHaveBeenCalledTimes(1);

    await rerender(
      <ErrorBoundary
        resetKey="cards-1"
        language="tr"
        uid="uid-xyz"
        onResetToCards={onResetToCards}
      >
        <BrokenChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(queryByTestId('error-boundary-fallback')).toBeNull();
    expect(getByTestId('healthy-child')).toBeTruthy();
  });

  it('renders Turkish localized copy when language is tr', async () => {
    const { getByText } = await render(
      <ErrorBoundary
        resetKey="game1-0"
        language="tr"
        onResetToCards={jest.fn()}
      >
        <BrokenChild shouldThrow />
      </ErrorBoundary>,
    );

    expect(getByText('Hay aksi! Bir sorun oluştu.')).toBeTruthy();
    expect(getByText('Kartlara Dön')).toBeTruthy();
  });
});
