import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlobeView } from '@/components/GlobeView';
import { SearchBar } from '@/components/SearchBar';
import { CountryPreviewCard } from '@/components/CountryPreviewCard';
import { useColors } from '@/hooks/useColors';
import { Country, findNearestCountry } from '@/constants/countries';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [globeSelectedLatLon, setGlobeSelectedLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [tapHint, setTapHint] = useState(true);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleCountryTap = useCallback((lat: number, lon: number) => {
    const country = findNearestCountry(lat, lon);
    if (country) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      {/* Globe — full screen */}
      <View style={StyleSheet.absoluteFill}>
        <GlobeView
          autoRotate={!selectedCountry}
          interactive
          onCountryTap={handleCountryTap}
          onReady={() => setGlobeReady(true)}
          selectedLatLon={globeSelectedLatLon}
        />
      </View>

      {/* Top UI — Search bar */}
      <View
        style={[
          styles.topArea,
          { paddingTop: topInset + 8, paddingHorizontal: 16 },
        ]}
        pointerEvents={isSearchFocused ? 'box-none' : 'box-none'}
      >
        {/* Logo row */}
        {!isSearchFocused && (
          <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.logoRow}>
            <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.logoText, { color: colors.foreground }]}>Earth in Your Pocket</Text>
          </Animated.View>
        )}

        {/* Search */}
        <SearchBar
          onSelectCountry={handleSelectFromSearch}
          onFocusChange={setIsSearchFocused}
        />
      </View>

      {/* Tap hint */}
      {tapHint && globeReady && !isSearchFocused && !selectedCountry && (
        <Animated.View
          entering={FadeIn.delay(800).duration(600)}
          exiting={FadeOut.duration(300)}
          style={styles.tapHint}
          pointerEvents="none"
        >
          <View style={[styles.tapHintPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="finger-print-outline" size={14} color={colors.primary} />
            <Text style={[styles.tapHintText, { color: colors.foregroundSecondary }]}>
              Tap the globe to explore
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Bottom — Country preview card */}
      <View style={[styles.bottomArea, { paddingBottom: bottomInset + 12 }]}>
        {selectedCountry && (
          <CountryPreviewCard
            key={selectedCountry.code}
            country={selectedCountry}
            onDismiss={handleDismiss}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    letterSpacing: 0.3,
    opacity: 0.85,
  },
  tapHint: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  tapHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tapHintText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
