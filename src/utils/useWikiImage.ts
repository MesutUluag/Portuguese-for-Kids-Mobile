import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

const FETCHED_NO_IMAGE = '__NO_IMAGE__';
const MAX_PERSISTED_CACHE_ENTRIES = 350;
export const WIKI_USER_AGENT =
  'PortugueseForKids/1.0 (https://mesutuluag.github.io/Portugese-for-Kids/)';

const memoryCache: Record<string, string> = {};
let diskHydrated = false;
let diskHydrationPromise: Promise<void> | null = null;
let diskPersistTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Maps Word.en values to unambiguous Wikipedia article titles so child learners
 * see clear illustrations (matching web `Portugese-for-Kids/src/utils/useWikiImage.ts`).
 */
const WIKI_ARTICLE: Record<string, string> = {
  'to be': 'Person',
  'to be (state)': 'Person',
  'to have': 'Gift',
  'to go': 'Walking',
  'to come': 'Walking',
  'to do / make': 'Cooking',
  'to speak / talk': 'Microphone',
  'to say / tell': 'Microphone',
  'to eat': 'Pizza',
  'to drink': 'Drinking_straw',
  'to sleep': 'Sleep',
  'to wake up': 'Alarm_clock',
  'to see / watch': 'Human_eye',
  'to hear / listen': 'Ear',
  'to read': 'Library',
  'to write': 'Ballpoint_pen',
  'to study': 'Classroom',
  'to work': 'Desk_job',
  'to play': 'Playground',
  'to run': 'Running',
  'to walk': 'Walking',
  'to swim': 'Swimming',
  'to sing': 'Singing',
  'to dance': 'Dancing',
  'to draw': 'Crayon',
  'to buy': 'Shopping',
  'to give': 'Gift',
  'to help': 'Volunteering',
  'to like': 'Hugging',
  'to want': 'Birthday_cake',
  'can / to be able to': 'Arm_wrestling',
  'to know': 'Student',
  'to open': 'Door',
  'to close': 'Door',
  'to start': 'Starting_blocks',
  'to finish': 'Gold_medal',
  'to arrive': 'Bus_station',
  'to leave': 'Luggage',
  'to enter': 'Door',
  'to sit': 'Chair',
  'to ask': 'Conversation',
  'to answer': 'Conversation',
  'to think': 'Brain',
  'to bring': 'Backpack',
  'to stay': 'Camping',
  'to return': 'Home',
  father: 'Father',
  mother: 'Mother',
  son: 'Boy',
  daughter: 'Girl',
  brother: 'Boy',
  sister: 'Girl',
  grandfather: 'Old_age',
  grandmother: 'Senescence',
  uncle: 'Grandparent',
  aunt: 'Grandparent',
  'cousin (m)': 'Grandparent',
  'cousin (f)': 'Grandparent',
  baby: 'Infant',
  family: 'Nuclear_family',
  'friend (m)': 'Friendship',
  'friend (f)': 'Friendship',
  dog: 'Dog',
  cat: 'Cat',
  fish: 'Fish',
  bird: 'Bird',
  rabbit: 'Domestic_rabbit',
  horse: 'Domestic_horse',
  cow: 'Cattle',
  pig: 'Domestic_pig',
  sheep: 'Sheep',
  chicken: 'Chicken',
  duck: 'Duck',
  lion: 'Lion',
  elephant: 'African_elephant',
  giraffe: 'Giraffe',
  monkey: 'Barbary_macaque',
  bear: 'Brown_bear',
  frog: 'Common_frog',
  turtle: 'Green_sea_turtle',
  water: 'Tap_water',
  milk: 'Milk',
  juice: 'Juice',
  bread: 'Bread',
  rice: 'Cooked_rice',
  soup: 'Soup',
  meat: 'Meat',
  fruit: 'Fruit',
  apple: 'Apple',
  banana: 'Banana',
  orange: 'Orange_(fruit)',
  carrot: 'Carrot',
  potato: 'Potato',
  egg: 'Egg_(food)',
  cheese: 'Cheese',
  cake: 'Cake',
  coffee: 'Coffee',
  lunch: 'School_lunch',
  dinner: 'Dinner',
  breakfast: 'Breakfast',
  red: 'Tomato',
  blue: 'Blue_jay',
  green: 'Leaf',
  yellow: 'Banana',
  white: 'White_(color)',
  black: 'Black_cat',
  pink: 'Flamingo',
  'orange (colour)': 'Pumpkin',
  purple: 'Lavender',
  head: 'Human_face',
  eye: 'Human_eye',
  nose: 'Nose',
  mouth: 'Mouth',
  ear: 'Ear',
  hand: 'Hand',
  foot: 'Human_foot',
  arm: 'Human_arm',
  leg: 'Human_leg',
  hair: 'Human_hair',
  'house / home': 'House',
  door: 'Door',
  window: 'Window',
  bed: 'Bed',
  table: 'Dining_table',
  chair: 'Chair',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  garden: 'Garden',
  school: 'Primary_school',
  library: 'Library',
  'teacher (m)': 'Teacher',
  'teacher (f)': 'Teacher',
  'student (m)': 'Student',
  'student (f)': 'Student',
  book: 'Book',
  notebook: 'Spiral_notebook',
  pencil: 'Pencil',
  pen: 'Pen',
  backpack: 'Backpack',
  'city / town': 'City',
  street: 'Street',
  park: 'Park',
  beach: 'Beach',
  supermarket: 'Supermarket',
  hospital: 'Hospital',
  restaurant: 'Restaurant',
  'shop / store': 'Retail',
  car: 'Car',
  bus: 'Bus',
  train: 'Train',
  aeroplane: 'Airplane',
  bicycle: 'Bicycle',
  boat: 'Boat',
  'big / large': 'Elephant',
  'small / little': 'Mouse',
  'beautiful / pretty': 'Butterfly',
  ugly: 'Warthog',
  good: 'Laughing',
  bad: 'Crying',
  new: 'Incandescent_light_bulb',
  old: 'Wrinkle',
  'fast / quick': 'Cheetah',
  slow: 'Sloth',
  'hot / warm': 'Fire',
  cold: 'Ice',
  happy: 'Laughing',
  sad: 'Crying',
  tired: 'Yawn',
  hungry: 'Fasting',
  thirsty: 'Drinking_water',
  sick: 'Common_cold',
  healthy: 'Physical_exercise',
  tall: 'Giraffe',
  short: 'Miniature_Dachshund',
  easy: 'Puzzle',
  difficult: "Rubik's_cube",
  today: 'Calendar',
  tomorrow: 'Calendar',
  yesterday: 'Calendar',
  morning: 'Morning',
  afternoon: 'Afternoon',
  'night / evening': 'Night_sky',
  day: 'Calendar',
  week: 'Calendar',
  month: 'Calendar',
  year: 'Year',
  'hour / time': 'Clock',
  sun: 'Sun',
  rain: 'Rain',
  snow: 'Snow',
  wind: 'Wind',
  cloud: 'Cumulus_cloud',
  weather: 'Weather',
  hello: 'Wave_(gesture)',
  goodbye: 'Wave_(gesture)',
  'thank you (m)': 'Handshake',
  'thank you (f)': 'Handshake',
  please: 'Namaste',
  'sorry / excuse me': 'Namaste',
  yes: 'Thumbs_up',
  no: 'Stop_sign',
  'okay / alright': 'Thumbs_up',
  'excuse me': 'Namaste',
};

