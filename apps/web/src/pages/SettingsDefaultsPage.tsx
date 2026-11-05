import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DEFAULT_WORKSPACE_PREFERENCES, WorkspacePreferencesSchema, type WorkspacePreferences } from "@ai-ads/shared";
import { SettingsApiError, getWorkspacePreferences, updateWorkspacePreferences } from "../api/settings";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceContext";

const panel = "rounded-2xl border border-stroke bg-panel p-5 sm:p-6";
const field = "mt-2 min-h-11 w-full rounded-xl border border-stroke bg-input px-3.5 py-2.5 text-sm text-foreground focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15 disabled:cursor-not-allowed disabled:opacity-60";
const saveButton = "inline-flex min-h-10 items-center justify-center rounded-lg border border-electric/35 bg-electric/15 px-4 py-2 text-xs font-semibold text-electric-bright hover:bg-electric/25 disabled:cursor-not-allowed disabled:opacity-50";

export function SettingsDefaultsPage() {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [preferences, setPreferences] = useState<WorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [original, setOriginal] = useState<WorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const requestSequence = useRef(0);
  const workspaceId = activeWorkspace?.id;
  const token = session?.access_token;
  const role = activeWorkspace?.role ?? "viewer";
  const canEdit = role === "owner" || role === "admin";
  const dirty = useMemo(() => JSON.stringify(preferences) !== JSON.stringify(original), [original, preferences]);

  useEffect(() => {
    if (!workspaceId || !token) return;
    const sequence = ++requestSequence.current;
    setStatus("loading"); setError(""); setSuccess("");
    void getWorkspacePreferences(token, workspaceId).then((value) => {
      if (requestSequence.current !== sequence) return;
      setPreferences(value); setOriginal(value); setStatus("ready");
    }).catch((cause: unknown) => {
      if (requestSequence.current !== sequence) return;
      setStatus("error"); setError(cause instanceof SettingsApiError ? cause.message : "Workspace defaults could not be loaded.");
    });
    return () => { requestSequence.current += 1; };
  }, [token, workspaceId]);

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
      if (!window.confirm("You have unsaved workspace default changes. Leave this page and discard them?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardLink, true); };
  }, [dirty]);

  function patch<K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value })); setError(""); setSuccess("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId || !canEdit || !dirty || saving) return;
    const parsed = WorkspacePreferencesSchema.safeParse(preferences);
    if (!parsed.success) { setError("Review the workspace defaults and try again."); return; }
    setError(""); setSuccess(""); setSaving(true);
    try {
      const result = await updateWorkspacePreferences(token, workspaceId, parsed.data);
      setPreferences(result); setOriginal(result); setSuccess("Workspace defaults saved.");
    } catch (cause) { setError(cause instanceof SettingsApiError ? cause.message : "Workspace defaults could not be saved."); }
    finally { setSaving(false); }
  }

  if (status === "loading") return <p className="rounded-xl border border-stroke bg-panel px-4 py-10 text-center text-xs text-slate-500" role="status">Loading workspace defaults…</p>;
  if (status === "error") return <p className="rounded-xl border border-rose-400/20 bg-panel p-5 text-xs text-rose-200" role="alert">{error}</p>;

  return <form className="space-y-5" onSubmit={(event) => void save(event)}>
    <header className="border-b border-stroke pb-5"><p className="text-[10px] font-semibold tracking-[.19em] text-electric-bright">WORKSPACE PROFILE & DEFAULTS</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.03em] text-foreground">Workspace profile and starting points</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Shared business context and defaults belong to {activeWorkspace?.name ?? "this workspace"}. They do not change another member’s personal display or saved work.</p></header>
    {!canEdit && <p className="rounded-xl border border-stroke bg-panel px-4 py-3 text-xs text-slate-400">Your {role} role can view workspace defaults. Only owners and admins can edit them.</p>}
    {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[.06] px-4 py-3 text-xs text-rose-200" role="alert">{error}</p>}
    {success && <p className="rounded-xl border border-electric/25 bg-electric/[.06] px-4 py-3 text-xs text-electric-bright" role="status">{success}</p>}
    <section className={`${panel} grid gap-5 sm:grid-cols-2`} aria-label="Workspace business profile">
      <label className="text-[10px] font-medium text-slate-300 sm:col-span-2" htmlFor="business-description">Business description<textarea className={`${field} min-h-24 py-3`} disabled={!canEdit} id="business-description" maxLength={1200} onChange={(event) => patch("businessDescription", event.target.value)} value={preferences.businessDescription}/><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Shared context for your team. This does not rewrite saved campaigns or creative projects.</span></label>
      <label className="text-[10px] font-medium text-slate-300" htmlFor="business-category">Business category<input className={field} disabled={!canEdit} id="business-category" maxLength={120} onChange={(event) => patch("businessCategory", event.target.value)} placeholder="e.g. Residential property brokerage" value={preferences.businessCategory}/></label>
      <label className="text-[10px] font-medium text-slate-300" htmlFor="operating-region">Operating region<input className={field} disabled={!canEdit} id="operating-region" maxLength={120} onChange={(event) => patch("operatingRegion", event.target.value)} placeholder="e.g. Western India" value={preferences.operatingRegion}/><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Enter the region your business serves; no address is inferred.</span></label>
      <label className="text-[10px] font-medium text-slate-300 sm:col-span-2" htmlFor="workspace-currency">Workspace display currency<input autoCapitalize="characters" className={`${field} max-w-sm`} disabled={!canEdit} id="workspace-currency" maxLength={3} onChange={(event) => patch("defaultCurrency", event.target.value.toUpperCase())} placeholder="USD" value={preferences.defaultCurrency}/><span className="mt-1.5 block text-[9px] font-normal text-slate-600">A display preference only. It does not convert campaign budgets, stored amounts or billing records.</span></label>
    </section>
    <section className={`${panel} grid gap-5 sm:grid-cols-2`} aria-label="Workspace defaults">
      <label className="text-[10px] font-medium text-slate-300" htmlFor="default-landing">Default landing page<select className={field} disabled={!canEdit} id="default-landing" onChange={(event) => patch("defaultLandingPage", event.target.value as WorkspacePreferences["defaultLandingPage"])} value={preferences.defaultLandingPage}><option value="overview">Workspace overview</option><option value="campaigns">Campaign Studio</option><option value="analytics">Analytics</option><option value="reports">Reports</option></select><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Used when opening Tandem Ads from the main site entry point.</span></label>
      <label className="text-[10px] font-medium text-slate-300" htmlFor="default-campaign-format">New campaign draft format<select className={field} disabled={!canEdit} id="default-campaign-format" onChange={(event) => patch("defaultCampaignFormat", event.target.value as WorkspacePreferences["defaultCampaignFormat"])} value={preferences.defaultCampaignFormat}><option value="google_search">Google Search</option><option value="meta_social">Meta social</option><option value="mixed">Choose in the campaign flow</option></select><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Only chooses a starting draft format; it does not publish anything.</span></label>
      <label className="text-[10px] font-medium text-slate-300" htmlFor="default-report-range">Default report date range<select className={field} disabled={!canEdit} id="default-report-range" onChange={(event) => patch("defaultReportDateRange", event.target.value as WorkspacePreferences["defaultReportDateRange"])} value={preferences.defaultReportDateRange}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Applies to new analytics views opened without a saved date filter.</span></label>
      <label className="text-[10px] font-medium text-slate-300" htmlFor="default-objective">Default marketing objective<select className={field} disabled={!canEdit} id="default-objective" onChange={(event) => patch("defaultMarketingObjective", event.target.value as WorkspacePreferences["defaultMarketingObjective"])} value={preferences.defaultMarketingObjective}><option value="leads">Lead generation</option><option value="sales">Sales</option><option value="traffic">Website traffic</option><option value="awareness">Awareness</option><option value="engagement">Engagement</option></select><span className="mt-1.5 block text-[9px] font-normal text-slate-600">The campaign flow checks the selected platform before using this objective.</span></label>
      <label className="text-[10px] font-medium text-slate-300 sm:col-span-2" htmlFor="default-density">Workspace display density<select className={`${field} max-w-sm`} disabled={!canEdit} id="default-density" onChange={(event) => patch("displayDensity", event.target.value as WorkspacePreferences["displayDensity"])} value={preferences.displayDensity}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select><span className="mt-1.5 block text-[9px] font-normal text-slate-600">Used by team lists.</span></label>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-slate-600">{dirty ? "Unsaved workspace changes" : "Workspace defaults are saved"}</p><button className={saveButton} disabled={!canEdit || !dirty || saving} type="submit">{saving ? "Saving defaults…" : "Save workspace defaults"}</button></div>
  </form>;
}
