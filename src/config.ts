const PROD_API = 'https://portugese-for-kids-backend-784137631227.us-central1.run.app/api';
const DEFAULT_RESET_URL = 'https://mesutuluag.github.io/Portugese-for-Kids/';
const DEFAULT_PRIVACY_POLICY_URL = 'https://mesutuluag.github.io/Portugese-for-Kids/privacy.html';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? PROD_API;
export const PASSWORD_RESET_CONTINUE_URL =
  process.env.EXPO_PUBLIC_PASSWORD_RESET_URL ?? DEFAULT_RESET_URL;
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? DEFAULT_PRIVACY_POLICY_URL;
export const IS_DEV = __DEV__;
