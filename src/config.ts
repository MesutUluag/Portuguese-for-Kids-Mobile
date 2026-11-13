const PROD_API = 'https://portugese-for-kids-backend-784137631227.us-central1.run.app/api';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? PROD_API;
export const IS_DEV = __DEV__;
