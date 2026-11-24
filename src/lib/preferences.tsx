import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AppLanguage, TRANSLATIONS_EN, TRANSLATIONS_HI, TranslationKey } from './i18n';

export type AppTheme = 'light' | 'dark';

export interface ChartThemePalette {
  gridStroke: string;
  axisTick: string;
  axisLabel: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  incoming: string;
  outgoing: string;
  gold: string;
  verified: string;
  warning: string;
  critical: string;
  neutral: string;
  protocolColors: string[];
}

interface PreferencesContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  chartTheme: ChartThemePalette;
}

const THEME_KEY = 'traceintel_theme';
const LANG_KEY = 'traceintel_lang';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Ignore storage access failures in restricted iframes
  }
  return 'light';
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch {
    // Ignore storage access failures
  }
  return 'en';
}

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(LANG_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = language === 'hi' ? TRANSLATIONS_HI : TRANSLATIONS_EN;
      let text: string = dict[key] ?? TRANSLATIONS_EN[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    [language]
  );

  const chartTheme = useMemo<ChartThemePalette>(() => {
    const isDark = theme === 'dark';
    return {
      gridStroke: isDark ? '#243656' : '#E2E7EF',
      axisTick: isDark ? '#9AA6BA' : '#64748B',
      axisLabel: isDark ? '#B5C0D0' : '#475569',
      tooltipBg: isDark ? '#17243B' : '#FFFFFF',
      tooltipBorder: isDark ? '#2E4368' : '#D5DCE8',
      tooltipText: isDark ? '#F4F5F7' : '#17243B',
      incoming: isDark ? '#3B82F6' : '#2563EB',
      outgoing: isDark ? '#14B8A6' : '#0D9488',
      gold: isDark ? '#C5A66A' : '#A88748',
      verified: isDark ? '#22C55E' : '#16A34A',
      warning: isDark ? '#F97316' : '#EA580C',
      critical: isDark ? '#EF4444' : '#DC2626',
      neutral: isDark ? '#8993A5' : '#64748B',
      protocolColors: isDark
        ? ['#3B82F6', '#14B8A6', '#C5A66A', '#F97316', '#22C55E']
        : ['#2563EB', '#0D9488', '#A88748', '#EA580C', '#16A34A'],
    };
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      language,
      setLanguage,
      t,
      chartTheme,
    }),
    [theme, setTheme, toggleTheme, language, setLanguage, t, chartTheme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}
