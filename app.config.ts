import type { ConfigContext, ExpoConfig } from 'expo/config';
import {
  withAndroidManifest,
  withGradleProperties,
  type ConfigPlugin,
} from 'expo/config-plugins';

function upsertGradleProp(
  props: { type: string; key?: string; value?: string }[],
  key: string,
  value: string,
): void {
  const idx = props.findIndex(
    (item) => item.type === 'property' && item.key === key,
  );
  if (idx >= 0) {
    props[idx] = { type: 'property', key, value };
  } else {
    props.push({ type: 'property', key, value });
  }
}

/**
 * Prevents Android native C++ OOM kills (`clang++ Killed` while compiling
 * `@shopify/react-native-skia`) on cloud CI runners by capping Gradle/CMake
 * parallelism, and restricts internal preview/dev APKs to `arm64-v8a`.
 */
const withAndroidMemorySafeBuild: ConfigPlugin<{ singleArm64: boolean }> = (
  config,
  { singleArm64 },
) =>
  withGradleProperties(config, (mod) => {
    upsertGradleProp(
      mod.modResults,
      'org.gradle.jvmargs',
      '-Xmx2048m -XX:MaxMetaspaceSize=512m',
    );
    upsertGradleProp(mod.modResults, 'org.gradle.workers.max', '2');
    upsertGradleProp(mod.modResults, 'org.gradle.parallel', 'false');
    if (singleArm64) {
      upsertGradleProp(mod.modResults, 'reactNativeArchitectures', 'arm64-v8a');
    }
    return mod;
  });

/**
 * Allows cleartext HTTP ONLY in development builds so local backend testing
 * (`http://10.0.2.2:8081/api` or `http://<Mac-LAN-IP>:8081/api`) works cleanly
 * while keeping preview and production builds strictly HTTPS-only.
 */
const withDevCleartextTraffic: ConfigPlugin = (config) => {
  if (process.env.EXPO_PUBLIC_CLEARTEXT_HTTP !== '1') {
    return config;
  }
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return mod;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const buildPlatform = process.env.EAS_BUILD_PLATFORM;
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (
    !iosUrlScheme &&
    buildPlatform === 'ios' &&
    (buildProfile === 'preview' ||
      buildProfile === 'internal' ||
      buildProfile === 'production')
  ) {
    throw new Error(
      `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is required for EAS iOS "${buildProfile}" builds.`,
    );
  }
  const resolvedIosUrlScheme =
    iosUrlScheme ?? 'com.googleusercontent.apps.placeholder';

  const baseConfig: ExpoConfig = {
    ...config,
    name: 'Portuguese for Kids',
    slug: 'portugese-for-kids-mobile',
    scheme: 'portugeseforkids',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    runtimeVersion: {
      policy: 'fingerprint',
    },
    ios: {
      bundleIdentifier: 'com.mesutuluag.portugeseforkids',
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.mesutuluag.portugeseforkids',
      adaptiveIcon: {
        backgroundColor: '#fcedb1',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      blockedPermissions: ['com.google.android.gms.permission.AD_ID'],
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-asset',
      [
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: false,
        },
      ],
      'expo-image',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#fcedb1',
        },
      ],
      'expo-status-bar',
      'expo-apple-authentication',
      [
        '@react-native-google-signin/google-signin',
        { iosUrlScheme: resolvedIosUrlScheme },
      ],
    ],
    updates: {
      url: 'https://u.expo.dev/31760366-b88e-4303-b982-53fd0690ef38',
    },
    extra: {
      ...config.extra,
      eas: {
        ...(typeof config.extra?.eas === 'object' && config.extra.eas !== null
          ? (config.extra.eas as Record<string, unknown>)
          : {}),
        projectId: '31760366-b88e-4303-b982-53fd0690ef38',
      },
    },
  };

  const isArm64OnlyApk =
    buildProfile === 'preview' || buildProfile === 'development';
  return withAndroidMemorySafeBuild(withDevCleartextTraffic(baseConfig), {
    singleArm64: isArm64OnlyApk,
  });
};
