import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  clearStoredHistory,
  getNewStoryPage,
  loadStoredHistory,
  saveStoredHistory,
} from '@/api/story';
import { cancelSpeech, speakText } from '@/audio/speech';
import { StoryMode } from '@/story/StoryMode';
import { translateToTurkish } from '@/utils/translate';

jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      Image: RN.Image,
      createAnimatedComponent: (Comp: React.ComponentType<unknown>) => Comp,
    },
    useSharedValue: (init: number) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    useReducedMotion: () => true,
    withSpring: (v: number) => v,
    withTiming: (v: number) => v,
  };
});

jest.mock('expo-image', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: (props: Record<string, unknown>) => ReactActual.createElement(RN.View, props),
  };
});

jest.mock('@/audio/speech', () => ({
  speakText: jest.fn(),
  cancelSpeech: jest.fn(),
}));

jest.mock('@/utils/useWikiImage', () => ({
  useWikiImage: () => null,
}));

jest.mock('@/api/image', () => ({
  buildStoryImagePrompt: jest.fn((page: { en: string }, ctx: string) => `${ctx}:${page.en}`),
  fetchAndCacheStoryImage: jest.fn().mockRejectedValue(new Error('offline')),
  pruneStoryImageCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/api/story', () => ({
  loadStoredHistory: jest.fn().mockResolvedValue([]),
  saveStoredHistory: jest.fn().mockResolvedValue(undefined),
  clearStoredHistory: jest.fn().mockResolvedValue(undefined),
  getNewStoryPage: jest.fn(),
}));

jest.mock('@/utils/translate', () => ({
  translateToTurkish: jest.fn().mockResolvedValue('Günaydın öğretmenim!'),
}));

const mockedGetNewStoryPage = jest.mocked(getNewStoryPage);
const mockedLoadStoredHistory = jest.mocked(loadStoredHistory);
const mockedSaveStoredHistory = jest.mocked(saveStoredHistory);
const mockedClearStoredHistory = jest.mocked(clearStoredHistory);
const mockedSpeakText = jest.mocked(speakText);
const mockedCancelSpeech = jest.mocked(cancelSpeech);
const mockedTranslateToTurkish = jest.mocked(translateToTurkish);

const SCHOOL_PAGE_1 = {
  pt: 'Bom dia, professora!',
  en: 'Good morning, teacher!',
  mainEmoji: '👩‍🏫',
  bgLeft: '🏫',
  bgRight: '☀️',
};

const SCHOOL_PAGE_2 = {
  pt: 'Vamos abrir o caderno.',
  en: 'Let us open the notebook.',
  mainEmoji: '📓',
  bgLeft: '✏️',
  bgRight: '🎒',
};

const CAFE_PAGE_1 = {
  pt: 'Quero um bolo de arroz.',
  en: 'I want a rice cake.',
  mainEmoji: '🧁',
  bgLeft: '☕',
  bgRight: '🥐',
};

