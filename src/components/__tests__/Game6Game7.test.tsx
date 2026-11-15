import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Game6 } from '@/components/Game6';
import { Game7 } from '@/components/Game7';
import { marketItems } from '@/data/marketItems.mobile';

const mockFromBytes = jest.fn(() => ({}));
const mockFromURI = jest.fn(async () => ({}));
const mockMakeImageFromEncoded = jest.fn<Record<string, unknown> | null, unknown[]>(() => null);
const mockMakeImageFromView = jest.fn<Promise<Record<string, unknown> | null>, unknown[]>(
  async () => null,
);

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = true;
    delete = jest.fn();
    constructor(_dir: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    static downloadFileAsync = jest.fn(async (_url: string, dest: { uri: string }) => dest);
  }
  return {
    File: MockFile,
    Paths: { cache: 'file:///cache' },
  };
});

jest.mock('@shopify/react-native-skia', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  const stubEl = (name: string) => {
    const Comp = ({ children, ...props }: Record<string, unknown>) =>
      ReactActual.createElement(RN.View, { testID: name, ...props }, children as React.ReactNode);
    Comp.displayName = name;
    return Comp;
  };
  return {
    Canvas: stubEl('SkiaCanvas'),
    Group: stubEl('SkiaGroup'),
    Path: stubEl('SkiaPath'),
    Rect: stubEl('SkiaRect'),
    RoundedRect: stubEl('SkiaRoundedRect'),
    Image: stubEl('SkiaImage'),
    makeImageFromView: (...args: unknown[]) => mockMakeImageFromView(...args),
    Skia: {
      Data: {
        fromBytes: (...args: unknown[]) => mockFromBytes(...(args as [])),
        fromURI: (...args: unknown[]) => mockFromURI(...(args as [])),
      },
      Image: {
        MakeImageFromEncoded: (...args: unknown[]) => mockMakeImageFromEncoded(...args),
      },
      Path: { MakeFromSVGString: jest.fn(() => ({})) },
    },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const createChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'minDistance',
      'onBegin',
      'onStart',
      'onUpdate',
      'onEnd',
      'onFinalize',
    ];
    for (const m of methods) {
      chain[m] = () => chain;
    }
    return chain;
  };
  return {
    Gesture: {
      Pan: () => createChain(),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
}));

jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
    },
    Easing: {
      cubic: (t: number) => t,
      ease: (t: number) => t,
      in: (fn: unknown) => fn,
      out: (fn: unknown) => fn,
      inOut: (fn: unknown) => fn,
    },
    useSharedValue: (init: unknown) => ({
      value: init,
      get: () => init,
      set: jest.fn(),
    }),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    useReducedMotion: () => true,
    cancelAnimation: jest.fn(),
    withDelay: (_ms: number, val: unknown) => val,
    withRepeat: (val: unknown) => val,
    withTiming: (toValue: unknown) => toValue,
    withSpring: (toValue: unknown) => toValue,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1] ?? 0,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const mockUseWikiImage = jest.fn<string | null, [string]>(() => null);
