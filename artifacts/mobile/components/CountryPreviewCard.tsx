import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Country, formatPopulation } from '@/constants/countries';

interface CountryPreviewCardProps {
  country: Country;
  onDismiss: () => void;
}

export function CountryPreviewCard({ country, onDismiss }: CountryPreviewCardProps) {
  const colors = useColors();

  const flagUrl = `https://flagcdn.com/w160/${country.code}.png`;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20).stiffness(120)}
      exiting={SlideOutDown.duration(250)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Dismiss button */}
      <Pressable
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dismissBtn}
      >
        <Ionicons name="close" size={18} color={colors.mutedForeground} />
      </Pressable>

      <View style={styles.row}>
        {/* Flag */}
        <View style={[styles.flagContainer, { borderColor: colors.border }]}>
          <Image
            source={{ uri: flagUrl }}
            style={styles.flag}
            resizeMode="cover"
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.countryName, { color: colors.foreground }]} numberOfLines={1}>
            {country.name}
          </Text>
          <Text style={[styles.capital, { color: colors.mutedForeground }]} numberOfLines={1}>
            {country.capital}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.backgroundTertiary }]}>
              <Ionicons name="people-outline" size={11} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.foregroundSecondary }]}>
                {formatPopulation(country.population)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.backgroundTertiary }]}>
              <Ionicons name="earth-outline" size={11} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.foregroundSecondary }]}>
                {country.continent}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* CTA */}
      <Pressable
        onPress={() => router.push(`/country/${country.code}`)}
        style={({ pressed }) => [
          styles.ctaBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Explore</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.primaryForeground} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  dismissBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingRight: 24,
  },
  flagContainer: {
    width: 72,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  flag: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  countryName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  capital: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
