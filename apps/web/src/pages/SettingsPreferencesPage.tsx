import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DEFAULT_USER_PREFERENCES, UserPreferencesSchema, type UserPreferences } from "@ai-ads/shared";
import { SettingsApiError, getUserPreferences, updateUserPreferences } from "../api/settings";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../theme/useTheme";

const panel = "rounded-2xl border border-stroke bg-panel p-5 sm:p-6";
const field = "mt-2 min-h-11 w-full rounded-xl border border-stroke bg-input px-3.5 py-2.5 text-sm text-foreground focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15";
const saveButton = "inline-flex min-h-10 items-center justify-center rounded-lg border border-electric/35 bg-electric/15 px-4 py-2 text-xs font-semibold text-electric-bright hover:bg-electric/25 disabled:cursor-not-allowed disabled:opacity-50";
const notifications = [
  ["campaign_reviews", "Campaign reviews", "Review requests, approval and rejection activity.", true],
  ["creative_reviews", "Creative reviews", "Creative review and feedback events are not yet produced by the in-app feed.", false],
  ["automation_activity", "Automation activity", "Rule runs, failures and optimization recommendations.", true],
  ["usage_limit_alerts", "Usage limits", "Workspace usage and plan limit notices.", true],
  ["subscription_events", "Subscription events", "Billing state events are not yet produced by the in-app feed.", false],
  ["agency_collaboration", "Agency collaboration", "Relationship, assignment and collaboration updates.", true],
  ["client_approvals", "Client approvals", "Client tasks and review activity.", true],
  ["team_invitations", "Team invitations", "Invitation events are not yet produced by the in-app feed.", false],
  ["support_cases", "Support activity", "Support case events are not yet produced by the in-app feed.", false],
] as const;

function preferencesTitle(notificationsOnly: boolean) {
  return notificationsOnly
    ? { eyebrow: "PERSONAL NOTIFICATIONS", title: "Notification preferences", description: "Choose which eligible in-app activity appears in your workspace notification feed. Security notices remain enabled." }
    : { eyebrow: "PERSONAL PREFERENCES", title: "Your working preferences", description: "These settings follow your account when you switch workspaces. Workspace identity and team defaults are managed separately." };
}

