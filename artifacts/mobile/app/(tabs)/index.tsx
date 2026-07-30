import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobeView } from '@/components/GlobeView';
import { useColors } from '@/hooks/useColors';

export default function SplashScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Animation values
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const subtitleOpacity = useSharedValue(0);
  const dotOpacity1 = useSharedValue(0);
  const dotOpacity2 = useSharedValue(0);
  const dotOpacity3 = useSharedValue(0);
  const globeOpacity = useSharedValue(0);

  const navigated = useRef(false);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);

    // Fade in globe
    globeOpacity.value = withTiming(1, { duration: 1200, easing });

    // Title animations
    titleOpacity.value = withDelay(600, withTiming(1, { duration: 900, easing }));
    titleTranslateY.value = withDelay(600, withTiming(0, { duration: 900, easing }));

    // Subtitle
    subtitleOpacity.value = withDelay(1100, withTiming(1, { duration: 800, easing }));

    // Decorative dots
    dotOpacity1.value = withDelay(1400, withTiming(1, { duration: 600, easing }));
    dotOpacity2.value = withDelay(1600, withTiming(1, { duration: 600, easing }));
    dotOpacity3.value = withDelay(1800, withTiming(1, { duration: 600, easing }));

    // Navigate to home after 4.5s
    const timer = setTimeout(() => {
      if (!navigated.current) {
        navigated.current = true;
        router.replace('/home');
      }
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const globeStyle = useAnimatedStyle(() => ({ opacity: globeOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: dotOpacity1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dotOpacity2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dotOpacity3.value }));

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Globe */}
      <Animated.View style={[styles.globeWrap, globeStyle]}>
        <GlobeView autoRotate interactive={false} />
      </Animated.View>

      {/* Dark gradient overlay */}
      <View style={styles.overlay} pointerEvents="none" />

      {/* Text content */}
      <View
        style={[
          styles.content,
          { paddingTop: topInset + 20, paddingBottom: bottomInset + 40 },
        ]}
        pointerEvents="none"
      >
        {/* Top spacer */}
        <View style={{ flex: 1 }} />

        {/* Title */}
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          {/* Decorative dots */}
          <View style={styles.dots}>
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot1Style]} />
            <Animated.View style={[styles.dot, { backgroundColor: colors.primaryLight }, dot2Style]} />
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot3Style]} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Earth in Your{'\n'}Pocket
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.subtitle, { color: colors.mutedForeground }, subtitleStyle]}>
          Explore every nation on our pale blue dot
        </Animated.Text>

        <View style={{ height: 60 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  globeWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Vertical gradient effect using layered views
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 42,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 52,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
