import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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
  const ctaScale = useSharedValue(1);
  const flagUrl  = `https://flagcdn.com/w160/${country.code}.png`;

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const handleCtaPressIn  = () => { ctaScale.value = withSpring(0.96, { damping: 14, stiffness: 200 }); };
  const handleCtaPressOut = () => { ctaScale.value = withSpring(1.0,  { damping: 14, stiffness: 200 }); };

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(22).stiffness(130)}
      exiting={SlideOutDown.duration(240)}
      style={[styles.card, { backgroundColor: 'rgba(13,27,46,0.92)', borderColor: colors.border }]}
    >
      {/* Dismiss */}
      <Pressable
        onPress={onDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.dismissBtn}
        accessibilityLabel="Dismiss country preview"
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
            accessibilityLabel={`Flag of ${country.name}`}
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text
            style={[styles.countryName, { color: colors.foreground }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
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
      <Animated.View style={ctaStyle}>
        <Pressable
          onPress={() => router.push(`/country/${country.code}`)}
          onPressIn={handleCtaPressIn}
          onPressOut={handleCtaPressOut}
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={`Explore ${country.name}`}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Explore</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primaryForeground} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  dismissBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 1,
    padding: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingRight: 28,
  },
  flagContainer: {
    width: 74,
    height: 52,
    borderRadius: 10,
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
    letterSpacing: -0.2,
  },
  capital: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
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
    paddingVertical: 13,
    borderRadius: 13,
    gap: 6,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
});