export function SettingsPreferencesPage({ notificationsOnly = false }: { notificationsOnly?: boolean }) {
  const { session } = useAuth();
  const { setThemePreference } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [original, setOriginal] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const requestSequence = useRef(0);
  const token = session?.access_token;
  const dirty = useMemo(() => JSON.stringify(preferences) !== JSON.stringify(original), [original, preferences]);
  const title = preferencesTitle(notificationsOnly);

  useEffect(() => {
    if (!token) return;
    const sequence = ++requestSequence.current;
    setStatus("loading"); setError("");
    void getUserPreferences(token).then((value) => {
      if (requestSequence.current !== sequence) return;
      setPreferences(value); setOriginal(value); setStatus("ready"); setThemePreference(value.themePreference);
    }).catch((cause: unknown) => {
      if (requestSequence.current !== sequence) return;
      setStatus("error"); setError(cause instanceof SettingsApiError ? cause.message : "Your personal preferences could not be loaded.");
    });
    return () => { requestSequence.current += 1; };
  }, [retryKey, setThemePreference, token]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search + url.hash === window.location.pathname + window.location.search + window.location.hash) return;
      if (!window.confirm("You have unsaved personal preference changes. Leave this page and discard them?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardLink, true); };
  }, [dirty]);

  function patch<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setError(""); setSuccess(""); setFieldError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !dirty || saving) return;
    setError(""); setSuccess(""); setFieldError("");
    try { new Intl.DateTimeFormat(undefined, { timeZone: preferences.timezone }); }
    catch { setFieldError("Enter a time zone recognized by this browser, such as Asia/Kolkata or Europe/London."); return; }
    const valid = UserPreferencesSchema.safeParse(preferences);
    if (!valid.success) { setFieldError("Review the preference values and try again."); return; }
    setSaving(true);
    try {
      const result = await updateUserPreferences(token, valid.data);
      setPreferences(result); setOriginal(result); setThemePreference(result.themePreference); setSuccess("Personal preferences saved.");
    } catch (cause) {
      setError(cause instanceof SettingsApiError ? cause.message : "Your personal preferences could not be saved. Try again.");
    } finally { setSaving(false); }
  }

  function setNotification(key: keyof UserPreferences["notifications"], checked: boolean) {
    patch("notifications", { ...preferences.notifications, [key]: checked });
  }

  if (status === "loading") return <p className="rounded-xl border border-stroke bg-panel px-4 py-10 text-center text-xs text-slate-500" role="status">Loading your personal settings…</p>;
  if (status === "error") return <div className="rounded-xl border border-rose-400/20 bg-panel p-5 text-xs text-rose-200" role="alert">{error}<button className="ml-3 underline" onClick={() => setRetryKey((value) => value + 1)} type="button">Retry</button></div>;

  let preview = "Enter a valid IANA time zone to see the preview.";
  try {
    const locale = preferences.dateFormat === "mdy" ? "en-US" : preferences.dateFormat === "dmy" ? "en-GB" : preferences.dateFormat === "iso" ? "en-CA" : undefined;
    preview = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", hourCycle: preferences.timeFormat === "12h" ? "h12" : "h23", timeZone: preferences.timezone }).format(new Date());
  } catch { /* invalid time zones remain editable and produce validation on save */ }

  return <form className="space-y-5" onSubmit={(event) => void save(event)}>
    <header className="border-b border-stroke pb-5"><p className="text-[10px] font-semibold tracking-[.19em] text-electric-bright">{title.eyebrow}</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.03em] text-foreground">{title.title}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{title.description}</p></header>
    {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[.06] px-4 py-3 text-xs text-rose-200" role="alert">{error}</p>}
    {success && <p className="rounded-xl border border-electric/25 bg-electric/[.06] px-4 py-3 text-xs text-electric-bright" role="status">{success}</p>}
    {fieldError && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[.06] px-4 py-3 text-xs text-rose-200" role="alert">{fieldError}</p>}
    {!notificationsOnly ? <>
      <section className={panel} aria-labelledby="display-heading"><div className="max-w-2xl"><p className="text-[9px] font-semibold tracking-[.16em] text-slate-500">DISPLAY</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="display-heading">Appearance</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">Your theme preference applies across Tandem Ads and is stored with your account.</p><label className="mt-4 block text-[10px] font-medium text-slate-300" htmlFor="settings-theme">Theme<select className={field} id="settings-theme" onChange={(event) => patch("themePreference", event.target.value as UserPreferences["themePreference"])} value={preferences.themePreference}><option value="system">System · follow this device</option><option value="light">Light · cool white and slate</option><option value="dark">Dark · midnight graphite</option></select></label></div></section>
      <section className={panel} aria-labelledby="regional-heading"><div><p className="text-[9px] font-semibold tracking-[.16em] text-slate-500">REGIONAL FORMATTING</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="regional-heading">Dates, time and numbers</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">Timestamps remain stored in UTC. These choices only change how values appear; currency changes do not convert campaign budgets or billing records.</p></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-medium text-slate-300" htmlFor="settings-language">Interface language<select className={field} disabled id="settings-language" value={preferences.preferredLanguage}><option value="en">English</option></select><span className="mt-1.5 block text-[9px] font-normal text-slate-600">English is the only fully supported interface language today.</span></label>
          <label className="text-[10px] font-medium text-slate-300" htmlFor="settings-timezone">Time zone<input autoComplete="off" className={field} id="settings-timezone" maxLength={100} onChange={(event) => patch("timezone", event.target.value)} placeholder="Asia/Kolkata" value={preferences.timezone}/><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Preview: {preview}</span></label>
          <label className="text-[10px] font-medium text-slate-300" htmlFor="settings-date-format">Date format<select className={field} id="settings-date-format" onChange={(event) => patch("dateFormat", event.target.value as UserPreferences["dateFormat"])} value={preferences.dateFormat}><option value="local">Browser locale</option><option value="iso">ISO order · YYYY-MM-DD</option><option value="mdy">Month / day / year</option><option value="dmy">Day / month / year</option></select></label>
          <label className="text-[10px] font-medium text-slate-300" htmlFor="settings-time-format">Time format<select className={field} id="settings-time-format" onChange={(event) => patch("timeFormat", event.target.value as UserPreferences["timeFormat"])} value={preferences.timeFormat}><option value="12h">12 hour</option><option value="24h">24 hour</option></select></label>
          <label className="text-[10px] font-medium text-slate-300 sm:col-span-2" htmlFor="settings-currency">Currency display preference<input autoCapitalize="characters" className={`${field} max-w-xs`} id="settings-currency" maxLength={3} onChange={(event) => patch("displayCurrency", event.target.value.toUpperCase())} placeholder="USD" value={preferences.displayCurrency}/><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Enter a three-letter currency code. No exchange rate or conversion is applied.</span></label>
        </div>
      </section>
    </> : null}
    {!notificationsOnly ? null : <div className="rounded-2xl border border-electric/20 bg-electric/[.05] px-4 py-3 text-[10px] leading-5 text-slate-400">These controls filter eligible in-app events only. Email and messaging delivery are not configured. Security audit history stays available on the Security page and is not controlled here.</div>}
    {!notificationsOnly ? null : <section className={`${panel} divide-y divide-stroke/70`} aria-label="In-app notification categories">{notifications.map(([key, name, description, available]) => <label className={`flex items-start justify-between gap-5 py-4 first:pt-0 last:pb-0 ${available ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`} key={key}><span><span className="block text-xs font-medium text-slate-200">{name}</span><span className="mt-1 block max-w-xl text-[10px] leading-4 text-slate-500">{description}</span></span><input aria-label={name} checked={preferences.notifications[key]} className="mt-0.5 size-4 accent-sky-400" disabled={!available} onChange={(event) => setNotification(key, event.target.checked)} type="checkbox"/></label>)}</section>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-slate-600">{dirty ? "Unsaved changes" : "All changes saved"}</p><button className={saveButton} disabled={!dirty || saving} type="submit">{saving ? "Saving preferences…" : "Save preferences"}</button></div>
  </form>;
}
