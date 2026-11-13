# AGENTS.md — AI Agent Guide for Portuguese for Kids Mobile

Expo / React Native (TypeScript) mobile app for **children aged 7+** learning European Portuguese.
References sibling repos: `../Portugese-for-Kids` (web) and `../Portugese-for-Kids-Backend` (Spring Boot API).

---

## Commands & SDK Rules

Look up current `expo` major version in `package.json` (SDK 58) before calling any Expo/RN API (`https://docs.expo.dev/versions/v58.0.0/` or `https://docs.expo.dev/llms.txt`). Never rely on stale training memory.

```bash
npx expo install <pkg>     # ALWAYS install native/Expo deps via expo install
npm run sync-core          # Sync core TS data from ../Portugese-for-Kids
npm run sync-core:check    # Verify zero drift against ../Portugese-for-Kids
npm run typecheck          # tsc -b && tsc --noEmit
npm run lint               # eslint .
npm test                   # Jest (jest-expo)
npx expo-doctor            # Diagnose SDK/config issues
```

---

## 1. Architecture & Code Structure
- **Navigation model:** State-driven mode switcher in `src/App.tsx` (matching the web app — **do not** add Expo Router unless explicitly requested).
- **Feature folders:** `src/auth/`, `src/story/`, `src/components/`, `src/audio/`, `src/api/`, `src/data/`, `src/theme/`, `src/utils/`. Shared UI lives in `src/commons/`.
- **`src/core/` & `src/data/marketItems.mobile.ts` are generated:** **Never** edit them by hand. Update `../Portugese-for-Kids`, then run `npm run sync-core`. CI fails on drift or `core.lock.json` hash mismatch.
- **Continuous Native Generation:** Never commit `ios/` or `android/`. Configure native behavior in `app.config.ts` and config plugins.
- **Metro Resolver & RN 0.88 Package Exports (`metro.config.js`):** Never set `unstable_enablePackageExports = false` (breaks `react-native/asset-registry` and Firebase `react-native` entrypoints).
- **Strict TypeScript:** Root app uses `"strict": true` + `"noUncheckedIndexedAccess": true` (synced `src/core/` uses `tsconfig.core.json` with `"strict": true`). No `any`; use `unknown` + narrowing at API boundaries.
- **Path alias:** Use `@/` (`./src/*`). Avoid deep relative imports (`../../../`).
- **Single sources of truth:** `Mode` union in `src/core/data/types.ts`, `StoryContext` + `CONTEXT_TOPICS` in `src/core/data/storyTopics.ts`, API/policy URLs in `src/config.ts`, colours/radii/spacing in `src/theme/tokens.ts`.
- **Bilingual by contract:** Every screen, game, and `accessibilityLabel` receives and respects `language: 'en' | 'tr'`.
- **Speech via wrapper only:** Call `speakText` / `cancelSpeech` from `src/audio/speech.ts` (never call `expo-speech` directly in screens/games); every game calls `cancelSpeech()` on unmount.
- **Game contract:** Every game renders `GameScoreBadge` and reports points via `onScore(pts)`. Scoring functions are pure and unit-tested.
- **Logging:** Zero `console.log` in committed code. Use `console.warn` / `console.error` only, and never log tokens, emails, or request bodies.

## 2. Performance, UI & Accessibility
- Profile performance on **production/release builds** on mid-range Android, not dev builds.
- Keep animations & drag gestures on the UI thread (Reanimated shared values / worklets + Gesture Handler); sync back to JS on gesture end only.
- Use `FlatList` (`getItemLayout`, memoised `renderItem`) for large lists, `StyleSheet.create` outside components, and `expo-image` with `cachePolicy="memory-disk"` and explicit dimensions.
- Touch targets for 7+ kids: **`>= 56 pt`** (`touchTargets.min`) for answers and nav buttons; add `hitSlop` on small icons.
- Light mode only (`userInterfaceStyle: 'light'`), safe-area insets everywhere, cap `maxFontSizeMultiplier` (e.g. `1.3`) on dense grids, respect `useReducedMotion()`, never use colour alone for feedback.

## 3. State, Networking, Security & Children's Privacy (Non-Negotiable)
- **Zero ads & 100% free:** Never integrate ad SDKs (`AD_ID` permission stays blocked) or behavioural analytics. Check new SDKs against Google Families Self-Certified SDK requirements before adding.
- **No PII in logs/Sentry:** `sendDefaultPii: false`, scrubbed `beforeSend`, hashed UID only.
- **Parental gate:** Every outbound link, mailto, review prompt, or account action passes through the parental gate.
- **No free-text public profiles:** Leaderboard display names come strictly from the child-safe nickname picker (`Adjective + Animal`).
- **Alcohol-free mobile dataset:** `wine` and `beer` remain excluded via `MOBILE_EXCLUDED_MARKET_ITEMS` in `scripts/sync-core.mjs`.
- **Single HTTP client:** All backend calls go through `src/api/client.ts` (timeout + single 401 refresh-retry; never retry 400/429). Offline flashcards, games, template stories, and telemetry outbox must work without network.
- **Versioned storage keys:** Document every AsyncStorage key in `src/utils/storage.ts` + README and validate parsed JSON before use. Never store secrets in AsyncStorage.
- **Release & confirmation gates:** Never commit, submit to App Store Connect / Google Play, publish production OTA updates, or change Firebase/Cloud Console settings without explicit user confirmation. Report simulator/device testing honestly.
