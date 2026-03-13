"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { resolveTheme, type ResolvedTheme, type ThemeMode } from './themeState';

interface AppThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function getSystemPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = usePersistentState<ThemeMode>('ui.theme.mode', 'system');
  const [prefersDark, setPrefersDark] = useState<boolean>(true);

  useEffect(() => {
    setPrefersDark(getSystemPreference());

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(mode, prefersDark),
    [mode, prefersDark],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
    }),
    [mode, resolvedTheme, setMode],
  );

  return React.createElement(AppThemeContext.Provider, { value }, children);
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return context;
}
