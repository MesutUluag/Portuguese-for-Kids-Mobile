import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { kidsWords } from '@/core/data/index';
import { FirebasePersistenceSpike } from '@/spikes/FirebasePersistenceSpike';
import { SkiaJigsawSpike } from '@/spikes/SkiaJigsawSpike';
import { colors, radii, spacing, touchTargets } from '@/theme/tokens';

type SpikeTab = 'auth' | 'skia';

export default function App() {
  const [activeTab, setActiveTab] = useState<SpikeTab>('skia');

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Portuguese for Kids — Phase 0 Spikes</Text>
            <Text style={styles.subheader}>
              Synced core vocabulary loaded: {kidsWords.length} words
            </Text>

            <View style={styles.tabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'skia' }}
                accessibilityLabel="Open Spike B Skia Jigsaw test"
                onPress={() => setActiveTab('skia')}
                style={[styles.tab, activeTab === 'skia' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'skia' && styles.tabTextActive,
                  ]}
                >
                  Spike B: Skia
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'auth' }}
                accessibilityLabel="Open Spike A Firebase Auth Persistence test"
                onPress={() => setActiveTab('auth')}
                style={[styles.tab, activeTab === 'auth' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'auth' && styles.tabTextActive,
                  ]}
                >
                  Spike A: Auth
                </Text>
              </Pressable>
            </View>

            {activeTab === 'skia' ? (
              <SkiaJigsawSpike />
            ) : (
              <FirebasePersistenceSpike />
            )}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
  },
  subheader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.amber,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  tabTextActive: {
    color: colors.white,
  },
});