jest.mock('@/utils/useWikiImage', () => ({
  WIKI_USER_AGENT: 'PortugueseForKidsMobile/1.0',
  useWikiImage: (term: string) => mockUseWikiImage(term),
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

describe('Phase 4 Games (Game6 Jigsaw & Game7 Market)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWikiImage.mockReturnValue(null);
    mockMakeImageFromEncoded.mockReturnValue(null);
    mockMakeImageFromView.mockResolvedValue(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('Game6 speaks target word on mount, falls back after timeout when offline, awards 5 pts, and cancels speech', async () => {
    const onScore = jest.fn();
    const view = await render(<Game6 language="en" score={42} onScore={onScore} />);

    expect(screen.getByText('🧩 Puzzle')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(mockSpeakText).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(4100);
    });

    const gotItBtn = screen.getByLabelText('Got it, next word');
    await fireEvent.press(gotItBtn);

    expect(onScore).toHaveBeenCalledWith(5);
    expect(mockSpeakText).toHaveBeenCalledTimes(2);

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game6 does not immediately show fallback if an image fails before 4s', async () => {
    mockUseWikiImage.mockImplementation((term) => `https://upload.wikimedia.org/${encodeURIComponent(term)}.jpg`);
    mockMakeImageFromEncoded.mockReturnValue(null);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const view = await render(<Game6 language="en" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByLabelText('Got it, next word')).toBeNull();
    expect(screen.getByText('Look closely...')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByLabelText('Got it, next word')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(2200);
    });
    expect(screen.getByLabelText('Got it, next word')).toBeTruthy();

    warnSpy.mockRestore();
    await view.unmount();
  });

  it('Game6 loads Skia image and transitions from preview to playing pieces', async () => {
    mockUseWikiImage.mockReturnValue('https://upload.wikimedia.org/test-library.jpg');
    mockMakeImageFromEncoded.mockReturnValue({ width: () => 246, height: () => 246 });

    const view = await render(<Game6 language="en" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Look closely...')).toBeTruthy();
    expect(screen.getAllByTestId('SkiaImage')).toHaveLength(1);
    expect(screen.queryAllByTestId('SkiaGroup')).toHaveLength(0);
    expect(screen.queryByLabelText('Got it, next word')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('0 / 9')).toBeTruthy();
    expect(screen.getAllByTestId('SkiaGroup').length).toBeGreaterThan(1);

    await act(async () => {
      jest.advanceTimersByTime(3500);
    });
    expect(screen.queryByLabelText('Got it, next word')).toBeNull();

    await view.unmount();
  });

  it('Game6 captures local illustrated poster via makeImageFromView when offline and plays 3x3 puzzle', async () => {
    mockMakeImageFromView.mockResolvedValue({ width: () => 219, height: () => 219 });

    const view = await render(<Game6 language="en" />);

    await act(async () => {
      jest.advanceTimersByTime(4100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMakeImageFromView).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Got it, next word')).toBeNull();
    expect(screen.getByText('Look closely...')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    expect(screen.getByText('0 / 9')).toBeTruthy();
    expect(screen.getByLabelText(/^Speak /)).toBeTruthy();

    await view.unmount();
  });

  it('Game7 renders Bunny mascot, announces order, awards 7 pts on clean order completion, and excludes alcohol', async () => {
    const onScore = jest.fn();
    const view = await render(<Game7 language="en" score={15} onScore={onScore} />);

    expect(screen.getByText(/BANCADA DO MERCADO/)).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByLabelText('Tap bunny mascot to listen')).toBeTruthy();
    expect(screen.queryByLabelText('Vinho')).toBeNull();
    expect(screen.queryByLabelText('Cerveja')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(mockSpeakText).toHaveBeenCalledTimes(1);

    const spokenOrder = (mockSpeakText.mock.calls[0]?.[0] as string) ?? '';
    const matchingItem = marketItems.find(
      (item) =>
        spokenOrder.includes(item.ptName) ||
        spokenOrder.toLowerCase().includes(item.pluralName.toLowerCase()),
    );
    expect(matchingItem).toBeDefined();

    // Parse required count from progress badge "0 / N"
    const fractionNode = screen.getByText(/^0 \/ [1-3]$/);
    const neededCount = Number(fractionNode.props.children.join('').split('/')[1].trim());

    for (let i = 0; i < neededCount; i += 1) {
      await fireEvent.press(screen.getByLabelText(matchingItem!.ptName));
    }

    expect(onScore).toHaveBeenCalledWith(7);

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game7 gives wrong-item spoken feedback in Turkish and awards 5 pts after a mistake', async () => {
    const onScore = jest.fn();
    const view = await render(<Game7 language="tr" score={0} onScore={onScore} />);

    expect(screen.getByText(/PAZAR TEZGAHI/)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const spokenOrder = (mockSpeakText.mock.calls[0]?.[0] as string) ?? '';
    const matchingItem = marketItems.find(
      (item) =>
        spokenOrder.includes(item.ptName) ||
        spokenOrder.toLowerCase().includes(item.pluralName.toLowerCase()),
    );
    expect(matchingItem).toBeDefined();

    const wrongItem = marketItems.find(
      (item) => item.id !== matchingItem!.id && screen.queryByLabelText(item.ptName) !== null,
    );
    expect(wrongItem).toBeDefined();

    await fireEvent.press(screen.getByLabelText(wrongItem!.ptName));
    expect(mockSpeakText).toHaveBeenLastCalledWith(
      `Não! Isso é ${wrongItem!.ptName}.`,
      { language: 'tr' },
    );

    const fractionNode = screen.getByText(/^0 \/ [1-3]$/);
    const neededCount = Number(fractionNode.props.children.join('').split('/')[1].trim());

    for (let i = 0; i < neededCount; i += 1) {
      await fireEvent.press(screen.getByLabelText(matchingItem!.ptName));
    }

    expect(onScore).toHaveBeenCalledWith(5);

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('Game7 preserves count speech until onDone and celebrates with happy bunny at 15 cart items', async () => {
    const view = await render(<Game7 language="en" />);

    try {
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByTestId('market-bunny-mascot-image')).toBeTruthy();

      let totalAdded = 0;
      let guard = 0;
      while (totalAdded < 15 && guard < 20) {
        guard += 1;
        const callsBefore = mockSpeakText.mock.calls.length;
        const speechArgs = mockSpeakText.mock.calls[callsBefore - 1] as
          | [string, Record<string, unknown>?]
          | undefined;
        const lastPhrase = speechArgs?.[0] ?? '';
        const targetItem = marketItems.find(
          (item) =>
            (lastPhrase.includes(item.ptName) ||
              lastPhrase.toLowerCase().includes(item.pluralName.toLowerCase())) &&
            screen.queryByLabelText(item.ptName) !== null,
        );
        expect(targetItem).toBeDefined();

        const fractionNode = screen.getByText(/^0 \/ [1-3]$/);
        const neededCount = Number(fractionNode.props.children.join('').split('/')[1].trim());
        for (let i = 0; i < neededCount; i += 1) {
          await fireEvent.press(screen.getByLabelText(targetItem!.ptName));
        }
        totalAdded += neededCount;

        if (totalAdded < 15) {
          await act(async () => {
            jest.advanceTimersByTime(1200);
          });
          const lastCountOpts = mockSpeakText.mock.calls[
            mockSpeakText.mock.calls.length - 1
          ]?.[1] as { onDone?: () => void } | undefined;
          await act(async () => {
            lastCountOpts?.onDone?.();
          });
          expect(mockSpeakText.mock.calls.length).toBeGreaterThan(callsBefore + neededCount);
        } else {
          await act(async () => {
            jest.advanceTimersByTime(700);
          });
          expect(screen.getByTestId('market-bunny-happy-sparkles')).toBeTruthy();
          expect(screen.queryByText('💖 ✨ 💖')).toBeNull();
          expect(screen.getByTestId('market-cart-exit')).toBeTruthy();
          expect(screen.queryByTestId('market-cart-active')).toBeNull();
          await act(async () => {
            jest.advanceTimersByTime(3500);
          });
          expect(screen.queryByTestId('market-cart-exit')).toBeNull();
          expect(screen.getByTestId('market-cart-active')).toBeTruthy();
        }
      }

      expect(totalAdded).toBeGreaterThanOrEqual(15);
    } finally {
      await view.unmount();
    }
  });
});
