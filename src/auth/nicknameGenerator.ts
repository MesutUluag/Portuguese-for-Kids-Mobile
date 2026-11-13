const ADJECTIVES_EN = [
  'Brave',
  'Happy',
  'Clever',
  'Sunny',
  'Swift',
  'Gentle',
  'Bright',
  'Lucky',
  'Curious',
  'Playful',
  'Bold',
  'Starry',
] as const;

const ANIMALS_EN = [
  'Owl',
  'Dolphin',
  'Fox',
  'Panda',
  'Falcon',
  'Otter',
  'Bunny',
  'Koala',
  'Lynx',
  'Puffin',
  'Turtle',
  'Robin',
] as const;

const ADJECTIVES_TR = [
  'Cesur',
  'Mutlu',
  'Zeki',
  'Parlak',
  'Hızlı',
  'Neşeli',
  'Meraklı',
  'Şanslı',
  'Minik',
  'Sevimli',
  'Usta',
  'Yıldız',
] as const;

const ANIMALS_TR = [
  'Baykuş',
  'Yunus',
  'Tilki',
  'Panda',
  'Şahin',
  'SuSamuru',
  'Tavşan',
  'Koala',
  'Vaşak',
  'Martı',
  'Kaplumbağa',
  'Serçe',
] as const;

const LEGACY_ADJECTIVES_TR = [
  'Hizli',
  'Neseli',
  'Merakli',
  'Sansli',
  'Yildiz',
] as const;

const LEGACY_ANIMALS_TR = [
  'Baykus',
  'Sahin',
  'Tavsan',
  'Vasak',
  'Marti',
  'Kaplumbaga',
  'Serce',
] as const;

const GENERATED_NICKNAMES: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const adj of ADJECTIVES_EN) {
    for (const animal of ANIMALS_EN) {
      set.add(`${adj}${animal}`);
    }
  }
  const allTrAdj = [...ADJECTIVES_TR, ...LEGACY_ADJECTIVES_TR];
  const allTrAnimals = [...ANIMALS_TR, ...LEGACY_ANIMALS_TR];
  for (const adj of allTrAdj) {
    for (const animal of allTrAnimals) {
      set.add(`${adj}${animal}`);
    }
  }
  return set;
})();

function pickRandom<T>(list: readonly T[]): T {
  const index = Math.floor(Math.random() * list.length);
  return list[index] ?? list[0]!;
}

/**
 * Generates a single-token child-safe nickname (no spaces, no digits, no PII).
 */
export function generateNickname(language: 'en' | 'tr'): string {
  const adj =
    language === 'tr' ? pickRandom(ADJECTIVES_TR) : pickRandom(ADJECTIVES_EN);
  const animal =
    language === 'tr' ? pickRandom(ANIMALS_TR) : pickRandom(ANIMALS_EN);
  return `${adj}${animal}`;
}

/**
 * Generates a list of distinct single-token child-safe nickname candidates.
 */
export function generateNicknameOptions(
  language: 'en' | 'tr',
  count = 6,
): string[] {
  const seen = new Set<string>();
  const maxAttempts = count * 8;
  let attempts = 0;

  while (seen.size < count && attempts < maxAttempts) {
    seen.add(generateNickname(language));
    attempts += 1;
  }

  return Array.from(seen);
}

/**
 * Validates that a chosen nickname is single-token, bounded, and free of email/PII syntax.
 */
export function isNicknameValid(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 24) return false;
  if (/[\s@]/.test(trimmed)) return false;
  return /^[A-Za-zÇçĞğİıÖöŞşÜü]+$/.test(trimmed);
}

/**
 * Returns true if the given display name matches the curated Adjective+Animal list.
 */
export function isGeneratedNickname(name?: string | null): boolean {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return false;
  return GENERATED_NICKNAMES.has(trimmed);
}

/**
 * Prompts the parent/child to pick a safe nickname unless the current display name
 * is already one of our curated Adjective+Animal combinations (blocking even
 * single-word real names coming from Google/Apple accounts).
 */
export function shouldPromptNickname(displayName?: string | null): boolean {
  return !isGeneratedNickname(displayName);
}
