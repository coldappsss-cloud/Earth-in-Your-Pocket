import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { Country, searchCountries } from '@/constants/countries';

interface SearchBarProps {
  onSelectCountry: (country: Country) => void;
  onFocusChange?: (focused: boolean) => void;
}

/** Highlight matching letters in a string */
function HighlightedText({
  text,
  query,
  textStyle,
  highlightColor,
}: {
  text: string;
  query: string;
  textStyle: object;
  highlightColor: string;
}) {
  if (!query) return <Text style={textStyle}>{text}</Text>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <Text style={textStyle}>{text}</Text>;
  return (
    <Text style={textStyle}>
      {text.slice(0, idx)}
      <Text style={[textStyle, { color: highlightColor, fontFamily: 'Inter_700Bold' }]}>
        {text.slice(idx, idx + query.length)}
      </Text>
      {text.slice(idx + query.length)}
    </Text>
  );
}

/** Convert ISO 3166-1 alpha-2 to emoji flag */
function getFlagEmoji(code: string): string {
  const pts = [...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...pts);
}

export function SearchBar({ onSelectCountry, onFocusChange }: SearchBarProps) {
  const colors = useColors();
  const { recents, addRecent, clearRecents } = useRecentSearches();

  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<Country[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Scale animation for the container on focus
  const scaleV = useSharedValue(1);
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleV.value }],
  }));

  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
    setResults(searchCountries(text));
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    scaleV.value = withSpring(1.01, { damping: 14, stiffness: 180 });
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    scaleV.value = withSpring(1, { damping: 14, stiffness: 180 });
    onFocusChange?.(false);
  };

  const handleSelect = (country: Country) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setIsFocused(false);
    scaleV.value = withSpring(1);
    onFocusChange?.(false);
    addRecent(country);
    onSelectCountry(country);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  // Show recents when focused + empty query, show results when typing
  const showRecents = isFocused && !query && recents.length > 0;
  const showResults = results.length > 0 && isFocused;
  // Typing something with no matches must say so rather than silently collapse.
  const showEmpty = isFocused && query.trim().length > 0 && results.length === 0;
  const showDropdown = showRecents || showResults || showEmpty;

  const listData: Country[] = showResults ? results : (showRecents ? recents : []);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Glass input row */}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: isFocused ? colors.primary : colors.border,
            borderWidth: isFocused ? 1.5 : 1,
          },
        ]}
      >
        {Platform.OS !== 'web' ? (
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
          />
        )}
        <View style={styles.inputRow}>
          <Ionicons
            name="search"
            size={18}
            color={isFocused ? colors.primary : colors.mutedForeground}
          />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            value={query}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search countries or capitals…"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search countries"
            accessibilityHint="Type a country name or capital city"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : isFocused && recents.length > 0 ? (
            <TouchableOpacity
              onPress={clearRecents}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear recent searches"
            >
              <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Results / Recent dropdown */}
      {showDropdown && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.dropdown,
            { backgroundColor: colors.cardElevated, borderColor: colors.border },
          ]}
        >
          {showRecents && (
            <View style={[styles.dropdownHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.dropdownHeaderText, { color: colors.mutedForeground }]}>
                Recent searches
              </Text>
            </View>
          )}
          {showEmpty && (
            <View style={styles.emptyState} accessibilityLiveRegion="polite">
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No countries match “{query.trim()}”
              </Text>
            </View>
          )}
          <FlatList
            data={listData}
            keyExtractor={item => item.code}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={listData.length > 5}
            style={styles.flatList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [
                  styles.resultItem,
                  { borderBottomColor: colors.border },
                  pressed && { backgroundColor: colors.card },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  item.capital
                    ? `${item.name}, capital ${item.capital}`
                    : `${item.name}, ${item.continent}`
                }
              >
                <Text style={styles.flag}>{getFlagEmoji(item.code)}</Text>
                <View style={styles.resultText}>
                  <HighlightedText
                    text={item.name}
                    query={query}
                    textStyle={[styles.countryName, { color: colors.foreground }]}
                    highlightColor={colors.primary}
                  />
                  <HighlightedText
                    text={item.capital ? `${item.capital} · ${item.continent}` : item.continent}
                    query={query}
                    textStyle={[styles.capitalName, { color: colors.mutedForeground }]}
                    highlightColor={colors.primaryLight}
                  />
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
              </Pressable>
            )}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    gap: 9,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  flatList: {
    flexGrow: 0,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    minHeight: 56,
  },
  flag: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  countryName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  capitalName: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
