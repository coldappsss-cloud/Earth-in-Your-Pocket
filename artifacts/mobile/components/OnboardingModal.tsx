import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';

const ONBOARDING_KEY = 'eiyp_onboarding_v1';

const CARDS = [
  {
    emoji: '🌍',
    title: 'Rotate the Earth',
    description: 'Drag to spin the globe and explore every corner of the world.',
  },
  {
    emoji: '🔍',
    title: 'Search Countries',
    description: 'Find any country or capital instantly by typing in the search bar.',
  },
  {
    emoji: '📖',
    title: 'Learn',
    description: 'Tap any country to discover its flag, population, currency, and more.',
  },
];

interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const cardOpacity   = useSharedValue(1);
  const cardTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  function transitionTo(next: number | 'done') {
    cardOpacity.value    = withTiming(0, { duration: 180 });
    cardTranslateY.value = withTiming(-20, { duration: 180, easing: Easing.in(Easing.quad) });
    setTimeout(() => {
      if (next === 'done') { onComplete(); return; }
      setPage(next);
      cardTranslateY.value = 20;
      cardOpacity.value    = 0;
      cardOpacity.value    = withSpring(1, { damping: 18, stiffness: 140 });
      cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 140 });
    }, 190);
  }

  const handleNext = () => {
    if (page < CARDS.length - 1) transitionTo(page + 1);
    else transitionTo('done');
  };

  const handleSkip = () => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    setTimeout(onComplete, 260);
  };

  const card = CARDS[page];

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        {/* Card container */}
        <View style={styles.center}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border, width: width - 48 },
              cardStyle,
            ]}
          >
            {/* Skip button */}
            {page < CARDS.length - 1 && (
              <Pressable
                onPress={handleSkip}
                style={styles.skipBtn}
                accessibilityLabel="Skip onboarding"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
              </Pressable>
            )}

            {/* Emoji */}
            <Text style={styles.emoji} accessibilityElementsHidden>
              {card.emoji}
            </Text>

            {/* Title */}
            <Text
              style={[styles.title, { color: colors.foreground }]}
              accessibilityRole="header"
            >
              {card.title}
            </Text>

            {/* Description */}
            <Text style={[styles.description, { color: colors.foregroundSecondary }]}>
              {card.description}
            </Text>

            {/* Dot indicators */}
            <View style={styles.dots} accessibilityElementsHidden>
              {CARDS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === page ? colors.primary : colors.border,
                      width: i === page ? 20 : 6,
                    },
                  ]}
                />
              ))}
            </View>

            {/* CTA button */}
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={page < CARDS.length - 1 ? 'Next' : 'Get started'}
            >
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
                {page < CARDS.length - 1 ? 'Next' : 'Get Started'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// Hook — manages AsyncStorage check and completion
export function useOnboarding() {
  const [show, setShow]   = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (!val) setShow(true);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const complete = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'done').catch(() => {});
    setShow(false);
  };

  return { show: show && ready, complete };
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  skipBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 4,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  emoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  cta: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
