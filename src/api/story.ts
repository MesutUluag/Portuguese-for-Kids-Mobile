import { fetchWithAuth } from '@/api/client';
import { templatePagesByContext } from '@/core/data/index';
import { CONTEXT_TOPICS, type StoryContext } from '@/core/data/storyTopics';
import type { StoryPage } from '@/core/data/types';
import { getJSON, removeKey, setJSON, storyHistoryKey } from '@/utils/storage';

const MAX_CONVERSATION_HISTORY = 10;
const MAX_STORED_HISTORY = 30;
const STORY_REQUEST_TIMEOUT_MS = 25_000;

export type StorySource = 'backend' | 'template';

export interface StoryPageResult {
  page: StoryPage;
  source: StorySource;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isStoryPage(value: unknown): value is StoryPage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.pt === 'string' &&
    obj.pt.trim().length > 0 &&
    typeof obj.en === 'string' &&
    obj.en.trim().length > 0 &&
    typeof obj.mainEmoji === 'string' &&
    typeof obj.bgLeft === 'string' &&
    typeof obj.bgRight === 'string' &&
    (obj.imagePrompt === undefined || typeof obj.imagePrompt === 'string') &&
    (obj.replyTo === undefined || typeof obj.replyTo === 'string')
  );
}

/**
 * Parses an LLM response string (optionally wrapped in markdown fences or
 * surrounded by prose) into a validated `StoryPage`.
 */
export function parseStoryJson(raw: string): StoryPage {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON object found in story response');
  }
  const parsed: unknown = JSON.parse(match[0]);
  if (!isStoryPage(parsed)) {
    throw new Error('Parsed JSON is not a valid StoryPage');
  }
  return parsed;
}

/**
 * Fetches an AI-generated story turn from the Spring Boot `/api/story` endpoint.
 */
export async function fetchBackendStory(
  context: StoryContext = 'school',
  previousSentence?: string,
  conversationHistory?: string[],
): Promise<StoryPage> {
  const body: Record<string, unknown> = { context };

  if (previousSentence) {
    body.prompt = 'Continue the conversation.';
    body.previousSentence = previousSentence;
  } else {
    const topics = CONTEXT_TOPICS[context];
    const topic = topics[Math.floor(Math.random() * topics.length)] ?? topics[0];
    body.prompt = `Generate one sentence about ${topic}.`;
  }

  if (conversationHistory && conversationHistory.length > 0) {
    body.conversationHistory = conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
  }

  const data = await fetchWithAuth<{ content?: unknown }>(
    '/story',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    STORY_REQUEST_TIMEOUT_MS,
  );

  if (typeof data.content !== 'string') {
    throw new Error('Missing content field in backend story response');
  }

  return parseStoryJson(data.content);
}

/**
 * Returns an offline curated template story page matching `previousSentence`
 * when available, or a random opener for the selected context.
 */
export function generateTemplateStoryPage(
  context: StoryContext = 'school',
  previousSentence?: string,
): StoryPage {
  const pages = templatePagesByContext[context] ?? templatePagesByContext.school ?? [];
  if (previousSentence) {
    const reply = pages.find((p) => p.replyTo === previousSentence);
    if (reply) {
      return reply;
    }
  }
  const openers = pages.filter((p) => !p.replyTo);
  const pool = openers.length > 0 ? openers : pages;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (picked) {
    return picked;
  }
  return {
    pt: 'Bom dia, professora!',
    en: 'Good morning, teacher!',
    mainEmoji: '👩‍🏫',
    bgLeft: '🏫',
    bgRight: '☀️',
  };
}

/**
 * Fetches the next story page from the backend AI, falling back cleanly
 * to the curated offline template engine on any network, auth, or quota error.
 */
export async function getNewStoryPage(
  context: StoryContext = 'school',
  previousSentence?: string,
  conversationHistory?: string[],
): Promise<StoryPageResult> {
  try {
    const page = await fetchBackendStory(context, previousSentence, conversationHistory);
    return { page, source: 'backend' };
  } catch (err) {
    console.warn('[story] Backend story failed, falling back to template:', err);
    return {
      page: generateTemplateStoryPage(context, previousSentence),
      source: 'template',
    };
  }
}

export async function loadStoredHistory(context: StoryContext): Promise<string[]> {
  const stored = await getJSON<string[]>(storyHistoryKey(context), isStringArray);
  return stored ?? [];
}

export async function saveStoredHistory(
  context: StoryContext,
  history: readonly StoryPage[],
): Promise<void> {
  const sentences = history.map((p) => p.pt).slice(-MAX_STORED_HISTORY);
  await setJSON(storyHistoryKey(context), sentences);
}

export async function clearStoredHistory(context: StoryContext): Promise<void> {
  await removeKey(storyHistoryKey(context));
}
