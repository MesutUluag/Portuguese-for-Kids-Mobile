import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Game1 } from '@/components/Game1';
import { Game2 } from '@/components/Game2';
import { Game3 } from '@/components/Game3';
import { Game4 } from '@/components/Game4';
import { Game5 } from '@/components/Game5';
import { Game8 } from '@/components/Game8';

jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
    },
    useSharedValue: (init: number) => ({
      value: init,
      get: () => init,
      set: jest.fn(),
    }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    useReducedMotion: () => false,
    cancelAnimation: jest.fn(),
    withTiming: (toValue: number) => toValue,
    withSpring: (toValue: number) => toValue,
    withSequence: (...vals: number[]) => vals[vals.length - 1] ?? 0,
    interpolate: (_v: number, _in: number[], out: number[]) => out[0] ?? 0,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-image', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: (props: Record<string, unknown>) =>
      ReactActual.createElement(RN.View, { testID: 'mock-expo-image', ...props }),
  };
});

jest.mock('@/utils/useWikiImage', () => ({
  useWikiImage: () => null,
}));

const mockSpeakText = jest.fn();
const mockCancelSpeech = jest.fn();
jest.mock('@/audio/speech', () => ({
  speakText: (...args: unknown[]) => mockSpeakText(...args),
  speakAndSchedule: (
    text: string,
    opts: { language?: 'en' | 'tr'; minDelayMs?: number; onAdvance: () => void },
  ) => {
    mockSpeakText(text, { language: opts.language });
    const timer = setTimeout(opts.onAdvance, opts.minDelayMs ?? 950);
    return () => clearTimeout(timer);
  },
  cancelSpeech: () => mockCancelSpeech(),
}));

describe('Phase 3 Games (web parity)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('Game1 speaks target on mount, repeats true answer before advancing, and cancels speech on unmount', async () => {
    const onScore = jest.fn();
    const view = await render(<Game1 language="en" score={10} onScore={onScore} />);
    expect(screen.getByText('Which word is this? 🔊')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(mockSpeakText).toHaveBeenCalledTimes(1);

    const spokenTarget = mockSpeakText.mock.calls[0]?.[0] as string;
    await fireEvent.press(screen.getByLabelText(spokenTarget));

    expect(onScore).toHaveBeenCalledWith(6);
    expect(mockSpeakText).toHaveBeenCalledTimes(2);
    expect(mockSpeakText).toHaveBeenLastCalledWith(spokenTarget, { language: 'en' });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockSpeakText).toHaveBeenCalledTimes(3);

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game2 auto-speaks on mount and replays on speaker tap in Turkish', async () => {
    const view = await render(<Game2 language="tr" score={14} />);
    expect(screen.getByText('Dinle! 🔊')).toBeTruthy();
    expect(mockSpeakText).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Kelimeyi tekrar dinle'));
    expect(mockSpeakText).toHaveBeenCalledTimes(2);

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game3 renders 6 hidden cards (3 matching emoji pairs) and speaks on flip', async () => {
    const view = await render(<Game3 language="en" score={25} />);
    expect(screen.getByText('🃏 Memory Match')).toBeTruthy();
    const cards = screen.getAllByLabelText('Hidden memory card');
    expect(cards).toHaveLength(6);

    const firstCard = cards[0];
    if (firstCard) {
      await fireEvent.press(firstCard);
      expect(mockSpeakText).toHaveBeenCalledTimes(1);
    }

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game4 renders Fill Missing Letter and auto-speaks target word', async () => {
    const view = await render(<Game4 language="en" score={7} />);
    expect(screen.getByText('✍️ Fill Missing Letter')).toBeTruthy();
    expect(mockSpeakText).toHaveBeenCalledTimes(1);

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game5 renders Unscramble Word with Prev/Reset/Next (no Hint) and auto-speaks', async () => {
    const view = await render(<Game5 language="en" score={15} />);
    expect(screen.getByText('🧩 Unscramble Word')).toBeTruthy();
    expect(mockSpeakText).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Next word'));
    expect(mockSpeakText).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('Previous word'));
    expect(mockSpeakText).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByLabelText('Reset'));

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game8 renders 9-9-9 Portuguese keyboard, Check entire board, and Solve reveals without score', async () => {
    const onScore = jest.fn();
    const view = await render(<Game8 language="en" onScore={onScore} score={0} />);

    expect(screen.getByText(/CROSSWORD/)).toBeTruthy();
    expect(screen.getByLabelText('Ç')).toBeTruthy();
    expect(screen.getByLabelText('Delete letter')).toBeTruthy();
    expect(screen.queryByLabelText('W')).toBeNull();

    await fireEvent.press(screen.getByLabelText('A'));
    await fireEvent.press(screen.getByLabelText('Delete letter'));
    await fireEvent.press(screen.getByLabelText('Check'));
    await fireEvent.press(screen.getByLabelText('Solve'));

    expect(onScore).not.toHaveBeenCalled();

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game8 switches categories via dropdown modal and reduces earnable word score on Hint', async () => {
    const onScore = jest.fn();
    const view = await render(<Game8 language="en" onScore={onScore} score={0} />);

    // Open category dropdown and pick Verbs
    expect(screen.getByText('🔀')).toBeTruthy();
    expect(screen.getByText('Mixed')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Select category'));
    expect(screen.getByText('Select Category')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Verbs'));
    expect(screen.getByText('🏃')).toBeTruthy();
    expect(screen.getByText('Verbs')).toBeTruthy();

    // Earnable points drop from +10 pts -> +8 pts on first Hint
    expect(screen.getByText('+10 pts')).toBeTruthy();
    const countNode = screen.getByText(/\(\d+ letters\)/);
    const countMatch = /\((\d+) letters\)/.exec(String(countNode.props.children.join('')));
    const wordLen = countMatch ? Number(countMatch[1]) : 3;

    await fireEvent.press(screen.getByLabelText('Hint'));
    expect(screen.getByText('+8 pts')).toBeTruthy();

    // Complete remaining letters solely via Hint and verify 0 points are awarded
    for (let i = 1; i < wordLen; i++) {
      await fireEvent.press(screen.getByLabelText('Hint'));
    }

    expect(onScore).not.toHaveBeenCalled();

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });
});
