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
  SlideInDown,
  SlideOutUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Country, searchCountries } from '@/constants/countries';

interface SearchBarProps {
  onSelectCountry: (country: Country) => void;
  onFocusChange?: (focused: boolean) => void;
}

export function SearchBar({ onSelectCountry, onFocusChange }: SearchBarProps) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Country[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
    setResults(searchCountries(text));
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onFocusChange?.(false);
  };

  const handleSelect = (country: Country) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setIsFocused(false);
    onFocusChange?.(false);
    onSelectCountry(country);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {/* Search input */}
      <Animated.View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.card,
            borderColor: isFocused ? colors.primary : colors.border,
            borderWidth: isFocused ? 1.5 : 1,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={isFocused ? colors.primary : colors.mutedForeground}
          style={styles.searchIcon}
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
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Results dropdown */}
      {results.length > 0 && isFocused && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.dropdown,
            { backgroundColor: colors.cardElevated, borderColor: colors.border },
          ]}
        >
          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={results.length > 5}
            style={styles.flatList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [
                  styles.resultItem,
                  { borderBottomColor: colors.border },
                  pressed && { backgroundColor: colors.card },
                ]}
              >
                <Text style={styles.flag}>
                  {getFlagEmoji(item.code)}
                </Text>
                <View style={styles.resultText}>
                  <Text style={[styles.countryName, { color: colors.foreground }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.capitalName, { color: colors.mutedForeground }]}>
                    {item.capital} · {item.continent}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
              </Pressable>
            )}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** Convert ISO 3166-1 alpha-2 to emoji flag */
function getFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  const codePoints = [...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },
  searchIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 320,
  },
  flatList: {
    flexGrow: 0,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  flag: {
    fontSize: 22,
  },
  resultText: {
    flex: 1,
  },
  countryName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  capitalName: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
});
