import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Country } from '@/constants/countries';

const KEY   = 'eiyp_recent_searches_v1';
const LIMIT = 5;

export function useRecentSearches() {
  const [recents, setRecents] = useState<Country[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (raw) setRecents(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const addRecent = useCallback((country: Country) => {
    setRecents(prev => {
      const filtered = prev.filter(c => c.code !== country.code);
      const next = [country, ...filtered].slice(0, LIMIT);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return { recents, addRecent, clearRecents };
}
