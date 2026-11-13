const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure Metro resolves Firebase JS SDK CommonJS files cleanly while preserving
// package.json "exports" (required in React Native 0.88+ for react-native/asset-registry).
config.resolver.sourceExts.push('cjs');

module.exports = config;
