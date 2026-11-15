import { fetchWithAuth } from '@/api/client';
import {
  clearStoredHistory,
  fetchBackendStory,
  generateTemplateStoryPage,
  getNewStoryPage,
  loadStoredHistory,
  parseStoryJson,
  saveStoredHistory,
} from '@/api/story';
import { templatePagesByContext } from '@/core/data/index';
import type { StoryPage } from '@/core/data/types';
import { getJSON, removeKey, setJSON, storyHistoryKey } from '@/utils/storage';

jest.mock('@/api/client', () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock('@/utils/storage', () => ({
  getJSON: jest.fn(),
  setJSON: jest.fn(),
  removeKey: jest.fn(),
  storyHistoryKey: jest.fn((ctx: string) => `portuguese-kids-story-history:${ctx}`),
}));

const mockedFetchWithAuth = jest.mocked(fetchWithAuth);
const mockedGetJSON = jest.mocked(getJSON);
const mockedSetJSON = jest.mocked(setJSON);
const mockedRemoveKey = jest.mocked(removeKey);

describe('story API & offline template engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseStoryJson', () => {
    it('strips markdown code fences and extracts valid JSON wrapped in stray prose', () => {
      const raw = `Here is the story page:\n\`\`\`json
      {
        "pt": "Bom dia, professora!",
        "en": "Good morning, teacher!",
        "mainEmoji": "👩‍🏫",
        "bgLeft": "🏫",
        "bgRight": "☀️",
        "imagePrompt": "child greeting teacher at school"
      }
      \`\`\`\nHope you like it!`;

      const parsed = parseStoryJson(raw);
      expect(parsed).toEqual({
        pt: 'Bom dia, professora!',
        en: 'Good morning, teacher!',
        mainEmoji: '👩‍🏫',
        bgLeft: '🏫',
        bgRight: '☀️',
        imagePrompt: 'child greeting teacher at school',
      });
    });

    it('throws when no JSON object is present', () => {
      expect(() => parseStoryJson('just plain text')).toThrow(
        'No JSON object found in story response',
      );
    });

    it('throws when required StoryPage fields are missing or empty', () => {
      expect(() =>
        parseStoryJson('{"pt":"","en":"Hello","mainEmoji":"😀","bgLeft":"🏫","bgRight":"☀️"}'),
      ).toThrow('Parsed JSON is not a valid StoryPage');
    });
  });

  describe('generateTemplateStoryPage', () => {
    it('returns an opener when previousSentence is omitted', () => {
      const schoolPages = templatePagesByContext.school ?? [];
      const openerPts = schoolPages.filter((p) => !p.replyTo).map((p) => p.pt);

      const page = generateTemplateStoryPage('school');
      expect(page.pt.length).toBeGreaterThan(0);
      expect(openerPts).toContain(page.pt);
    });

    it('matches replyTo chain for previousSentence when available', () => {
      const schoolPages = templatePagesByContext.school ?? [];
      const withReply = schoolPages.find((p) => Boolean(p.replyTo));
      expect(withReply).toBeDefined();

      if (withReply?.replyTo) {
        const reply = generateTemplateStoryPage('school', withReply.replyTo);
        expect(reply.replyTo).toBe(withReply.replyTo);
        expect(reply.pt).toBe(withReply.pt);
      }
    });
  });

  describe('fetchBackendStory & getNewStoryPage', () => {
    it('calls POST /story and truncates conversationHistory to the last 10 items', async () => {
      const mockPage: StoryPage = {
        pt: 'Quero um sumo de laranja, por favor.',
        en: 'I want an orange juice, please.',
        mainEmoji: '🍊',
        bgLeft: '☕',
        bgRight: '🥐',
      };
      mockedFetchWithAuth.mockResolvedValueOnce({
        content: JSON.stringify(mockPage),
      });

      const longHistory = Array.from({ length: 14 }, (_, i) => `Sentence ${i + 1}`);
      const result = await fetchBackendStory('cafe', 'Bom dia!', longHistory);

      expect(result).toEqual(mockPage);
      expect(mockedFetchWithAuth).toHaveBeenCalledTimes(1);
      const [path, init] = mockedFetchWithAuth.mock.calls[0] ?? [];
      expect(path).toBe('/story');
      expect(init?.method).toBe('POST');
      const sentBody = JSON.parse(String(init?.body)) as {
        context: string;
        previousSentence: string;
        conversationHistory: string[];
      };
      expect(sentBody.context).toBe('cafe');
      expect(sentBody.previousSentence).toBe('Bom dia!');
      expect(sentBody.conversationHistory).toHaveLength(10);
      expect(sentBody.conversationHistory[0]).toBe('Sentence 5');
    });

    it('falls back cleanly to template story when backend errors', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockedFetchWithAuth.mockRejectedValueOnce(new Error('rate-limited'));

      const result = await getNewStoryPage('restaurant', 'Boa tarde!');
      expect(result.source).toBe('template');
      expect(result.page.pt.length).toBeGreaterThan(0);
      expect(result.page.en.length).toBeGreaterThan(0);
      warnSpy.mockRestore();
    });
  });

  describe('stored history helpers', () => {
    it('loads, caps at 30 items on save, and clears history per context', async () => {
      mockedGetJSON.mockResolvedValueOnce(['Olá!', 'Tudo bem?']);
      await expect(loadStoredHistory('market')).resolves.toEqual(['Olá!', 'Tudo bem?']);
      expect(storyHistoryKey).toHaveBeenCalledWith('market');

      const pages: StoryPage[] = Array.from({ length: 35 }, (_, i) => ({
        pt: `Frase ${i + 1}`,
        en: `Sentence ${i + 1}`,
        mainEmoji: '📘',
        bgLeft: '🏫',
        bgRight: '☀️',
      }));
      await saveStoredHistory('school', pages);
      expect(mockedSetJSON).toHaveBeenCalledWith(
        'portuguese-kids-story-history:school',
        expect.arrayContaining(['Frase 6', 'Frase 35']),
      );
      const savedArgs = mockedSetJSON.mock.calls[0]?.[1] as string[];
      expect(savedArgs).toHaveLength(30);

      await clearStoredHistory('school');
      expect(mockedRemoveKey).toHaveBeenCalledWith('portuguese-kids-story-history:school');
    });
  });
});
