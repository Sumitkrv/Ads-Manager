import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import {
  INDUSTRY_GOAL_PRESETS, READINESS_REQUIREMENTS, TrackingProviderCatalogue,
  UTMTemplateInputSchema, buildTrackingUrl,
} from "@ai-ads/shared";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { listCampaigns } from "../api/campaigns";
import { getTrackingOverview, trackingJson, trackingRequest, TrackingApiError } from "../api/tracking";

type Row = Record<string, unknown>;
type Overview = { providers: typeof TrackingProviderCatalogue[number][]; configs: Row[]; readiness: Row[]; readinessRequirements: typeof READINESS_REQUIREMENTS[number][]; readinessScores: Record<string, number>; goals: Row[]; events: Row[]; mappings: Row[]; templates: Row[]; campaignLinks: Row[]; trackingPlans: Row[]; preferences: Row; testRuns: Row[]; audit: Row[]; diagnostics: Row[] };
const emptyOverview: Overview = { providers: [...TrackingProviderCatalogue], configs: [], readiness: [], readinessRequirements: [...READINESS_REQUIREMENTS], readinessScores: {}, goals: [], events: [], mappings: [], templates: [], campaignLinks: [], trackingPlans: [], preferences: { casing: "lower", separator: "_", campaign_format: "{campaign}_{channel}_{date}", source_presets: ["google", "meta", "linkedin"], content_labels: ["image", "video", "headline"], date_token_format: "yyyyMMdd" }, testRuns: [], audit: [], diagnostics: [] };
const tabs = [
  ["/app/integrations", "Integrations"], ["/app/tracking/readiness", "Account readiness"], ["/app/tracking/goals", "Conversion goals"],
  ["/app/tracking/events", "Event taxonomy"], ["/app/tracking/mappings", "Event mappings"], ["/app/tracking/utm-builder", "UTM builder"],
  ["/app/tracking/implementation", "Implementation plan"], ["/app/tracking/diagnostics", "Diagnostics"],
] as const;
const inputClass = "w-full rounded-xl border border-stroke bg-input px-3.5 py-3 text-xs text-foreground outline-none transition focus:border-electric/50";
const buttonClass = "rounded-xl bg-electric px-4 py-3 text-xs font-semibold text-white transition hover:bg-electric-bright disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "rounded-xl border border-stroke px-3.5 py-2.5 text-xs font-medium text-slate-500 transition hover:border-electric/40 hover:text-foreground disabled:opacity-50";
function text(row: Row, key: string, fallback = ""): string { const value = row[key]; return typeof value === "string" ? value : fallback; }
function apiError(error: unknown) { return error instanceof TrackingApiError ? error.message : "The change could not be saved. Check your connection and try again."; }
function Status({ children }: { children: ReactNode }) { return <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100">{children}</span>; }
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block text-[11px] font-medium text-slate-500">{label}<input className={`${inputClass} mt-2`} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <label className="block text-[11px] font-medium text-slate-500">{label}<select className={`${inputClass} mt-2`} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>;
}

