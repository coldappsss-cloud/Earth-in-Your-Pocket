import React, { useEffect } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  COUNTRIES_BY_CODE,
  NOT_AVAILABLE,
  formatAreaFull,
  formatPopulationFull,
} from '@/constants/countries';

/** Deep links land here with no history, so `back()` alone can be a dead end. */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

// ─── Pressable with spring scale ───────────────────────────────────────────
function ScaleButton({
  onPress,
  style,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn ={() => { scale.value = withSpring(0.94, { damping: 14, stiffness: 200 }); }}
        onPressOut={() => { scale.value = withSpring(1.00, { damping: 14, stiffness: 200 }); }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Info tile ──────────────────────────────────────────────────────────────
interface InfoCardProps {
  icon: string;
  label: string;
  value: string;
  delay?: number;
  accent: string;
  cardBg: string;
  border: string;
  text: string;
  muted: string;
}

function InfoCard({ icon, label, value, delay=0, accent, cardBg, border, text, muted }: InfoCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(380).springify()}
      style={[styles.infoCard, { backgroundColor: cardBg, borderColor: border }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
      </View>
      <Text style={[styles.infoLabel, { color: muted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.infoValue, { color: text }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

// ─── Country Detail Screen ──────────────────────────────────────────────────
export default function CountryDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code: string }>();
  const country = COUNTRIES_BY_CODE[code ?? ''];

  const topInset    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!country) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Country not found</Text>
        <Pressable
          onPress={goBack}
          style={[styles.errorBack, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.errorBackText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const flagUrl = `https://flagcdn.com/w640/${country.code}.png`;

  const tileProps = { accent: colors.primary, cardBg: colors.card, border: colors.border, text: colors.foreground, muted: colors.mutedForeground };

  const infoCards = [
    { icon: 'business-outline',   label: 'Capital',    value: country.capital ?? NOT_AVAILABLE },
    { icon: 'people-outline',     label: 'Population', value: formatPopulationFull(country.population) },
    { icon: 'resize-outline',     label: 'Area',       value: formatAreaFull(country.area) },
    {
      icon: 'cash-outline',
      label: 'Currency',
      value: country.currency
        ? `${country.currency.symbol} ${country.currency.name}`
        : NOT_AVAILABLE,
    },
    { icon: 'language-outline',   label: 'Language',   value: country.language ?? NOT_AVAILABLE },
    { icon: 'earth-outline',      label: 'Continent',  value: country.continent },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back button — pinned so it stays reachable while the page scrolls */}
      <View style={[styles.headerBar, { paddingTop: topInset + 8 }]}>
        <ScaleButton onPress={goBack} accessibilityLabel="Go back to the globe">
          <View
            style={[
              styles.backButton,
              { backgroundColor: colors.cardElevated, borderColor: colors.primary + '55' },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={[styles.backLabel, { color: colors.foreground }]}>Back</Text>
          </View>
        </ScaleButton>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + 68, paddingBottom: bottomInset + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Flag */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.flagWrap}>
          <View style={[styles.flagFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="flag-outline" size={34} color={colors.mutedForeground} />
            <Text style={[styles.flagFallbackText, { color: colors.mutedForeground }]}>
              Flag unavailable
            </Text>
          </View>
          <Image
            source={{ uri: flagUrl }}
            style={[styles.flagImage, { borderColor: colors.border }]}
            resizeMode="cover"
            accessibilityLabel={`Flag of ${country.name}`}
          />
          <View style={[styles.flagGlow, { backgroundColor: colors.primary + '16' }]} />
        </Animated.View>

        {/* Country name */}
        <Animated.View entering={FadeInDown.delay(80).duration(450)} style={styles.nameWrap}>
          <View style={[styles.codePill, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>
              {country.code.toUpperCase()}
            </Text>
          </View>
          <Text
            style={[styles.countryName, { color: colors.foreground }]}
            accessibilityRole="header"
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={2}
          >
            {country.name}
          </Text>
          <Text style={[styles.capitalSub, { color: colors.mutedForeground }]}>
            {country.capital ?? country.continent}
          </Text>
        </Animated.View>

        {/* Divider — dimming lives in the colour so it can't fight the fade-in */}
        <Animated.View
          entering={FadeIn.delay(180).duration(400)}
          style={[styles.divider, { backgroundColor: colors.border + '99' }]}
        />

        {/* Section header */}
        <Animated.Text
          entering={FadeInDown.delay(200).duration(380)}
          style={[styles.sectionTitle, { color: colors.mutedForeground }]}
        >
          COUNTRY FACTS
        </Animated.Text>

        {/* Info cards grid */}
        <View style={styles.cardsGrid}>
          {infoCards.map((card, i) => (
            <InfoCard key={card.label} delay={240 + i * 55} {...card} {...tileProps} />
          ))}
        </View>

        {/* Currency detail card — omitted entirely when there is no currency,
            rather than rendering an empty symbol tile */}
        {country.currency && (
          <Animated.View
            entering={FadeInDown.delay(580).duration(380)}
            style={[styles.currencyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessible
            accessibilityLabel={`Currency: ${country.currency.name}, code ${country.currency.code}, symbol ${country.currency.symbol}`}
          >
            <View style={[styles.currencyIconWrap, { backgroundColor: colors.primary + '22' }]}>
              <Text
                style={[styles.currencySymbol, { color: colors.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
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
        )}

        {/* Coordinates */}
        <Animated.View
          entering={FadeInDown.delay(640).duration(380)}
          style={[styles.coordCard, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}
          accessible
          accessibilityLabel={`Coordinates: ${Math.abs(country.lat).toFixed(2)} degrees ${country.lat >= 0 ? 'North' : 'South'}, ${Math.abs(country.lon).toFixed(2)} degrees ${country.lon >= 0 ? 'East' : 'West'}`}
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
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  errorBack: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  errorBackText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scrollContent: { paddingHorizontal: 20, gap: 0 },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingLeft: 10,
    paddingRight: 18,
    gap: 4,
    borderRadius: 22,
    borderWidth: 1,
  },
  backLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  flagWrap: {
    width: '100%',
    height: 210,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  flagFallback: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  flagFallbackText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  flagImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flagGlow: {
    position: 'absolute',
    bottom: -18,
    left: 24,
    right: 24,
    height: 36,
    borderRadius: 18,
  },
  nameWrap: { alignItems: 'center', gap: 8, marginBottom: 22, paddingHorizontal: 8 },
  codePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  codeText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  countryName: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  capitalSub: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  // No `opacity` here — Reanimated's fade-in owns that property on this view.
  divider: { height: StyleSheet.hairlineWidth, width: '100%', marginBottom: 22 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  infoCard: {
    width: '47.5%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    minHeight: 100,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 19,
  },
  currencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 10,
  },
  currencyIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  currencyInfo: { flex: 1 },
  currencyName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  currencyCode: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  coordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 9,
  },
  coordText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
