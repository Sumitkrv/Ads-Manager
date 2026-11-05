import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { ThemePreferenceSelect, ThemeSwitcher } from "./ThemeSwitcher";
import { useTheme } from "./useTheme";
import { THEME_STORAGE_KEY } from "./theme";

function createMediaQuery(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as MediaQueryList;

  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => query) });
  return {
    query,
    listenerCount: () => listeners.size,
    setMatches(matches: boolean) {
      (query as { matches: boolean }).matches = matches;
      const event = { matches, media: query.media } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function ThemeState() {
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  return (
    <div>
      <output aria-label="Theme state">{themePreference}:{resolvedTheme}</output>
      <button onClick={() => setThemePreference("light")} type="button">Set light</button>
      <button onClick={() => setThemePreference("dark")} type="button">Set dark</button>
      <button onClick={() => setThemePreference("system")} type="button">Set system</button>
      <ThemeSwitcher />
      <ThemePreferenceSelect />
    </div>
  );
}

function renderTheme() {
  return render(<ThemeProvider><ThemeState /></ThemeProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
  document.head.innerHTML = '<meta name="theme-color" content="#090d16">';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("keeps the existing dark appearance as the default", () => {
    createMediaQuery(false);
    renderTheme();

    expect(screen.getByLabelText("Theme state").textContent).toBe("dark:dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#090D16");
  });

  it.each(["light", "dark"] as const)("applies and persists the %s preference", async (preference) => {
    createMediaQuery(false);
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole("button", { name: preference === "light" ? "Set light" : "Set dark" }));

    expect(document.documentElement.dataset.theme).toBe(preference);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(preference);
    expect(screen.getByLabelText("Theme state").textContent).toBe(`${preference}:${preference}`);
  });

  it("resolves system preference and updates when the operating system changes", async () => {
    const media = createMediaQuery(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    renderTheme();

    expect(screen.getByLabelText("Theme state").textContent).toBe("system:light");
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => media.setMatches(true));
    expect(screen.getByLabelText("Theme state").textContent).toBe("system:dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("lets a manual choice override later system changes", async () => {
    const media = createMediaQuery(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole("button", { name: "Set light" }));
    act(() => media.setMatches(true));

    expect(screen.getByLabelText("Theme state").textContent).toBe("light:light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("restores a saved preference on a later mount", () => {
    createMediaQuery(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const first = renderTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    first.unmount();

    renderTheme();
    expect(screen.getByLabelText("Theme state").textContent).toBe("light:light");
  });

  it("falls back to dark for an invalid stored value", () => {
    createMediaQuery(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderTheme();

    expect(screen.getByLabelText("Theme state").textContent).toBe("dark:dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("continues working when local storage is unavailable", async () => {
    createMediaQuery(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    const user = userEvent.setup();
    renderTheme();

    expect(screen.getByLabelText("Theme state").textContent).toBe("dark:dark");
    await user.click(screen.getByRole("button", { name: "Set light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("cleans up its operating-system appearance listener", () => {
    const media = createMediaQuery(true);
    const view = renderTheme();
    expect(media.listenerCount()).toBe(1);
    view.unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it("syncs the settings selector and the accessible switcher", async () => {
    createMediaQuery(false);
    const user = userEvent.setup();
    renderTheme();

    await user.selectOptions(screen.getByLabelText("Theme preference"), "light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Appearance: Light" })).toBeTruthy();
  });

  it("supports keyboard selection, selected state, and Escape focus return", async () => {
    createMediaQuery(false);
    const user = userEvent.setup();
    renderTheme();
    const trigger = screen.getByRole("button", { name: "Appearance: Dark" });

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByLabelText("Theme state").textContent).toBe("system:light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(screen.getByRole("button", { name: "Appearance: System" }).getAttribute("aria-expanded")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Appearance: System" }));
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Appearance: System" }));
  });

  it("closes when the user clicks outside the menu", async () => {
    createMediaQuery(false);
    const user = userEvent.setup();
    renderTheme();
    await user.click(screen.getByRole("button", { name: "Appearance: Dark" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("uses unique menu ids for multiple header switchers", () => {
    createMediaQuery(false);
    render(<ThemeProvider><><ThemeSwitcher /><ThemeSwitcher /></></ThemeProvider>);
    const triggers = screen.getAllByRole("button", { name: "Appearance: Dark" });
    expect(triggers.map((trigger) => trigger.getAttribute("aria-controls")).every(Boolean)).toBe(true);
    expect(new Set(triggers.map((trigger) => trigger.getAttribute("aria-controls"))).size).toBe(2);
  });
});

