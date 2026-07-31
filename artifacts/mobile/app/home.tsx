import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlobeView, SceneMode } from '@/components/GlobeView';
import { SearchBar } from '@/components/SearchBar';
import { CountryPreviewCard } from '@/components/CountryPreviewCard';
import { OnboardingModal, useOnboarding } from '@/components/OnboardingModal';
import { useColors } from '@/hooks/useColors';
import { Country, findNearestCountry } from '@/constants/countries';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { show: showOnboarding, complete: completeOnboarding } = useOnboarding();

  const [selectedCountry, setSelectedCountry]     = useState<Country | null>(null);
  const [globeSelectedLatLon, setGlobeSelectedLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [isSearchFocused, setIsSearchFocused]     = useState(false);
  const [globeReady, setGlobeReady]               = useState(false);
  const [tapHint, setTapHint]                     = useState(true);
  // Pause the globe's render loop while the detail screen covers this one.
  const [isFocused, setIsFocused]                 = useState(true);
  // TEMPORARY DEV-ONLY: lets Space Mode be exercised in Expo Go before there
  // is any real user-facing entry point. Remove before release — see the
  // __DEV__-gated toggle button below.
  const [sceneMode, setSceneMode]                 = useState<SceneMode>('earth');

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  const topInset    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleCountryTap = useCallback((lat: number, lon: number) => {
    const country = findNearestCountry(lat, lon);
    if (country) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedCountry(country);
      setGlobeSelectedLatLon({ lat: country.lat, lon: country.lon });
      setTapHint(false);
    }
  }, []);

  const handleSelectFromSearch = useCallback((country: Country) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedCountry(country);
    setGlobeSelectedLatLon({ lat: country.lat, lon: country.lon });
    setTapHint(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setSelectedCountry(null);
    setGlobeSelectedLatLon(null);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Full-screen globe */}
      <View style={StyleSheet.absoluteFill}>
        <GlobeView
          mode={sceneMode}
          autoRotate={!selectedCountry}
          interactive
          active={isFocused}
          onCountryTap={handleCountryTap}
          onReady={() => setGlobeReady(true)}
          selectedLatLon={globeSelectedLatLon}
        />
      </View>

      {/* Top UI */}
      <View
        style={[styles.topArea, { paddingTop: topInset + 8, paddingHorizontal: 16 }]}
      >
        {/* Logo row */}
        {!isSearchFocused && (
          <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={styles.logoRow}
          >
            <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
            <Text
              style={[styles.logoText, { color: colors.foreground }]}
              accessibilityRole="header"
            >
              Earth in Your Pocket
            </Text>
          </Animated.View>
        )}

        {/* Search bar */}
        <SearchBar
          onSelectCountry={handleSelectFromSearch}
          onFocusChange={setIsSearchFocused}
        />
      </View>

      {/* Tap hint */}
      {tapHint && globeReady && !isSearchFocused && !selectedCountry && (
        <Animated.View
          entering={FadeIn.delay(900).duration(700)}
          exiting={FadeOut.duration(300)}
          style={[styles.tapHint, { pointerEvents: 'none' }]}
        >
          <View style={[styles.tapHintPill, { backgroundColor: 'rgba(13,27,46,0.85)', borderColor: colors.border }]}>
            <Ionicons name="finger-print-outline" size={14} color={colors.primary} />
            <Text style={[styles.tapHintText, { color: colors.foregroundSecondary }]}>
              Tap the globe to explore
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Country preview card */}
      <View style={[styles.bottomArea, { paddingBottom: bottomInset + 12 }]}>
        {selectedCountry && (
          <CountryPreviewCard
            key={selectedCountry.code}
            country={selectedCountry}
            onDismiss={handleDismiss}
          />
        )}
      </View>

      {/* First-time onboarding */}
      {showOnboarding && (
        <OnboardingModal onComplete={completeOnboarding} />
      )}

      {/* TEMPORARY DEV-ONLY TOGGLE — Space Mode has no user-facing entry
          point yet. This button only renders in development builds
          (__DEV__ is stripped from production/release bundles) and exists
          solely so Space Mode can be exercised on a real device via Expo Go.
          Remove this block, the `sceneMode` state above, and the `mode`
          prop wiring on <GlobeView> once a real UI for switching modes
          exists (or before shipping, whichever comes first). */}
      {__DEV__ && (
        <Pressable
          onPress={() => setSceneMode(m => (m === 'earth' ? 'space' : 'earth'))}
          style={[
            styles.devModeToggle,
            { top: topInset + 8, backgroundColor: 'rgba(0,0,0,0.65)' },
          ]}
        >
          <Text style={styles.devModeToggleText}>
            DEV: {sceneMode === 'earth' ? 'Earth' : 'Space'} (tap to switch)
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topArea: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    gap: 10,
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logoText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.4,
    opacity: 0.9,
  },
  tapHint: {
    position: 'absolute',
    bottom: 200,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  tapHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  tapHintText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
  },
  // TEMPORARY DEV-ONLY — see the __DEV__ block above. Remove alongside it.
  devModeToggle: {
    position: 'absolute',
    right: 12,
    zIndex: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  devModeToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
