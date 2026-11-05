import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { readSystemTheme, readThemePreference, resolveTheme, THEME_STORAGE_KEY, parseThemePreference, type ThemePreference } from "./theme";
import { ThemeContext } from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setPreferenceState] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const resolvedTheme = resolveTheme(themePreference, systemTheme);

  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }

    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    updateSystemTheme(query);

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", updateSystemTheme);
      return () => query.removeEventListener("change", updateSystemTheme);
    }

    query.addListener(updateSystemTheme);
    return () => query.removeListener(updateSystemTheme);
  }, []);

  useEffect(() => {
    function syncPreference(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      setPreferenceState(parseThemePreference(event.newValue));
    }
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      "content",
      resolvedTheme === "light" ? "#F6F8FC" : "#090D16",
    );
  }, [resolvedTheme]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setPreferenceState(preference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Keep the in-memory setting when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ themePreference, resolvedTheme, setThemePreference }), [themePreference, resolvedTheme, setThemePreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