export function TrackingCenterPage() {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const location = useLocation();
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [campaigns, setCampaigns] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [provider, setProvider] = useState("google_ads");
  const [goalName, setGoalName] = useState("");
  const [goalEvent, setGoalEvent] = useState("");
  const [goalCategory, setGoalCategory] = useState("lead");
  const [editingGoalId, setEditingGoalId] = useState("");
  const [eventKey, setEventKey] = useState("LEAD_FORM_SUBMITTED");
  const [eventName, setEventName] = useState("Lead form submitted");
  const [editingEventId, setEditingEventId] = useState("");
  const [mappingEvent, setMappingEvent] = useState("");
  const [mappingProvider, setMappingProvider] = useState("ga4");
  const [mappingName, setMappingName] = useState("generate_lead");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [utmSource, setUtmSource] = useState("google");
  const [utmMedium, setUtmMedium] = useState("cpc");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [replaceUtm, setReplaceUtm] = useState(false);
  const [customParameterKey, setCustomParameterKey] = useState("");
  const [customParameterValue, setCustomParameterValue] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [planName, setPlanName] = useState("Website measurement plan");
  const [planWebsite, setPlanWebsite] = useState("");
  const [planProvider, setPlanProvider] = useState("ga4");
  const [testEventId, setTestEventId] = useState("");
  const [testPayload, setTestPayload] = useState('{"lead_source":"synthetic fixture"}');
  const [testResult, setTestResult] = useState<Row | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [campaignGoalId, setCampaignGoalId] = useState("");
  const [campaignTemplateId, setCampaignTemplateId] = useState("");
  const canManage = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";
  const section = location.pathname === "/app/integrations" ? "/app/integrations" : tabs.find(([path]) => location.pathname === path)?.[0] ?? "/app/integrations";
  const title = tabs.find(([path]) => path === section)?.[1] ?? "Integrations";

  const reload = useCallback(async () => {
    if (!session?.access_token || !activeWorkspace?.id) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [result, diagnosticResult, campaignResult] = await Promise.all([
        getTrackingOverview(session.access_token, activeWorkspace.id),
        trackingRequest<{ diagnostics?: Row[] }>(session.access_token, activeWorkspace.id, "/diagnostics"),
        listCampaigns(session.access_token, activeWorkspace.id, { pageSize: 50 }),
      ]);
      setOverview({ ...emptyOverview, ...(result as Partial<Overview>), diagnostics: diagnosticResult.diagnostics ?? [] });
      setCampaigns(campaignResult.campaigns as unknown as Row[]);
    } catch (caught) { setError(apiError(caught)); }
    finally { setLoading(false); }
  }, [activeWorkspace?.id, session?.access_token]);
  useEffect(() => { void reload(); }, [reload]);

  async function mutate(path: string, method: "POST" | "PUT" | "PATCH", body: unknown, message: string) {
    if (!session?.access_token || !activeWorkspace?.id) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await trackingRequest(session.access_token, activeWorkspace.id, path, trackingJson(method, body));
      setNotice(message); await reload();
    } catch (caught) { setError(apiError(caught)); }
    finally { setBusy(false); }
  }
  function handleSubmit(event: FormEvent, operation: () => Promise<void>) { event.preventDefault(); void operation(); }
  const goals = overview.goals;
  const events = overview.events;
  const templates = overview.templates;
  const currentConfig = overview.configs.find((item) => item.provider === provider) ?? {};

  async function buildPreview() {
    try {
      const value = utmPayload();
      const parsed = UTMTemplateInputSchema.parse(value);
      const generated = buildTrackingUrl(parsed);
      setPreviewUrl(generated.url); setError(""); setNotice(generated.warnings.join(" "));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Review the URL fields."); setPreviewUrl(""); }
  }

  function normalizedUtmValue(value: string) {
    const separator = text(overview.preferences, "separator", "_");
    let normalized = value.trim().replace(/\s+/g, separator);
    const casing = text(overview.preferences, "casing", "lower");
    if (casing === "lower") normalized = normalized.toLowerCase();
    if (casing === "upper") normalized = normalized.toUpperCase();
    return normalized;
  }
  function utmPayload(status: "active" | "archived" = "active") {
    return {
      name: templateName || "Campaign source link", destinationUrl,
      source: normalizedUtmValue(utmSource), medium: normalizedUtmValue(utmMedium), campaign: normalizedUtmValue(utmCampaign || "campaign_planning"),
      content: normalizedUtmValue(utmContent), term: normalizedUtmValue(utmTerm),
      customParameters: customParameterKey && customParameterValue ? [{ key: customParameterKey, value: normalizedUtmValue(customParameterValue) }] : [],
      replaceExisting: replaceUtm, campaignId: null, goalId: null, status,
    };
  }
  function templatePayload(row: Row, status: "active" | "archived" = "active") {
    return {
      name: text(row, "name"), destinationUrl: text(row, "destination_url"), source: text(row, "source"), medium: text(row, "medium"), campaign: text(row, "campaign"),
      content: text(row, "content"), term: text(row, "term"), customParameters: Array.isArray(row.custom_parameters) ? row.custom_parameters : [],
      replaceExisting: row.replace_existing === true, campaignId: typeof row.campaign_id === "string" ? row.campaign_id : null,
      goalId: typeof row.goal_id === "string" ? row.goal_id : null, status,
    };
  }
  function loadTemplate(row: Row, duplicate = false) {
    setEditingTemplateId(duplicate ? "" : text(row, "id")); setTemplateName(duplicate ? `${text(row, "name")} copy` : text(row, "name"));
    setDestinationUrl(text(row, "destination_url")); setUtmSource(text(row, "source")); setUtmMedium(text(row, "medium")); setUtmCampaign(text(row, "campaign"));
    setUtmContent(text(row, "content")); setUtmTerm(text(row, "term")); setReplaceUtm(row.replace_existing === true);
    const custom = Array.isArray(row.custom_parameters) ? row.custom_parameters[0] as Row | undefined : undefined;
    setCustomParameterKey(text(custom ?? {}, "key")); setCustomParameterValue(text(custom ?? {}, "value")); setPreviewUrl("");
  }
  async function saveTemplate() {
    await mutate(editingTemplateId ? `/utm-templates/${editingTemplateId}` : "/utm-templates", editingTemplateId ? "PATCH" : "POST", utmPayload(), editingTemplateId ? "UTM template updated." : "UTM template saved.");
    setEditingTemplateId("");
  }
  function applyCampaignFormat() {
    const dateFormat = text(overview.preferences, "date_token_format", "yyyyMMdd");
    const now = new Date();
    const dateToken = dateFormat === "yyyy-MM-dd" ? now.toISOString().slice(0, 10) : dateFormat === "MMM-yyyy" ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(now).replace(" ", "-") : now.toISOString().slice(0, 10).replaceAll("-", "");
    const format = text(overview.preferences, "campaign_format", "{campaign}_{channel}_{date}");
    setUtmCampaign(normalizedUtmValue(format.replaceAll("{campaign}", utmCampaign || "campaign").replaceAll("{channel}", utmMedium || "channel").replaceAll("{date}", dateToken)));
  }

  async function addIndustryPresets() {
    if (!session?.access_token || !activeWorkspace?.id) return;
    const presets = activeWorkspace.industryKey ? INDUSTRY_GOAL_PRESETS[activeWorkspace.industryKey] ?? [] : [];
    const remaining = presets.filter((item) => !goals.some((goal) => goal.event_name === item.eventName));
    if (!remaining.length) { setNotice(presets.length ? "These industry presets are already present." : "No preset set is available for this industry yet."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      for (const item of remaining) await trackingRequest(session.access_token, activeWorkspace.id, "/goals", trackingJson("POST", { ...item, description: "Editable industry starter goal. Definition only; no conversion has been observed.", status: "draft", industry: activeWorkspace.industryKey }));
      setNotice(`${remaining.length} editable goal preset(s) added. Existing goals were preserved.`); await reload();
    } catch (caught) { setError(apiError(caught)); }
    finally { setBusy(false); }
  }

  function goalPayload(status: "draft" | "active" | "archived" = "draft") {
    return { name: goalName, category: goalCategory, eventName: goalEvent, description: "", objective: "", illustrativeValue: null, currency: null, status, industry: activeWorkspace?.industryKey ?? null };
  }
  async function saveGoal() {
    await mutate(editingGoalId ? `/goals/${editingGoalId}` : "/goals", editingGoalId ? "PATCH" : "POST", goalPayload(), editingGoalId ? "Conversion goal updated." : "Conversion definition saved.");
    setEditingGoalId("");
  }
  function editGoal(goal: Row) {
    setEditingGoalId(text(goal, "id")); setGoalName(text(goal, "name")); setGoalCategory(text(goal, "category", "lead")); setGoalEvent(text(goal, "event_name"));
  }
  function archiveGoal(goal: Row) {
    void mutate(`/goals/${String(goal.id)}`, "PATCH", { name: text(goal, "name"), category: text(goal, "category"), eventName: text(goal, "event_name"), description: text(goal, "description"), objective: text(goal, "objective"), illustrativeValue: typeof goal.illustrative_value === "number" ? goal.illustrative_value : null, currency: typeof goal.currency === "string" ? goal.currency : null, countingPolicy: text(goal, "counting_policy", "once_per_event"), attributionNotes: text(goal, "attribution_notes"), status: "archived", industry: typeof goal.industry === "string" ? goal.industry : null }, "Conversion goal archived.");
  }
  async function saveEvent() {
    const old = overview.events.find((item) => item.id === editingEventId);
    await mutate(editingEventId ? `/events/${editingEventId}` : "/events", editingEventId ? "PATCH" : "POST", { eventKey, displayName: eventName, sourceType: text(old ?? {}, "source_type", "website"), description: text(old ?? {}, "description"), triggerDefinition: text(old ?? {}, "trigger_definition"), expectedParameters: old?.expected_parameters ?? { lead_source: { type: "string", required: true, description: "Synthetic source label" } }, deduplicationReference: text(old ?? {}, "deduplication_reference"), consentRequired: old?.consent_required !== false, status: text(old ?? {}, "status", "draft") }, editingEventId ? "Event definition updated." : "Event definition saved.");
    setEditingEventId("");
  }
  function editEvent(item: Row) { setEditingEventId(text(item, "id")); setEventKey(text(item, "event_key")); setEventName(text(item, "display_name")); }
  function archiveEvent(item: Row) {
    void mutate(`/events/${String(item.id)}`, "PATCH", { eventKey: text(item, "event_key"), displayName: text(item, "display_name"), sourceType: text(item, "source_type", "website"), description: text(item, "description"), triggerDefinition: text(item, "trigger_definition"), expectedParameters: item.expected_parameters ?? {}, deduplicationReference: text(item, "deduplication_reference"), consentRequired: item.consent_required !== false, status: "archived" }, "Event definition archived.");
  }
  function toggleMapping(item: Row) {
    void mutate(`/mappings/${String(item.id)}`, "PATCH", { eventDefinitionId: text(item, "event_definition_id"), provider: text(item, "provider"), providerEventName: text(item, "provider_event_name"), parameterMap: item.parameter_map ?? {}, status: item.status === "active" ? "draft" : "active", notes: text(item, "notes") }, item.status === "active" ? "Mapping set to draft." : "Mapping marked active for future use.");
  }

  async function runSyntheticValidation() {
    if (!session?.access_token || !activeWorkspace?.id) return;
    try {
      const parameters = JSON.parse(testPayload) as unknown;
      const result = await trackingRequest<Row>(session.access_token, activeWorkspace.id, "/validate", trackingJson("POST", { goalId: null, eventDefinitionId: testEventId, parameters }));
      setTestResult(result); setNotice("Saved as a simulated event. It was not sent to a provider."); setError(""); await reload();
    } catch (caught) { setError(caught instanceof SyntaxError ? "Synthetic parameters must be valid JSON." : apiError(caught)); }
  }

  const panel = "rounded-2xl border border-stroke bg-panel p-5 shadow-card sm:p-6";
  const subTitle = "font-display text-base font-semibold text-foreground";
  return <WorkspaceAppLayout title={`Integrations · ${title}`}>
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9">
      <header className="mb-7 rounded-3xl border border-stroke bg-gradient-to-br from-panel via-panel to-electric/[0.08] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-semibold tracking-[0.2em] text-electric-bright">MEASUREMENT WORKSPACE</p><h1 className="mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">Integrations & measurement</h1><p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">Prepare account access, conversion definitions and tracking plans before connecting any provider.</p></div><Status>External connections disabled</Status></div>
        <p className="mt-5 border-t border-stroke/70 pt-4 text-[10px] leading-5 text-slate-500">Saved configuration is workspace planning data. Local validation does not verify accounts, pixels, tags or received conversions.</p>
      </header>
      <nav aria-label="Measurement sections" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-stroke bg-panel p-1.5">{tabs.map(([path, label]) => <NavLink key={path} end className={({ isActive }) => `shrink-0 rounded-xl px-3.5 py-2.5 text-[10px] font-medium transition ${isActive ? "bg-electric/10 text-electric-bright" : "text-slate-500 hover:bg-surface-hover hover:text-foreground"}`} to={path}>{label}</NavLink>)}</nav>
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-4 text-xs leading-5 text-rose-100">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-sky-300/20 bg-sky-300/[0.05] p-4 text-xs leading-5 text-sky-100">{notice}</div>}
      {loading ? <div aria-label="Loading measurement settings" className={`${panel} animate-pulse`}><div className="h-4 w-48 rounded bg-slate-700/40"/><div className="mt-5 h-24 rounded-xl bg-slate-700/20"/></div> : <>
        {section === "/app/integrations" && <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{overview.providers.map((item) => {
            const config = overview.configs.find((candidate) => candidate.provider === item.id);
            const readinessScore = overview.readinessScores[item.id] ?? 0;
            return <article className={`${panel} flex min-h-48 flex-col`} key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">{item.category}</p><h2 className="mt-2 text-sm font-semibold text-foreground">{item.name}</h2></div><Status>Not connected</Status></div><p className="mt-3 text-[11px] leading-5 text-slate-500">{item.purpose}</p><div className="mt-auto flex items-center justify-between pt-5 text-[10px] text-slate-500"><span>{config ? "Draft saved locally" : "Not configured"}</span><span>{readinessScore}% prepared</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/40"><div className="h-full rounded-full bg-electric" style={{ width: `${readinessScore}%` }}/></div></article>;
          })}</section>
          <section className={panel}><h2 className={subTitle}>Your measurement workspace</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Conversion goals", goals.length, "/app/tracking/goals"], ["Event definitions", events.length, "/app/tracking/events"], ["UTM templates", templates.length, "/app/tracking/utm-builder"], ["Synthetic checks", overview.testRuns.length, "/app/tracking/diagnostics"]].map(([name, count, path]) => <Link key={String(name)} className="rounded-xl border border-stroke bg-midnight/40 p-4 transition hover:border-electric/30" to={String(path)}><span className="text-[10px] text-slate-500">{name}</span><span className="mt-2 block font-display text-xl font-semibold text-foreground">{count}</span></Link>)}</div></section>
          <section className={`${panel} flex flex-wrap items-center justify-between gap-4`}><div><h2 className={subTitle}>Local configuration only</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">Provider authentication, account discovery and event delivery are unavailable in this milestone.</p></div><Link className={secondaryClass} to="/app/tracking/readiness">Open readiness checklists</Link></section>
        </div>}

        {section === "/app/tracking/readiness" && <div className="grid gap-6 lg:grid-cols-[280px_1fr]"><aside className={`${panel} h-fit`}><h2 className={subTitle}>Ad account readiness</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">Progress measures preparation, not provider verification.</p><div className="mt-4 space-y-2">{([["google_ads", "Google Ads"], ["meta_ads", "Meta Ads"]] as const).map(([id, label]) => <button key={id} className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-xs ${provider === id ? "border-electric/40 bg-electric/[0.06] text-foreground" : "border-stroke text-slate-500"}`} onClick={() => setProvider(id)} type="button">{label}<span>{overview.readinessScores[id] ?? 0}%</span></button>)}</div></aside><section className={`${panel} space-y-5`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className={subTitle}>{provider === "google_ads" ? "Google Ads" : "Meta Ads"} preparation</h2><p className="mt-1.5 text-[10px] text-slate-500">No platform permissions or payment details are checked here.</p></div>{canManage && <form onSubmit={(event) => handleSubmit(event, () => mutate(`/integrations/${provider}`, "PATCH", { accountIdentifier: text(currentConfig, "account_identifier"), businessLabel: text(currentConfig, "business_label"), websiteUrl: text(currentConfig, "website_url"), notes: text(currentConfig, "notes") }, "Planning metadata saved locally."))}><button className={secondaryClass} disabled={busy} type="submit">Save draft metadata</button></form>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Account identifier (non-secret)" value={text(currentConfig, "account_identifier")} onChange={(value) => setOverview((old) => ({ ...old, configs: [...old.configs.filter((item) => item.provider !== provider), { ...currentConfig, provider, account_identifier: value }] }))} placeholder={provider === "google_ads" ? "123-456-7890" : "Ad account reference"}/><Field label="Business label" value={text(currentConfig, "business_label")} onChange={(value) => setOverview((old) => ({ ...old, configs: [...old.configs.filter((item) => item.provider !== provider), { ...currentConfig, provider, business_label: value }] }))} placeholder="Business account label"/><Field label="Destination website" value={text(currentConfig, "website_url")} onChange={(value) => setOverview((old) => ({ ...old, configs: [...old.configs.filter((item) => item.provider !== provider), { ...currentConfig, provider, website_url: value }] }))} placeholder="https://example.com"/><Field label="Planning notes" value={text(currentConfig, "notes")} onChange={(value) => setOverview((old) => ({ ...old, configs: [...old.configs.filter((item) => item.provider !== provider), { ...currentConfig, provider, notes: value }] }))} placeholder="No secrets or provider credentials"/></div>
          {canManage && <button className={secondaryClass} disabled={busy || !currentConfig.id} onClick={() => void mutate(`/validate-local/${provider}`, "POST", {}, "Local configuration checks completed. External verification remains unavailable.")} type="button">Validate locally</button>}
          <div className="divide-y divide-stroke/70">{overview.readinessRequirements.map((requirement) => { const saved = overview.readiness.find((item) => item.provider === provider && item.requirement_id === requirement.id); return <label key={requirement.id} className="flex cursor-pointer items-start gap-3 py-3.5"><input className="mt-1 size-4 accent-electric" type="checkbox" checked={saved?.completed === true} disabled={!canManage || busy} onChange={(event) => void mutate(`/readiness/${provider}`, "PUT", { requirementId: requirement.id, completed: event.target.checked, note: text(saved ?? {}, "note") }, "Readiness response saved.")}/><span><span className="block text-xs font-medium text-foreground">{requirement.description}</span><span className="mt-1 block text-[9px] uppercase tracking-wider text-slate-600">{requirement.category.replaceAll("_", " ")} · {requirement.required ? "Required" : "Optional"}</span></span></label>; })}</div>
          <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100">A completed item is a user-reported planning response. Tandem Ads has not verified account ownership, ad access, billing, policy status, or tag installation.</p>
        </section></div>}

        {section === "/app/tracking/goals" && <div className="space-y-6">
          <section className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className={subTitle}>Conversion goal definitions</h2><p className="mt-1.5 text-[11px] text-slate-500">These are planned measurement definitions, not reported conversions.</p></div><button className={secondaryClass} disabled={!canManage || busy} onClick={() => void addIndustryPresets()} type="button">Add {activeWorkspace?.industryKey?.replaceAll("_", " ") ?? "industry"} presets</button></div>
            <form className="mt-5 grid gap-3 sm:grid-cols-3" onSubmit={(event) => handleSubmit(event, saveGoal)}><Field label="Goal name" value={goalName} onChange={setGoalName} placeholder="Lead form submitted"/><Field label="Internal event name" value={goalEvent} onChange={setGoalEvent} placeholder="LEAD_FORM_SUBMITTED"/><Select label="Category" value={goalCategory} onChange={setGoalCategory} options={[["lead", "Lead"], ["sale", "Sale"], ["engagement", "Engagement"], ["registration", "Registration"], ["booking", "Booking"], ["custom", "Custom"]]}/><div className="sm:col-span-3 flex flex-wrap gap-2"><button className={buttonClass} disabled={!canManage || busy} type="submit">{editingGoalId ? "Update goal definition" : "Save goal definition"}</button>{editingGoalId && <button className={secondaryClass} onClick={() => setEditingGoalId("")} type="button">Cancel edit</button>}</div></form>
          </section>
          <section className={panel}><h2 className={subTitle}>Saved goals</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-[11px]"><thead className="text-[9px] uppercase tracking-wider text-slate-600"><tr><th className="pb-3">Name</th><th className="pb-3">Event key</th><th className="pb-3">Category</th><th className="pb-3">State</th><th className="pb-3">Actions</th></tr></thead><tbody>{goals.map((goal) => <tr className="border-t border-stroke/70" key={String(goal.id)}><td className="py-3 font-medium text-foreground">{text(goal, "name")}</td><td className="py-3 font-mono text-slate-500">{text(goal, "event_name")}</td><td className="py-3 capitalize text-slate-500">{text(goal, "category")}</td><td className="py-3"><Status>{text(goal, "status", "draft")}</Status></td><td className="py-3"><div className="flex gap-2"><button className={secondaryClass} disabled={!canManage || busy || goal.status === "archived"} onClick={() => editGoal(goal)} type="button">Edit</button>{goal.status !== "archived" && <button className={secondaryClass} disabled={!canManage || busy} onClick={() => archiveGoal(goal)} type="button">Archive</button>}</div></td></tr>)}</tbody></table>{!goals.length && <p className="py-6 text-xs text-slate-500">No goals yet. Create one or add editable industry presets.</p>}</div></section>
        </div>}

        {section === "/app/tracking/events" && <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={panel}><h2 className={subTitle}>Event taxonomy</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">Internal event keys are separate from provider naming conventions.</p><form className="mt-5 space-y-3" onSubmit={(event) => handleSubmit(event, saveEvent)}><Field label="Internal event key" value={eventKey} onChange={setEventKey} placeholder="LEAD_FORM_SUBMITTED"/><Field label="Display name" value={eventName} onChange={setEventName} placeholder="Lead form submitted"/><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={!canManage || busy} type="submit">{editingEventId ? "Update event definition" : "Save event definition"}</button>{editingEventId && <button className={secondaryClass} onClick={() => setEditingEventId("")} type="button">Cancel edit</button>}</div></form></section>
          <section className={panel}><h2 className={subTitle}>Event definitions</h2><div className="mt-4 space-y-2">{events.map((item) => <article className="rounded-xl border border-stroke p-3.5" key={String(item.id)}><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-medium text-foreground">{text(item, "display_name")}</span><span className="font-mono text-[9px] text-electric-bright">{text(item, "event_key")}</span></div><p className="mt-2 text-[10px] text-slate-500">{text(item, "source_type")} source · consent review {item.consent_required ? "required" : "not marked"} · v{String(item.version ?? 1)}</p><div className="mt-3 flex gap-2"><button className={secondaryClass} disabled={!canManage || busy || item.status === "archived"} onClick={() => editEvent(item)} type="button">Edit</button>{item.status !== "archived" && <button className={secondaryClass} disabled={!canManage || busy} onClick={() => archiveEvent(item)} type="button">Archive</button>}</div></article>)}</div>{!events.length && <p className="mt-4 text-xs text-slate-500">No event definitions saved.</p>}</section>
        </div>}

        {section === "/app/tracking/mappings" && <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className={panel}><h2 className={subTitle}>Provider event mapping</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">Names below are local planning suggestions. No provider schema was queried.</p><form className="mt-5 space-y-3" onSubmit={(event) => handleSubmit(event, () => mutate("/mappings", "POST", { eventDefinitionId: mappingEvent, provider: mappingProvider, providerEventName: mappingName, parameterMap: {}, status: "draft", notes: "Suggested mapping; locally configured only." }, "Mapping saved as a draft."))}><Select label="Internal event" value={mappingEvent} onChange={setMappingEvent} options={events.map((item) => [String(item.id), text(item, "display_name")])}/><Select label="Provider" value={mappingProvider} onChange={setMappingProvider} options={[["ga4", "Google Analytics 4"], ["google_ads_conversion", "Google Ads Conversion Tracking"], ["meta_pixel", "Meta Pixel / Dataset"], ["meta_ads", "Meta Ads"]]}/><Field label="Suggested provider event" value={mappingName} onChange={setMappingName} placeholder="generate_lead"/><p className="text-[9px] leading-5 text-slate-600">Examples: GA4 `generate_lead`, `purchase`; Meta suggestions `Lead`, `Purchase`. Exact provider acceptance remains unverified.</p><button className={buttonClass} disabled={!canManage || busy || !events.length} type="submit">Save mapping draft</button></form></section>
          <section className={panel}><h2 className={subTitle}>Saved mappings</h2><div className="mt-4 space-y-2">{overview.mappings.map((item) => <article className="rounded-xl border border-stroke p-3.5" key={String(item.id)}><p className="text-xs font-medium text-foreground">{text(item, "provider_event_name")} <span className="text-slate-600">→</span> {events.find((event) => event.id === item.event_definition_id)?.display_name as string ?? "event"}</p><p className="mt-1.5 text-[9px] uppercase tracking-wider text-amber-100">{text(item, "provider")} · {text(item, "status")} · local schema only</p><button className={`${secondaryClass} mt-3`} disabled={!canManage || busy} onClick={() => toggleMapping(item)} type="button">{item.status === "active" ? "Set to draft" : "Mark active for future implementation"}</button></article>)}</div>{!overview.mappings.length && <p className="mt-4 text-xs text-slate-500">No provider event mappings yet.</p>}</section>
        </div>}

        {section === "/app/tracking/utm-builder" && <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <section className={`${panel} space-y-4`}>
              <div><h2 className={subTitle}>UTM campaign URL builder</h2><p className="mt-1.5 text-[10px] text-slate-500">Built locally; the destination is never fetched by the server.</p></div>
              <Field label="Template name" value={templateName} onChange={setTemplateName} placeholder="Summer search campaign"/>
              <Field label="HTTPS destination" value={destinationUrl} onChange={setDestinationUrl} placeholder="https://example.com/landing"/>
              <div className="grid gap-3 sm:grid-cols-3"><Field label="utm_source" value={utmSource} onChange={setUtmSource} placeholder="google"/><Field label="utm_medium" value={utmMedium} onChange={setUtmMedium} placeholder="cpc"/><Field label="utm_campaign" value={utmCampaign} onChange={setUtmCampaign} placeholder="summer_launch"/></div>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="utm_content (optional)" value={utmContent} onChange={setUtmContent} placeholder="image_a"/><Field label="utm_term (optional)" value={utmTerm} onChange={setUtmTerm} placeholder="running shoes"/></div>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Custom parameter key (optional)" value={customParameterKey} onChange={setCustomParameterKey} placeholder="creative_id"/><Field label="Custom parameter value" value={customParameterValue} onChange={setCustomParameterValue} placeholder="variant_a"/></div>
              <label className="flex items-center gap-2 text-[10px] text-slate-500"><input className="accent-electric" checked={replaceUtm} onChange={(event) => setReplaceUtm(event.target.checked)} type="checkbox"/>Replace existing UTM values after review</label>
              <div className="flex flex-wrap gap-2"><button className={secondaryClass} onClick={() => void buildPreview()} type="button">Preview URL</button><button className={buttonClass} disabled={!canManage || busy || !previewUrl} onClick={() => void saveTemplate()} type="button">{editingTemplateId ? "Update template" : "Save template"}</button>{editingTemplateId && <button className={secondaryClass} onClick={() => { setEditingTemplateId(""); setPreviewUrl(""); }} type="button">Cancel edit</button>}</div>
              {previewUrl && <div className="rounded-xl border border-stroke bg-midnight/50 p-3.5"><p className="break-all font-mono text-[10px] leading-5 text-electric-bright">{previewUrl}</p><button className={`${secondaryClass} mt-3`} onClick={() => void navigator.clipboard?.writeText(previewUrl).then(() => setNotice("URL copied to clipboard."))} type="button">Copy URL</button></div>}
            </section>
            <section className={panel}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className={subTitle}>Workspace naming conventions</h2><p className="mt-1.5 text-[10px] leading-5 text-slate-500">Workspace-wide defaults used when generating planned UTM values.</p></div><Status>Shared defaults</Status></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Select label="Preferred casing" value={text(overview.preferences, "casing", "lower")} onChange={(value) => setOverview((old) => ({ ...old, preferences: { ...old.preferences, casing: value } }))} options={[["lower", "lowercase"], ["upper", "UPPERCASE"], ["preserve", "Preserve entered case"]]}/>
                <Select label="Word separator" value={text(overview.preferences, "separator", "_")} onChange={(value) => setOverview((old) => ({ ...old, preferences: { ...old.preferences, separator: value } }))} options={[["_", "Underscore"], ["-", "Hyphen"], [".", "Period"]]}/>
                <Field label="Campaign name pattern" value={text(overview.preferences, "campaign_format", "{campaign}_{channel}_{date}")} onChange={(value) => setOverview((old) => ({ ...old, preferences: { ...old.preferences, campaign_format: value } }))} placeholder="{campaign}_{channel}_{date}"/>
                <Select label="Date token" value={text(overview.preferences, "date_token_format", "yyyyMMdd")} onChange={(value) => setOverview((old) => ({ ...old, preferences: { ...old.preferences, date_token_format: value } }))} options={[["yyyyMMdd", "20261029"], ["yyyy-MM-dd", "2026-10-29"], ["MMM-yyyy", "Oct-2026"]]}/>
                <Field label="Source presets (comma separated)" value={Array.isArray(overview.preferences.source_presets) ? (overview.preferences.source_presets as string[]).join(", ") : "google, meta, linkedin"} onChange={(value) => setOverview((old) => ({ ...old, preferences: { ...old.preferences, source_presets: value.split(",").map((item) => item.trim()).filter(Boolean) } }))}/>
                <Field label="Content labels (comma separated)" value={Array.isArray(overview.preferences.content_labels) ? (overview.preferences.content_labels as string[]).join(", ") : "image, video, headline"} onChange={(value) => setOverview((old) => ({ ...old, preferences: { ...old.preferences, content_labels: value.split(",").map((item) => item.trim()).filter(Boolean) } }))}/>
              </div>
              <div className="mt-4 flex flex-wrap gap-2"><button className={secondaryClass} onClick={applyCampaignFormat} type="button">Apply campaign pattern</button><button className={buttonClass} disabled={!canManage || busy} onClick={() => void mutate("/preferences", "PATCH", { casing: text(overview.preferences, "casing", "lower"), separator: text(overview.preferences, "separator", "_"), campaignFormat: text(overview.preferences, "campaign_format", "{campaign}_{channel}_{date}"), sourcePresets: overview.preferences.source_presets, contentLabels: overview.preferences.content_labels, dateTokenFormat: text(overview.preferences, "date_token_format", "yyyyMMdd") }, "Workspace UTM naming defaults saved.")} type="button">Save workspace defaults</button></div>
            </section>
          </div>
          <section className={panel}><h2 className={subTitle}>Saved UTM templates</h2><div className="mt-4 space-y-2">{templates.map((item) => {
            let href = "";
            try { href = buildTrackingUrl(templatePayload(item) as Parameters<typeof buildTrackingUrl>[0]).url; } catch { /* Existing malformed records are shown without building a URL. */ }
            const archived = item.status === "archived";
            return <article className="rounded-xl border border-stroke p-3.5" key={String(item.id)}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-foreground">{text(item, "name")}</p><Status>{text(item, "status", "active")}</Status></div><p className="mt-1 break-all font-mono text-[9px] text-slate-500">{href || "Could not preview saved URL"}</p><div className="mt-3 flex flex-wrap gap-2"><button className={secondaryClass} onClick={() => loadTemplate(item)} type="button">Edit</button><button className={secondaryClass} onClick={() => loadTemplate(item, true)} type="button">Duplicate</button>{!archived && <button className={secondaryClass} disabled={!canManage || busy} onClick={() => void mutate(`/utm-templates/${String(item.id)}`, "PATCH", templatePayload(item, "archived"), "UTM template archived.")} type="button">Archive</button>}</div></article>;
          })}</div>{!templates.length && <p className="mt-4 text-xs text-slate-500">Build a tagged campaign URL and save it to reuse later.</p>}</section>
        </div>}

        {section === "/app/tracking/implementation" && <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]"><section className={panel}><h2 className={subTitle}>Implementation plan</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">This records future work. Tandem Ads will not install tags or modify your website.</p><form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => handleSubmit(event, () => mutate("/plans", "POST", { name: planName, destinationWebsite: planWebsite, provider: planProvider, installationMethod: planProvider === "ga4" ? "google_tag_ga4" : planProvider === "meta_pixel" ? "meta_pixel" : "google_tag_manager", measurementIdentifier: "", consentPrerequisites: "Review consent-management prerequisites before any future implementation.", testPlan: "", implementationOwnerLabel: "", reviewStatus: "draft", privacyChecklist: { privacyNoticeReviewed: false, consentPlanningReviewed: false, jurisdictionReviewNeeded: true, dataMinimizationReviewed: false, sensitiveFieldsExcluded: false, retentionReviewed: false, thirdPartySharingReviewed: false } }, "Implementation plan saved; no tags were installed."))}><Field label="Plan name" value={planName} onChange={setPlanName}/><Field label="HTTPS destination" value={planWebsite} onChange={setPlanWebsite} placeholder="https://example.com"/><Select label="Measurement provider" value={planProvider} onChange={setPlanProvider} options={[["ga4", "Google Analytics 4"], ["google_tag_manager", "Google Tag Manager"], ["meta_pixel", "Meta Pixel"], ["google_ads_conversion", "Google Ads conversion tracking"]]}/><Select label="Review state" value="draft" onChange={() => undefined} options={[["draft", "Draft plan"]]}/><div className="sm:col-span-2"><button className={buttonClass} disabled={!canManage || busy} type="submit">Save implementation plan</button></div></form><p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100">Privacy review is planning guidance only. Tandem Ads does not certify legal compliance.</p></section><section className={panel}><h2 className={subTitle}>Saved plans</h2><div className="mt-4 space-y-2">{overview.trackingPlans.map((item) => <article className="rounded-xl border border-stroke p-3.5" key={String(item.id)}><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-medium text-foreground">{text(item, "name")}</p><Status>Not installed</Status></div><p className="mt-2 break-all text-[10px] text-slate-500">{text(item, "destination_website")}</p></article>)}</div>{!overview.trackingPlans.length && <p className="mt-4 text-xs text-slate-500">No implementation plans have been saved.</p>}</section></div>}

        {section === "/app/tracking/diagnostics" && <div className="space-y-6"><section className={`${panel} flex flex-wrap items-start justify-between gap-4`}><div><h2 className={subTitle}>Offline event validation</h2><p className="mt-1.5 text-[11px] leading-5 text-slate-500">Synthetic values are schema checked and stored separately from campaign analytics.</p></div><Status>Not sent to provider</Status><div className="grid w-full gap-3 sm:grid-cols-2"><Select label="Event definition" value={testEventId} onChange={setTestEventId} options={events.map((item) => [String(item.id), text(item, "display_name")])}/><label className="block text-[11px] font-medium text-slate-500">Synthetic parameters (JSON)<textarea className={`${inputClass} mt-2 min-h-24 font-mono`} value={testPayload} onChange={(event) => setTestPayload(event.target.value)}/></label><button className={buttonClass} disabled={!canManage || busy || !testEventId} onClick={() => void runSyntheticValidation()} type="button">Validate locally</button></div></section>
          {testResult && <section className={panel}><h2 className={subTitle}>Latest simulated result</h2><pre className="mt-3 overflow-auto rounded-xl bg-midnight/50 p-3 text-[10px] text-sky-100">{JSON.stringify(testResult, null, 2)}</pre></section>}
          <section className={panel}><h2 className={subTitle}>Campaign tracking association</h2><p className="mt-1.5 text-[10px] text-slate-500">This saved sidecar does not alter campaign revisions or approvals.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Select label="Campaign draft" value={campaignId} onChange={setCampaignId} options={campaigns.map((campaign) => [String(campaign.id), text(campaign, "name")])}/><Select label="Conversion goal" value={campaignGoalId} onChange={setCampaignGoalId} options={goals.map((goal) => [String(goal.id), text(goal, "name")])}/><Select label="UTM template" value={campaignTemplateId} onChange={setCampaignTemplateId} options={templates.map((template) => [String(template.id), text(template, "name")])}/></div><button className={`${secondaryClass} mt-3`} disabled={!canManage || busy || !campaignId} onClick={() => void mutate("/campaign-links", "PUT", { campaignId, goalId: campaignGoalId || null, utmTemplateId: campaignTemplateId || null, notes: "Planning association only; no ad publishing." }, "Campaign measurement association saved.")} type="button">Save campaign association</button><div className="mt-4 space-y-2">{overview.campaignLinks.map((item) => <p className="rounded-lg border border-stroke px-3 py-2 text-[10px] text-slate-500" key={String(item.id)}>Campaign {text(item, "campaign_id")} · goal {text(item, "goal_id", "none")}</p>)}</div></section>
          <section className={panel}><h2 className={subTitle}>Workspace diagnostics</h2><div className="mt-4 space-y-2">{overview.diagnostics?.map((item: Row) => <div className="flex flex-wrap justify-between gap-3 rounded-xl border border-stroke px-3.5 py-3" key={String(item.code)}><span className="text-[10px] font-semibold text-foreground">{text(item, "code")}</span><span className="text-[9px] text-amber-100">{text(item, "status")}</span><p className="w-full text-[10px] text-slate-500">{text(item, "detail")}</p></div>) ?? <Link className={secondaryClass} to="/app/tracking/diagnostics">Reload diagnostics</Link>}</div></section>
          <section className={panel}><h2 className={subTitle}>Recent configuration activity</h2><div className="mt-3 space-y-2">{overview.audit.slice(0, 10).map((item) => <p className="text-[10px] text-slate-500" key={String(item.id)}>{text(item, "action")} · {text(item, "entity_type")} · {text(item, "created_at")}</p>)}</div></section>
        </div>}
      </>}
    </main>
  </WorkspaceAppLayout>;
}
