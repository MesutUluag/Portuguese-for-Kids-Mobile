import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { __resetAudioSessionForTests, ensureAppAudioSession } from '@/audio/audioSession';
import { cancelSpeech, speakText } from '@/audio/speech';

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn().mockResolvedValue([
    {
      identifier: 'pt-pt-voice',
      name: 'Joana (Portugal)',
      language: 'pt-PT',
      quality: 'Enhanced',
    },
  ]),
  speak: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/storage', () => ({
  STORAGE_KEYS: { PT_VOICE_HINT_SHOWN: 'pt_voice_hint_shown' },
  getJSON: jest.fn().mockResolvedValue(true),
  setJSON: jest.fn().mockResolvedValue(true),
}));

const mockSetAudioModeAsync = setAudioModeAsync as jest.MockedFunction<typeof setAudioModeAsync>;
const mockSpeechSpeak = Speech.speak as jest.MockedFunction<typeof Speech.speak>;
const mockSpeechStop = Speech.stop as jest.MockedFunction<typeof Speech.stop>;

describe('speech & shared audioSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetAudioSessionForTests();
  });

  afterEach(() => {
    cancelSpeech();
    jest.useRealTimers();
  });

  it('configures shared audio mode once and avoids calling Speech.stop when idle', async () => {
    cancelSpeech();
    expect(mockSpeechStop).not.toHaveBeenCalled();

    await ensureAppAudioSession();
    await ensureAppAudioSession();
    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
  });

  it('calls Speech.stop only when canceling an active spoken utterance', async () => {
    jest.useFakeTimers();

    speakText('maçã', { language: 'en' });
    await jest.advanceTimersByTimeAsync(40);
    expect(mockSpeechSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeechStop).not.toHaveBeenCalled();

    cancelSpeech();
    expect(mockSpeechStop).toHaveBeenCalledTimes(1);

    cancelSpeech();
    expect(mockSpeechStop).toHaveBeenCalledTimes(1);
  });
});
