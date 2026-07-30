import React, { useEffect } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  COUNTRIES_BY_CODE,
  formatArea,
  formatPopulation,
} from '@/constants/countries';

interface InfoCardProps {
  icon: string;
  label: string;
  value: string;
  delay?: number;
  accentColor: string;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
}

function InfoCard({
  icon,
  label,
  value,
  delay = 0,
  accentColor,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
}: InfoCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={[styles.infoCard, { backgroundColor: cardBg, borderColor }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
        <Ionicons name={icon as any} size={18} color={accentColor} />
      </View>
      <Text style={[styles.infoLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: textColor }]} numberOfLines={2}>
        {value}
      </Text>
    </Animated.View>
  );
}

export default function CountryDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code: string }>();

  const country = COUNTRIES_BY_CODE[code ?? ''];

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!country) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Country not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const flagUrl = `https://flagcdn.com/w640/${country.code}.png`;

  const infoCards = [
    { icon: 'location-outline', label: 'Capital', value: country.capital },
    { icon: 'people-outline', label: 'Population', value: formatPopulation(country.population) },
    { icon: 'map-outline', label: 'Area', value: formatArea(country.area) },
    { icon: 'card-outline', label: 'Currency', value: `${country.currency.name} (${country.currency.symbol})` },
    { icon: 'chatbubble-outline', label: 'Language', value: country.language },
    { icon: 'earth-outline', label: 'Continent', value: country.continent },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset, paddingBottom: bottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>

        {/* Flag */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.flagWrap}>
          <Image
            source={{ uri: flagUrl }}
            style={[styles.flagImage, { borderColor: colors.border }]}
            resizeMode="cover"
          />
          {/* Subtle glow behind flag */}
          <View style={[styles.flagGlow, { backgroundColor: colors.primary + '18' }]} />
        </Animated.View>

        {/* Country name + code */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.nameWrap}>
          <View style={[styles.codePill, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>
              {country.code.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.countryName, { color: colors.foreground }]}>
            {country.name}
          </Text>
          <Text style={[styles.capitalSub, { color: colors.mutedForeground }]}>
            {country.capital}
          </Text>
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeIn.delay(200).duration(400)}
          style={[styles.divider, { backgroundColor: colors.border }]}
        />

        {/* Info cards grid */}
        <Animated.Text
          entering={FadeInDown.delay(200).duration(400)}
          style={[styles.sectionTitle, { color: colors.mutedForeground }]}
        >
          COUNTRY FACTS
        </Animated.Text>
        <View style={styles.cardsGrid}>
          {infoCards.map((card, i) => (
            <InfoCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              delay={250 + i * 60}
              accentColor={colors.primary}
              cardBg={colors.card}
              borderColor={colors.border}
              textColor={colors.foreground}
              mutedColor={colors.mutedForeground}
            />
          ))}
        </View>

        {/* Currency detail */}
        <Animated.View
          entering={FadeInDown.delay(640).duration(400)}
          style={[styles.currencyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.currencyIconWrap, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.currencySymbol, { color: colors.primary }]}>
              {country.currency.symbol}
            </Text>
          </View>
          <View style={styles.currencyInfo}>
            <Text style={[styles.currencyName, { color: colors.foreground }]}>
              {country.currency.name}
            </Text>
            <Text style={[styles.currencyCode, { color: colors.mutedForeground }]}>
              {country.currency.code} · Official currency
            </Text>
          </View>
        </Animated.View>

        {/* Coordinates */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(400)}
          style={[styles.coordCard, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}
        >
          <Ionicons name="compass-outline" size={16} color={colors.primary} />
          <Text style={[styles.coordText, { color: colors.mutedForeground }]}>
            {Math.abs(country.lat).toFixed(2)}°{country.lat >= 0 ? 'N' : 'S'},{' '}
            {Math.abs(country.lon).toFixed(2)}°{country.lon >= 0 ? 'E' : 'W'}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  backBtn: {
    marginTop: 8,
    padding: 12,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  flagWrap: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  flagImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 1,
  },
  flagGlow: {
    position: 'absolute',
    bottom: -20,
    left: 20,
    right: 20,
    height: 40,
    borderRadius: 20,
  },
  nameWrap: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  codePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  countryName: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  capitalSub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 20,
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  infoCard: {
    width: '47.5%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 20,
  },
  currencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    marginBottom: 10,
  },
  currencyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  currencyCode: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  coordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  coordText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