function wikiArticleForTerm(en: string): string {
  const mapped = WIKI_ARTICLE[en];
  if (mapped) return mapped;
  return en.split(/[\s/]/)[0] ?? en;
}

function isStringRecord(val: unknown): val is Record<string, string> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  return Object.values(val).every((v) => typeof v === 'string');
}

async function ensureDiskCacheHydrated(): Promise<void> {
  if (diskHydrated) return;
  if (diskHydrationPromise) {
    return diskHydrationPromise;
  }

  diskHydrationPromise = (async () => {
    const stored = await getJSON<Record<string, string>>(
      STORAGE_KEYS.WIKI_IMAGE_CACHE,
      isStringRecord,
    );
    if (stored) {
      for (const [k, v] of Object.entries(stored)) {
        if (!(k in memoryCache)) {
          memoryCache[k] = v;
        }
      }
    }
    diskHydrated = true;
    diskHydrationPromise = null;
  })();

  return diskHydrationPromise;
}

function schedulePersistCache(): void {
  if (diskPersistTimer) return;
  diskPersistTimer = setTimeout(() => {
    diskPersistTimer = null;
    const entries = Object.entries(memoryCache).filter(
      ([, v]) => v !== FETCHED_NO_IMAGE,
    );
    const trimmed =
      entries.length > MAX_PERSISTED_CACHE_ENTRIES
        ? Object.fromEntries(entries.slice(-MAX_PERSISTED_CACHE_ENTRIES))
        : Object.fromEntries(entries);
    void setJSON(STORAGE_KEYS.WIKI_IMAGE_CACHE, trimmed);
  }, 1500);
}

/**
 * Resolves a child-friendly Wikipedia thumbnail URL for an English vocabulary term,
 * backed by in-memory + AsyncStorage URL caching. Returns null while loading or offline.
 */
export function useWikiImage(term: string): string | null {
  const [resolved, setResolved] = useState<{ term: string; url: string | null }>({
    term: '',
    url: null,
  });

  useEffect(() => {
    if (!term) return undefined;

    let cancelled = false;

    void (async () => {
      await ensureDiskCacheHydrated();
      if (cancelled) return;

      if (term in memoryCache) {
        const cached = memoryCache[term];
        setResolved({
          term,
          url: !cached || cached === FETCHED_NO_IMAGE ? null : cached,
        });
        return;
      }

      const keyword = wikiArticleForTerm(term);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Api-User-Agent': WIKI_USER_AGENT,
      };
      if (Platform.OS !== 'web') {
        headers['User-Agent'] = WIKI_USER_AGENT;
      }
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keyword)}`,
          { headers },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: unknown = await res.json();
        if (cancelled) return;

        let imgUrl: string | null = null;
        if (typeof data === 'object' && data !== null) {
          const rec = data as {
            thumbnail?: { source?: unknown } | null;
            originalimage?: { source?: unknown } | null;
          };
          const thumb =
            typeof rec.thumbnail?.source === 'string' ? rec.thumbnail.source : null;
          const orig =
            typeof rec.originalimage?.source === 'string' &&
            !/\.svg(?:$|\?)/i.test(rec.originalimage.source)
              ? rec.originalimage.source
              : null;
          imgUrl = thumb ?? orig;
        }

        memoryCache[term] = imgUrl ?? FETCHED_NO_IMAGE;
        if (imgUrl) {
          schedulePersistCache();
        }
        setResolved({ term, url: imgUrl });
      } catch {
        if (cancelled) return;
        // Do not poison memoryCache on transient network or HTTP failures so future retries can succeed
        setResolved({ term, url: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [term]);

  if (!term) return null;
  if (term in memoryCache) {
    const val = memoryCache[term];
    return !val || val === FETCHED_NO_IMAGE ? null : val;
  }
  return resolved.term === term ? resolved.url : null;
}