describe('StoryMode component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadStoredHistory.mockResolvedValue([]);
    mockedGetNewStoryPage.mockResolvedValue({
      page: SCHOOL_PAGE_1,
      source: 'template',
    });
  });

  it('loads and displays an initial story page and triggers speech buttons', async () => {
    const onStoryPracticed = jest.fn();
    const onSpeechListen = jest.fn();

    const { getByTestId, findByText } = await render(
      <StoryMode
        language="en"
        onStoryPracticed={onStoryPracticed}
        onSpeechListen={onSpeechListen}
      />,
    );

    expect(await findByText('Bom dia, professora!')).toBeTruthy();
    expect(getByTestId('story-translation-text').props.children).toBe('Good morning, teacher!');
    expect(getByTestId('story-page-indicator').props.children).toBe('Página 1');

    await fireEvent.press(getByTestId('story-listen-btn'));
    expect(onSpeechListen).toHaveBeenCalledTimes(1);
    expect(mockedSpeakText).toHaveBeenCalledWith('Bom dia, professora!', { language: 'en' });

    await fireEvent.press(getByTestId('story-listen-slow-btn'));
    expect(onSpeechListen).toHaveBeenCalledTimes(2);
    expect(mockedSpeakText).toHaveBeenCalledWith('Bom dia, professora!', {
      rate: 0.3,
      language: 'en',
    });

    await waitFor(() => {
      expect(mockedSaveStoredHistory).toHaveBeenCalled();
    });
    expect(onStoryPracticed).toHaveBeenCalledWith('school', 'Bom dia, professora!');
  });

  it('navigates Próxima and Anterior cleanly', async () => {
    mockedGetNewStoryPage
      .mockResolvedValueOnce({ page: SCHOOL_PAGE_1, source: 'template' })
      .mockResolvedValueOnce({ page: SCHOOL_PAGE_2, source: 'template' })
      .mockResolvedValueOnce({ page: SCHOOL_PAGE_2, source: 'template' });

    const { getByTestId, findByText } = await render(<StoryMode language="en" />);
    expect(await findByText('Bom dia, professora!')).toBeTruthy();

    await fireEvent.press(getByTestId('story-next-btn'));
    expect(await findByText('Vamos abrir o caderno.')).toBeTruthy();
    expect(getByTestId('story-page-indicator').props.children).toBe('Página 2');

    await fireEvent.press(getByTestId('story-prev-btn'));
    expect(await findByText('Bom dia, professora!')).toBeTruthy();
    expect(getByTestId('story-page-indicator').props.children).toBe('Página 1');
  });

  it('opens scenario dropdown, switches scenario, clears speech, and loads the selected scenario', async () => {
    mockedGetNewStoryPage
      .mockResolvedValueOnce({ page: SCHOOL_PAGE_1, source: 'template' })
      .mockResolvedValueOnce({ page: SCHOOL_PAGE_2, source: 'template' })
      .mockResolvedValueOnce({ page: CAFE_PAGE_1, source: 'backend' });

    const { getByTestId, findByText } = await render(<StoryMode language="en" />);
    expect(await findByText('Bom dia, professora!')).toBeTruthy();

    await fireEvent.press(getByTestId('story-context-picker'));
    await fireEvent.press(getByTestId('story-context-cafe'));
    expect(mockedCancelSpeech).toHaveBeenCalled();
    expect(mockedClearStoredHistory).toHaveBeenCalledWith('cafe');
    expect(await findByText('Quero um bolo de arroz.')).toBeTruthy();
  });

  it('translates sentence to Turkish when language is set to tr and cancels speech on unmount', async () => {
    const { findByText, unmount } = await render(<StoryMode language="tr" />);

    expect(await findByText('Bom dia, professora!')).toBeTruthy();
    expect(await findByText('Günaydın öğretmenim!')).toBeTruthy();
    expect(mockedTranslateToTurkish).toHaveBeenCalledWith('Good morning, teacher!');

    await unmount();
    expect(mockedCancelSpeech).toHaveBeenCalled();
  });

  it('consumes app-level prefetched story & reply without redundant backend calls on mount', async () => {
    const getAppPrefetch = jest.fn(() => ({
      storyPromise: Promise.resolve(SCHOOL_PAGE_1),
      imagePromise: Promise.resolve('file:///cache/story-images/p1.jpg'),
      replyPromise: Promise.resolve(SCHOOL_PAGE_2),
      replyImagePromise: Promise.resolve('file:///cache/story-images/p2.jpg'),
    }));

    const { getByTestId, findByText } = await render(
      <StoryMode language="en" getAppPrefetch={getAppPrefetch} />,
    );

    expect(await findByText('Bom dia, professora!')).toBeTruthy();
    expect(mockedGetNewStoryPage).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('story-next-btn'));
    expect(await findByText('Vamos abrir o caderno.')).toBeTruthy();
    expect(getByTestId('story-page-indicator').props.children).toBe('Página 2');
  });
});
