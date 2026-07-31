import React, { useEffect, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobeView } from '@/components/GlobeView';
import { useColors } from '@/hooks/useColors';

// ─── Shooting Star ─────────────────────────────────────────────────────────
interface StarProps {
  delay: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  interval: number;
}

function ShootingStar({ delay, startX, startY, dx, dy, interval }: StarProps) {
  const x       = useSharedValue(startX);
  const y       = useSharedValue(startY);
  const opacity = useSharedValue(0);

  useEffect(() => {
    function fire() {
      x.value = startX;
      y.value = startY;
      opacity.value = 0;
      const dur = 650;
      opacity.value = withSequence(
        withTiming(0.92, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(0,    { duration: dur - 180, easing: Easing.in(Easing.quad) }),
      );
      x.value = withTiming(startX + dx, { duration: dur, easing: Easing.out(Easing.quad) });
      y.value = withTiming(startY + dy, { duration: dur, easing: Easing.out(Easing.quad) });
    }
    const t = setTimeout(fire, delay);
    const iv = setInterval(fire, interval);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value,
    top:  y.value,
    width: 55,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    opacity: opacity.value,
    shadowColor: '#ffffff',
    shadowRadius: 3,
    shadowOpacity: 0.8,
    transform: [{ rotate: '32deg' }],
    pointerEvents: 'none' as const,
  }));

  return <Animated.View style={style} />;
}

// ─── Splash Screen ─────────────────────────────────────────────────────────
export default function SplashScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const titleOpacity    = useSharedValue(0);
  const titleTranslateY = useSharedValue(36);
  const subtitleOpacity = useSharedValue(0);
  const dot1Opacity     = useSharedValue(0);
  const dot2Opacity     = useSharedValue(0);
  const dot3Opacity     = useSharedValue(0);
  const globeOpacity    = useSharedValue(0);
  const glowScale       = useSharedValue(0.8);

  const navigated = useRef(false);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // Globe fades in slower for a cinematic feel
    globeOpacity.value = withTiming(1, { duration: 1800, easing: ease });
    glowScale.value    = withTiming(1, { duration: 2200, easing: ease });

    // Title
    titleOpacity.value    = withDelay(900,  withTiming(1, { duration: 1000, easing: ease }));
    titleTranslateY.value = withDelay(900,  withTiming(0, { duration: 1000, easing: ease }));

    // Subtitle
    subtitleOpacity.value = withDelay(1500, withTiming(1, { duration: 900, easing: ease }));

    // Dots staggered
    dot1Opacity.value = withDelay(1800, withTiming(1, { duration: 600, easing: ease }));
    dot2Opacity.value = withDelay(2000, withTiming(1, { duration: 600, easing: ease }));
    dot3Opacity.value = withDelay(2200, withTiming(1, { duration: 600, easing: ease }));

    // Navigate to home after 5s (slightly longer for cinema feel)
    const timer = setTimeout(() => {
      if (!navigated.current) {
        navigated.current = true;
        router.replace('/home');
      }
    }, 5200);
    return () => clearTimeout(timer);
  }, []);

  const globeStyle    = useAnimatedStyle(() => ({ opacity: globeOpacity.value }));
  const titleStyle    = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const dot1Style     = useAnimatedStyle(() => ({ opacity: dot1Opacity.value }));
  const dot2Style     = useAnimatedStyle(() => ({ opacity: dot2Opacity.value }));
  const dot3Style     = useAnimatedStyle(() => ({ opacity: dot3Opacity.value }));

  const topInset    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  // Shooting star configs — relative to screen dimensions
  const stars: StarProps[] = [
    { delay: 1200,  startX: width*0.15, startY: height*0.10, dx: 110, dy: 88,  interval: 5200 },
    { delay: 2600,  startX: width*0.65, startY: height*0.08, dx: 90,  dy: 75,  interval: 6800 },
    { delay: 4000,  startX: width*0.38, startY: height*0.18, dx: 105, dy: 80,  interval: 7400 },
    { delay: 3200,  startX: width*0.80, startY: height*0.13, dx: 80,  dy: 68,  interval: 5900 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Globe */}
      <Animated.View style={[StyleSheet.absoluteFill, globeStyle]}>
        <GlobeView autoRotate interactive={false} />
      </Animated.View>

      {/* Bottom gradient for text legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(5,10,20,0.7)', 'rgba(5,10,20,0.95)']}
        locations={[0.35, 0.7, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />

      {/* Shooting stars */}
      {Platform.OS !== 'web' && stars.map((s, i) => (
        <ShootingStar key={i} {...s} />
      ))}

      {/* Text content */}
      <View
        style={[
          styles.content,
          { paddingTop: topInset + 20, paddingBottom: bottomInset + 50, pointerEvents: 'none' },
        ]}
      >
        <View style={{ flex: 1 }} />

        {/* Decorative dots */}
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot1Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.primaryLight }, dot2Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot3Style]} />
        </View>

        {/* Title */}
        <Animated.Text
          style={[styles.title, { color: colors.foreground }, titleStyle]}
          accessibilityRole="header"
        >
          {'Earth in Your\nPocket'}
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { color: colors.foregroundSecondary }, subtitleStyle]}>
          Explore every nation on our pale blue dot
        </Animated.Text>

        <View style={{ height: 48 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 54,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
});
