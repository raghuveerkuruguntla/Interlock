"use client";

/**
 * Display and language settings.
 *
 * Language and large type are not a settings-page afterthought here — they are
 * part of the argument, so they live in the header where a judge can switch
 * them mid-demo. Choices persist per browser so a reload during a pitch does
 * not reset them.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { copyFor, type CopyPack, type Locale } from "@/lib/engine/copy";

type Theme = "system" | "light" | "dark";

interface Settings {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  largeType: boolean;
  setLargeType: (on: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  copy: CopyPack;
}

const SettingsContext = createContext<Settings | null>(null);

const KEY = "interlock.settings.v1";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [largeType, setLargeTypeState] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");

  // Read once on mount rather than during render, so the server and the first
  // client paint agree and React does not complain about a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{
        locale: Locale;
        largeType: boolean;
        theme: Theme;
      }>;
      if (saved.locale === "en" || saved.locale === "es") setLocaleState(saved.locale);
      if (typeof saved.largeType === "boolean") setLargeTypeState(saved.largeType);
      if (saved.theme === "light" || saved.theme === "dark" || saved.theme === "system") {
        setThemeState(saved.theme);
      }
    } catch {
      // A browser with storage blocked still gets a working app on defaults.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dataset.type = largeType ? "large" : "normal";
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ locale, largeType, theme }));
    } catch {
      // Ignored: persistence is a convenience, not a requirement.
    }
  }, [locale, largeType, theme]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const setLargeType = useCallback((next: boolean) => setLargeTypeState(next), []);
  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  const value = useMemo<Settings>(
    () => ({
      locale,
      setLocale,
      largeType,
      setLargeType,
      theme,
      setTheme,
      copy: copyFor(locale),
    }),
    [locale, setLocale, largeType, setLargeType, theme, setTheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
