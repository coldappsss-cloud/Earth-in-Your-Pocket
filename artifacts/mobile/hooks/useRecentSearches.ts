import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Country, COUNTRIES_BY_CODE } from '@/constants/countries';

const KEY = 'eiyp_recent_searches_v1';
const LIMIT = 5;

/**
 * Persisted values can be corrupt or from an older schema, so recents are
 * re-resolved against the current country table rather than trusted as-is.
 */
function parseRecents(raw: string | null): Country[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Country[] = [];
  for (const entry of parsed) {
    const code = (entry as { code?: unknown })?.code;
    if (typeof code !== 'string') continue;
    const country = COUNTRIES_BY_CODE[code];
    if (country && !out.some(c => c.code === country.code)) out.push(country);
    if (out.length >= LIMIT) break;
  }
  return out;
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<Country[]>([]);
  // Once the user mutates the list, a late hydration must not clobber it.
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (cancelled || dirtyRef.current) return;
        const parsed = parseRecents(raw);
        if (parsed.length > 0) setRecents(parsed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const addRecent = useCallback((country: Country) => {
    dirtyRef.current = true;
    setRecents(prev => {
      const filtered = prev.filter(c => c.code !== country.code);
      const next = [country, ...filtered].slice(0, LIMIT);
      AsyncStorage.setItem(KEY, JSON.stringify(next.map(c => ({ code: c.code })))).catch(() => {});
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    dirtyRef.current = true;
    setRecents([]);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return { recents, addRecent, clearRecents };
}
