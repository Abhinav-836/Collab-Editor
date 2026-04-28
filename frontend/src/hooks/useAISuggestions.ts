import { useState, useCallback, useRef } from 'react';

interface UseAISuggestionsOptions {
  debounceMs?: number;
  enabled?: boolean;
}

// Use environment variable for API URL
const API_BASE = import.meta.env.VITE_API_URL || '';

export function useAISuggestions(options: UseAISuggestionsOptions = {}) {
  const { debounceMs = 500, enabled = true } = options;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (code: string, language: string) => {
    if (!enabled || !code) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  const debouncedFetch = useCallback((code: string, language: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(code, language);
    }, debounceMs);
  }, [fetchSuggestions, debounceMs]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    fetchSuggestions: debouncedFetch,
    clearSuggestions
  };
}