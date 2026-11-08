"use client";

/**
 * Display settings persisted per browser using an external store. This is a tiny external store read through `useSyncExternalStore` rather than
 * state hydrated inside an effect. Reading `localStorage` during render would
 * desync the server and client markup; reading it in an effect and calling
 * `setState` would cascade an extra render on every mount. The store hydrates
 * once, on first subscribe, and React re-reads the snapshot straight after —
 * so the saved preference lands without a second render pass.
 */

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { copyFor, type CopyPack, type Locale } from "@/lib/engine/copy";

type Theme = "system" | "light" | "dark";

interface StoreState {
  locale: Locale;
  theme: Theme;
}

const DEFAULTS: StoreState = { locale: "en", theme: "system" };
const KEY = "interlock.settings.v1";

let current: StoreState = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): StoreState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<StoreState>;
    return {
      locale: "en",
      theme:
        saved.theme === "light" || saved.theme === "dark" || saved.theme === "system"
          ? saved.theme
          : "system",
    };
  } catch {
    // A browser with storage blocked still gets a working app on defaults.
    return DEFAULTS;
  }
}

function sameState(a: StoreState, b: StoreState): boolean {
  return a.locale === b.locale && a.theme === b.theme;
}

function applyToDocument(state: StoreState): void {
  const root = document.documentElement;
  root.lang = state.locale;
  delete root.dataset.type;
  if (state.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = state.theme;
}

function subscribe(listener: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    const saved = readStorage();
    if (!sameState(saved, current)) current = saved;
    applyToDocument(current);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(patch: Partial<StoreState>): void {
  const next = { ...current, ...patch };
  if (sameState(next, current)) return;
  current = next;
  applyToDocument(current);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Persistence is a convenience, not a requirement.
  }
  for (const listener of listeners) listener();
}

interface Settings extends StoreState {
  setTheme: (theme: Theme) => void;
  copy: CopyPack;
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULTS,
  );

  const setTheme = useCallback((theme: Theme) => update({ theme }), []);

  const value = useMemo<Settings>(
    () => ({
      ...state,
      setTheme,
      copy: copyFor("en"),
    }),
    [state, setTheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
