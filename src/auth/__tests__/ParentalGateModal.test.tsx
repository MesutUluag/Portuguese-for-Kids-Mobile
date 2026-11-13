import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ParentalGateModal } from '@/auth/ParentalGateModal';

function readDisplayedChallenge() {
  const challengeNode = screen.getByText(/\d+\s*×\s*\d+\s*=\s*\?/);
  const challengeText = String(challengeNode.props.children.join(''));
  const match = challengeText.match(/(\d+)\s*×\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse challenge from: ${challengeText}`);
  }
  return {
    text: challengeText,
    left: Number(match[1]),
    right: Number(match[2]),
    answer: Number(match[1]) * Number(match[2]),
  };
}

describe('ParentalGateModal', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('regenerates the challenge on a wrong answer and unlocks on the new answer', async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();

    await render(
      <ParentalGateModal
        visible
        language="en"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );

    const first = readDisplayedChallenge();
    expect(first.left).toBeGreaterThanOrEqual(11);
    expect(first.left).toBeLessThanOrEqual(16);
    expect(first.right).toBeGreaterThanOrEqual(3);
    expect(first.right).toBeLessThanOrEqual(5);

    const input = screen.getByLabelText('Parental gate answer');
    const verifyBtn = screen.getByLabelText('Verify and continue');

    // Wrong answer regenerates challenge and clears input
    await fireEvent.changeText(input, String(first.answer + 1));
    await fireEvent.press(verifyBtn);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();

    const regenerated = readDisplayedChallenge();
    expect(input.props.value).toBe('');

    // Solve the newly displayed challenge
    await fireEvent.changeText(input, String(regenerated.answer));
    await fireEvent.press(verifyBtn);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('locks out for 30 seconds after 3 wrong answers and recovers once the timer finishes', async () => {
    jest.useFakeTimers();
    const onSuccess = jest.fn();

    await render(
      <ParentalGateModal
        visible
        language="en"
        onSuccess={onSuccess}
        onCancel={jest.fn()}
      />,
    );

    const input = screen.getByLabelText('Parental gate answer');
    const verifyBtn = screen.getByLabelText('Verify and continue');

    for (let attempt = 0; attempt < 3; attempt++) {
      const current = readDisplayedChallenge();
      await fireEvent.changeText(input, String(current.answer + 1));
      await fireEvent.press(verifyBtn);
    }

    expect(screen.getByText(/Please wait 30s/)).toBeTruthy();
    expect(input.props.editable).toBe(false);
    expect(verifyBtn.props.accessibilityState?.disabled).toBe(true);

    // Advance all 30 seconds
    for (let sec = 0; sec < 30; sec++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    expect(screen.queryByText(/Please wait/)).toBeNull();
    expect(screen.getByLabelText('Parental gate answer').props.editable).toBe(true);

    const fresh = readDisplayedChallenge();
    await fireEvent.changeText(screen.getByLabelText('Parental gate answer'), String(fresh.answer));
    await fireEvent.press(screen.getByLabelText('Verify and continue'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
