# 🇵🇹 Portuguese for Kids — Mobile

Native iOS & Android mobile app (Expo / React Native) for **children aged 7+** learning European Portuguese through flashcards, games, and AI-generated conversational stories.

Companion repositories:
- **Web frontend:** `../Portugese-for-Kids`
- **Spring Boot backend:** `../Portugese-for-Kids-Backend`
- **GitHub:** [MesutUluag/Portuguese-for-Kids-Mobile](https://github.com/MesutUluag/Portuguese-for-Kids-Mobile)

> **Current Status — Phase 0 (Foundation & Technical Spikes):** Core TypeScript data sync, mobile assets, CI checks, and Android-verified technical spikes (**Spike A: Firebase Auth AsyncStorage persistence** and **Spike B: Skia + Reanimated 60fps 3×3 jigsaw**) are implemented. Full learning mode screens (Cards, Games 1–8, Story, Auth/Leaderboard UI) follow in Phases 1–6.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | `~58.0.25` | Managed/CNG React Native toolchain & config plugins |
| React | `19.3.0` | UI runtime |
| React Native | `0.88.1` | Native iOS & Android runtime |
| TypeScript | `~6.0.3` | Strict type safety (`noUncheckedIndexedAccess`) |
| `@shopify/react-native-skia` | `2.14.0` | Hardware-accelerated jigsaw canvas & image clipping |
| `react-native-reanimated` | `4.7.1` | UI-thread animations & shared values |
| `react-native-gesture-handler` | `~3.3.0` | Native pan/tap gestures |
| `react-native-worklets` | `0.13.0` | Reanimated worklet runtime & `scheduleOnRN` bridge |
| `firebase` | `^13.3.0` | Firebase Auth (`getReactNativePersistence(AsyncStorage)`) |
| `@react-native-async-storage/async-storage` | `2.2.0` | Auth persistence & offline local storage |
| `@react-native-google-signin/google-signin` | `^17.0.0` | Native Google Sign-In |
| `expo-apple-authentication` | `~58.0.3` | Native Sign in with Apple (iOS) |
| `expo-audio` / `expo-speech` / `expo-haptics` | SDK 58 | Background music, pt-PT TTS & tactile feedback |
| `expo-image` / `react-native-svg` | SDK 58 / `15.16.0` | Cached illustrations & vector graphics |

---

## Prerequisites

- **Node.js `22`** (see `.nvmrc`)
- **Android testing:** Android Studio + Android SDK (`ANDROID_HOME="$HOME/Library/Android/sdk"`) + an `arm64-v8a` Pixel emulator (API 35/36 recommended) + JDK 21 (`temurin-21.jdk`)
- **iOS testing:** macOS with Xcode & CocoaPods, or **EAS Build** cloud builds
- **Core sync:** Sibling directory `../Portugese-for-Kids` present when running `npm run sync-core`

---

## Environment Setup

1. Copy `.env.example` to `.env.local` (`.env.local` is gitignored):

   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Firebase Web config (`EXPO_PUBLIC_FIREBASE_*`) and Google OAuth client IDs (`EXPO_PUBLIC_GOOGLE_*`).
3. Optional: set `EXPO_PUBLIC_API_BASE_URL` to override the production Cloud Run API URL configured in `src/config.ts` (for example `http://10.0.2.2:8081/api` on the Android emulator).

> Preview and production EAS iOS builds enforce `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` in `app.config.ts`.

---

## Running Locally

### Install dependencies

```bash
npm install
```

### Android Emulator (Dev Client)

Start an Android Virtual Device in Android Studio (**Device Manager**), then build and launch the native dev client:

```bash
npx expo run:android
```

Once the native binary is installed on the emulator, you can iterate quickly with:

```bash
npx expo start --dev-client --clear
```

### EAS Cloud Builds (`eas.json`)

| Profile | Distribution | Usage |
|---|---|---|
| `development` | Internal (`developmentClient: true`) | Android APK / iOS simulator dev client builds |
| `preview` | Internal (`apk` on Android) | QA & direct APK sideload testing builds |
| `internal` | Internal (`app-bundle` on Android) | Signed `.aab` builds for Play Store Internal Testing |
| `production` | Store (`autoIncrement: true`) | Play Store / App Store release builds |

```bash
npx eas-cli build --profile development --platform android
```

---

## Synced Core Data (`../Portugese-for-Kids`)

Shared Portuguese vocabulary (`646` words), verb conjugations, adverbs, prepositions, story topics/fallbacks, scene themes, crossword generator, and the alcohol-free mobile market dataset (`wine` and `beer` excluded) are synced automatically from `../Portugese-for-Kids`:

```bash
npm run sync-core         # Pull latest shared files & update core.lock.json
npm run sync-core:check   # Verify zero drift (also runs in GitHub Actions CI)
```

Never edit files under `src/core/` or `src/data/marketItems.mobile.ts` directly — update `../Portugese-for-Kids` and re-run `npm run sync-core`.

---

## Scripts & Verification

| Command | Description |
|---|---|
| `npm run sync-core:check` | Verify synced `src/core/` and `src/data/marketItems.mobile.ts` against `core.lock.json` |
| `npm run typecheck` | Run strict TypeScript project build checks (`tsc -b && tsc --noEmit`) |
| `npm run lint` | Run ESLint (`eslint .`) |
| `npm test -- --ci` | Run Jest unit tests (`jest-expo`) |
| `npx --yes expo-doctor` | Validate Expo SDK 58 config and dependency compatibility |

---

## Project Structure

```
Portugese-for-Kids-Mobile/
├── .github/workflows/ci.yml      # GitHub Actions CI (sync-core:check, typecheck, lint, jest)
├── app.config.ts                 # Dynamic Expo SDK 58 config, plugins, EAS projectId & cleartext dev helper
├── eas.json                      # EAS Build profiles (development, preview, production)
├── metro.config.js               # Metro resolver config (.cjs support + RN 0.88 package exports)
├── tsconfig.json                 # Strict app TS config (noUncheckedIndexedAccess: true)
├── tsconfig.core.json            # Synced core TS project reference
├── core.lock.json                # SHA-256 lockfile for synced web-repo files
├── scripts/sync-core.mjs         # Core data sync & drift-check script
├── assets/
│   ├── items/                    # Pre-rasterized 256×256 PNG illustrations for mobile games
│   └── music/                    # 96 kbps kids background music MP3 tracks
└── src/
    ├── App.tsx                   # Mode switcher & auth-gated learning shell
    ├── api/client.ts             # Centralised HTTP client (timeout, 401 refresh, schema guard)
    ├── audio/speech.ts           # expo-speech European Portuguese TTS + silent-mode audio session
    ├── auth/                     # Firebase Auth, parental gate, nickname picker, stats & leaderboard
    ├── commons/                  # Shared UI components (GameScoreBadge, LoadingSpinner, WordImage)
    ├── components/               # Learning game screens (Game1..Game5, Game8 Crossword)
    ├── config.ts                 # API, reset & privacy policy URLs + __DEV__ flag
    ├── core/                     # Auto-synced TypeScript datasets & generators from web repo
    ├── data/
    │   ├── marketItems.mobile.ts # Synced market items (alcohol-free mobile filter)
    │   └── __tests__/
    ├── spikes/
    │   └── SkiaJigsawSpike.tsx   # Phase 0 60fps Skia + Reanimated jigsaw reference (for Phase 4)
    ├── theme/tokens.ts           # Colour palette, radii, spacing & >=56pt touch targets
    ├── types/firebase-auth-rn.d.ts
    └── utils/
        ├── storage.ts            # Validated AsyncStorage key registry (incl. WIKI_IMAGE_CACHE) & wipe
        ├── gameScoring.ts        # Pure scoring formulas for Games 1–5 & 8 (board bonus = 25)
        ├── useWikiImage.ts       # Curated Wikimedia thumbnail loader with AsyncStorage cache
        ├── jigsawGeometry.ts     # Pure jigsaw grid & tab geometry helpers
        ├── jigsawPath.ts         # Skia path builder for jigsaw piece clipping
        └── __tests__/
```
