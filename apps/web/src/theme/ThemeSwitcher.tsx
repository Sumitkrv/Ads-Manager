import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTheme } from "./useTheme";
import { THEME_PREFERENCES, type ThemePreference } from "./theme";
import { useOptionalAuth } from "../auth/AuthProvider";
import { updateUserPreferences } from "../api/settings";

const labels: Record<ThemePreference, string> = { light: "Light", dark: "Dark", system: "System" };

function ThemeIcon({ mode, className = "size-4" }: { mode: ThemePreference; className?: string }) {
  if (mode === "light") {
    return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.5" /><path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" /></svg>;
  }
  if (mode === "dark") {
    return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20"><path d="M16.4 12.7A7 7 0 0 1 7.3 3.6 7.1 7.1 0 1 0 16.4 12.7Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>;
  }
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20"><rect x="2.3" y="3.3" width="15.4" height="10.3" rx="1.7" stroke="currentColor" strokeWidth="1.5" /><path d="M7.2 16.7h5.6M10 13.9v2.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" /></svg>;
}

export function ThemeSwitcher() {
  const { themePreference, setThemePreference } = useTheme();
  const auth = useOptionalAuth();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[THEME_PREFERENCES.indexOf(themePreference)]?.focus();
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open, themePreference]);

  function selectPreference(preference: ThemePreference) {
    setThemePreference(preference);
    setSaveMessage("");
    if (auth?.session?.access_token) {
      void updateUserPreferences(auth.session.access_token, { themePreference: preference }).then(() => setSaveMessage("Appearance preference saved.")).catch(() => setSaveMessage("Theme changed on this device, but the account preference could not be saved."));
    }
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const currentIndex = THEME_PREFERENCES.indexOf(themePreference);
    const nextIndex = event.key === "ArrowDown"
      ? (currentIndex + 1) % THEME_PREFERENCES.length
      : event.key === "ArrowUp"
        ? (currentIndex + THEME_PREFERENCES.length - 1) % THEME_PREFERENCES.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? THEME_PREFERENCES.length - 1
            : -1;
    if (nextIndex >= 0) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Appearance: ${labels[themePreference]}`}
        className="theme-icon-button"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={`Appearance: ${labels[themePreference]}`}
        type="button"
      >
        <ThemeIcon mode={themePreference} />
      </button>
      {open && (
        <div aria-label="Appearance preference" className="theme-menu" id={menuId} onKeyDown={handleMenuKeyDown} role="menu">
          <p className="theme-menu-heading">Appearance</p>
          {THEME_PREFERENCES.map((preference, index) => (
            <button
              aria-checked={themePreference === preference}
              className="theme-menu-option"
              key={preference}
              onClick={() => selectPreference(preference)}
              ref={(element) => { optionRefs.current[index] = element; }}
              role="menuitemradio"
              type="button"
            >
              <ThemeIcon mode={preference} />
              <span>{labels[preference]}</span>
              {themePreference === preference && <svg aria-hidden="true" className="ml-auto size-4 text-primary" fill="none" viewBox="0 0 20 20"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>}
            </button>
          ))}
        </div>
      )}
      <span className="sr-only" role="status">{saveMessage}</span>
    </div>
  );
}

export function ThemePreferenceSelect() {
  const { themePreference, setThemePreference } = useTheme();
  const auth = useOptionalAuth();
  const [saveMessage, setSaveMessage] = useState("");
  function changePreference(preference: ThemePreference) {
    setThemePreference(preference);
    if (auth?.session?.access_token) void updateUserPreferences(auth.session.access_token, { themePreference: preference }).then(() => setSaveMessage("Appearance preference saved.")).catch(() => setSaveMessage("Theme changed on this device, but the account preference could not be saved."));
  }
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-foreground">Theme preference</span>
      <select
        aria-label="Theme preference"
        className="theme-select w-full rounded-xl border px-3.5 py-3 text-sm"
        id="theme-preference"
        onChange={(event) => changePreference(event.currentTarget.value as ThemePreference)}
        value={themePreference}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      <span className="mt-2 block text-xs leading-5 text-muted-foreground">System follows your device appearance. This preference stays on this browser and does not change when you switch workspaces.</span>
      <span className="sr-only" role="status">{saveMessage}</span>
    </label>
  );
}
