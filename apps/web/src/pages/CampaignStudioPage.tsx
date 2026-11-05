import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  CampaignBriefSchema, INDUSTRIES, hasWorkspacePermission,
  type CampaignBrief, type CampaignPlan, type CampaignRecord, type CampaignPlatform, type CampaignObjective,
} from "@ai-ads/shared";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import {
  archiveCampaign, CampaignApiError, createCampaign, decideCampaignReview, duplicateCampaign,
  generateCampaignDemo, generateCampaignOpenAI, getCampaign, getCampaignActivity, getCampaignReviews, getCampaignRevisions, getDemoAnalytics, getDemoPublishingAttempts,
  listCampaigns, saveCampaign, simulatePublish, submitCampaignReview, validateCampaignDraft,
} from "../api/campaigns";
import type { CampaignSummary } from "../api/campaigns";
import { getWorkspaceOnboarding } from "../api/onboarding";
import { getWorkspacePreferences } from "../api/settings";

const statuses = ["draft", "generated_simulation", "needs_review", "changes_requested", "approved_for_demo", "demo_published", "archived"] as const;
// External AI processing stays disabled for this offline planning milestone.
function isLiveCampaignGenerationEnabled(): boolean { return false; }
const statusLabel: Record<string, string> = {
  draft: "Draft", generated_simulation: "Draft ready", needs_review: "Needs review",
  changes_requested: "Changes requested", approved_for_demo: "Approved for demo", demo_published: "Demo published", archived: "Archived",
};
const goalNames: Record<string, string> = {
  website_traffic: "Website traffic", traffic: "Traffic", lead_generation: "Lead generation",
  sales: "Sales", awareness: "Awareness", engagement: "Engagement", app_promotion: "App promotion",
};
const wizardNames = ["Platform", "Objective", "Business", "Audience", "Budget", "Creative", "Review brief", "Generate"];
const briefFieldLabels: Record<string, string> = {
  businessName: "Business name",
  industryLabel: "Custom industry",
  productService: "Product or service",
  landingPageUrl: "Landing page URL",
  preferredCta: "Preferred call to action",
  country: "Country",
  intendedCustomer: "Intended customer",
  currency: "Currency",
  budgetAmount: "Budget amount",
  startDate: "Start date",
};
const today = () => new Date().toISOString().slice(0, 10);

function initialBrief(workspace: NonNullable<ReturnType<typeof useWorkspace>["activeWorkspace"]>): CampaignBrief {
  const value = {
    businessName: workspace.name, industry: workspace.industryKey, industryLabel: workspace.industryCustomLabel,
    productService: "", businessDescription: "", offer: "", landingPageUrl: workspace.websiteUrl ?? "",
    uniqueSellingPoints: [], brandVoice: "clear", preferredCta: "Learn more", country: workspace.countryCode ?? "",
    regions: [], language: "English", intendedCustomer: "", audienceDescription: "", keywords: [], interestThemes: [], exclusions: [],
    budgetType: "daily", budgetAmount: 20, currency: workspace.countryCode === "IN" ? "INR" : "USD", startDate: today(), endDate: null,
    budgetRationale: "", biddingPreference: "manual_review", tone: "clear", mainMessage: "", promotionalHook: "", brandAttributes: [], copyStyle: "benefit_led",
  };
  return value as CampaignBrief;
}
function messageFor(error: unknown) { return error instanceof CampaignApiError ? error.message : error instanceof Error ? error.message : "This request could not be completed."; }
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="block text-[11px] font-medium text-slate-200">{label}</span>{children}{help && <span className="mt-1.5 block text-[10px] leading-4 text-slate-500">{help}</span>}</label>;
}
function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`mt-2 min-h-11 w-full rounded-xl border border-stroke bg-input px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15 ${className}`} />;
}
function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`mt-2 min-h-24 w-full resize-y rounded-xl border border-stroke bg-input px-3.5 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15 ${className}`} />;
}
function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`mt-2 min-h-11 w-full rounded-xl border border-stroke bg-input px-3.5 py-2.5 text-sm text-slate-100 focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15 ${className}`}>{children}</select>;
}
function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-electric/35 bg-electric/15 px-4 py-2 text-xs font-semibold text-electric-bright transition hover:border-electric/60 hover:bg-electric/25 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>{children}</button>;
}
function QuietButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stroke bg-surface-muted px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>{children}</button>;
}
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-stroke/90 bg-card shadow-card ${className}`}>{children}</section>;
}
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" | "warning" }) {
  const colors = { info: "border-sky-300/15 bg-sky-300/[.05] text-sky-100", error: "border-rose-300/20 bg-rose-300/[.05] text-rose-100", success: "border-indigo-300/20 bg-indigo-300/[.05] text-indigo-100", warning: "border-amber-300/20 bg-amber-300/[.05] text-amber-100" };
  return <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${colors[tone]}`} role="status">{children}</div>;
}
function StatePill({ value, generationMode }: { value: string; generationMode?: string }) {
  const label = value === "generated_simulation" && generationMode === "openai" ? "AI draft ready" : statusLabel[value] ?? value;
  return <span className="inline-flex items-center gap-2 rounded-full border border-electric/20 bg-electric/[.07] px-3 py-1.5 text-[10px] font-semibold text-electric-bright"><span className="size-1.5 rounded-full bg-electric-bright" />{label}</span>;
}
function PlatformMark({ platform }: { platform: CampaignPlatform }) {
  return <span className={`grid size-10 shrink-0 place-items-center rounded-xl border font-display text-sm font-bold ${platform === "google_ads" ? "border-sky-300/20 bg-sky-300/[.07] text-sky-200" : "border-indigo-300/20 bg-indigo-300/[.07] text-indigo-200"}`}>{platform === "google_ads" ? "G" : "∞"}</span>;
}
function LabelOverline({ children }: { children: ReactNode }) { return <p className="text-[9px] font-semibold tracking-[.2em] text-slate-500">{children}</p>; }

function CampaignList({ workspaceId, token, canManage }: { workspaceId: string; token: string; canManage: boolean }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<CampaignSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [platform, setPlatform] = useState(""); const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState<string | null>(null);
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++seq.current; setLoading(true); setError(null);
    try {
      const data = await listCampaigns(token, workspaceId, { search, status: status || undefined, platform: platform || undefined, sort, page, pageSize: 12 });
      if (current !== seq.current) return; setItems(data.campaigns); setCounts(data.counts); setTotal(data.total);
    } catch (caught) { if (current === seq.current) setError(messageFor(caught)); }
    finally { if (current === seq.current) setLoading(false); }
  }, [page, platform, search, sort, status, token, workspaceId]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 180); return () => window.clearTimeout(timer); }, [refresh]);
  async function duplicate(item: CampaignSummary) {
    setBusyId(item.id); setError(null);
    try { const created = await duplicateCampaign(token, workspaceId, item.id, `${item.name} — copy`); navigate(`/app/campaigns/${created.id}/edit`); }
    catch (caught) { setError(messageFor(caught)); } finally { setBusyId(null); }
  }
  async function archive(item: CampaignSummary) {
    if (!window.confirm(`Archive “${item.name}” in this workspace?`)) return;
    setBusyId(item.id); setError(null);
    try { await archiveCampaign(token, workspaceId, item.id); await refresh(); } catch (caught) { setError(messageFor(caught)); } finally { setBusyId(null); }
  }
  const count = (key: string) => counts[key] ?? 0;
  return <div className="mx-auto max-w-[1340px] px-4 pb-14 pt-7 sm:px-7 sm:pt-10 lg:px-10">
    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div><LabelOverline>WORKSPACE CAMPAIGNS · DEMO MODE</LabelOverline><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-4xl">Campaign Studio</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Build structured campaign drafts, review them with your team, and rehearse publishing without touching an ad account.</p></div>
      {canManage && <Link data-tour-id="campaign-new" to="/app/campaigns/new" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-electric px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-[0_8px_30px_rgba(120,148,255,.2)] transition hover:bg-electric-bright xl:self-auto"><span className="text-base">＋</span> Create campaign</Link>}
    </div>
    <Notice><strong>Demo publishing — no ad account operation is connected.</strong> Campaigns, review history and simulated reporting are stored in this workspace. External AI generation is disabled in this milestone; text generation remains local simulation.</Notice>
    <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
      {statuses.map((key, i) => <button key={key} onClick={() => { setStatus(status === key ? "" : key); setPage(1); }} className={`group rounded-xl border px-3 py-3 text-left transition ${status === key ? "border-electric/40 bg-electric/[.08]" : "border-stroke/80 bg-panel/50 hover:border-slate-600"}`}><span className="block font-mono text-[9px] text-slate-500">{String(i + 1).padStart(2, "0")}</span><span className="mt-2 block truncate text-[10px] font-medium text-slate-300">{statusLabel[key]}</span><span className="mt-1 block font-display text-xl font-semibold text-foreground">{count(key)}</span></button>)}
    </div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_275px]">
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stroke/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="font-display text-base font-semibold text-foreground">Your campaign drafts</h2><p className="mt-1 text-[10px] text-slate-500">{total} saved {total === 1 ? "campaign" : "campaigns"} · sorted by {sort === "updated" ? "recent activity" : sort}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex"><Input aria-label="Search campaigns" className="col-span-2 mt-0 min-h-9 text-xs sm:w-52" placeholder="Search campaigns…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><Select aria-label="Filter platform" className="mt-0 min-h-9 text-[10px] sm:w-32" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }}><option value="">All platforms</option><option value="google_ads">Google Ads</option><option value="meta_ads">Meta Ads</option></Select><Select aria-label="Sort campaigns" className="mt-0 min-h-9 text-[10px] sm:w-32" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">Recently updated</option><option value="created">Recently created</option><option value="name">Name A–Z</option></Select></div>
        </div>
        {error && <div className="p-4 sm:p-5"><Notice tone="error">{error}</Notice></div>}
        {loading ? <div role="status" className="p-10 text-center text-xs text-slate-500">Loading workspace campaigns…</div> : items.length === 0 ? <div className="px-6 py-16 text-center sm:px-12"><div className="mx-auto grid size-16 place-items-center rounded-2xl border border-electric/15 bg-electric/[.05] font-display text-2xl text-electric-bright">C</div><h3 className="mt-5 font-display text-xl font-semibold text-foreground">{search || status || platform ? "No matching campaigns" : "Start with a clear brief"}</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{search || status || platform ? "Try clearing a filter or searching for another name." : "Create a real workspace draft, shape its audience and budget, then review the rule-based demo plan."}</p>{canManage && !search && !status && !platform && <Link to="/app/campaigns/new" className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-electric/30 bg-electric/10 px-4 text-xs font-semibold text-electric-bright hover:bg-electric/15">Create your first campaign <span className="ml-2">→</span></Link>}</div> : <div className="divide-y divide-stroke/70">
          {items.map((item) => <article key={item.id} className="grid gap-3 px-4 py-4 transition hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><PlatformMark platform={item.platform} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Link to={`/app/campaigns/${item.id}`} className="truncate text-sm font-semibold text-slate-100 hover:text-electric-bright">{item.name}</Link><StatePill value={item.status} generationMode={item.generationMode} /></div><p className="mt-1.5 text-[10px] text-slate-500">{item.platform === "google_ads" ? "Google Search draft" : "Meta campaign draft"} <span className="px-1 text-slate-700">·</span>{goalNames[item.objective]} <span className="px-1 text-slate-700">·</span>v{item.revision} <span className="px-1 text-slate-700">·</span>Updated {new Date(item.updatedAt).toLocaleDateString()}</p></div></div>
            <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0"><Link className="rounded-lg border border-stroke px-3 py-2 text-[10px] text-slate-300 hover:border-slate-600" to={`/app/campaigns/${item.id}/edit`}>Open editor</Link>{canManage && <><button disabled={busyId === item.id} onClick={() => void duplicate(item)} className="rounded-lg border border-stroke px-3 py-2 text-[10px] text-slate-400 hover:border-slate-600">Duplicate</button>{item.status !== "archived" && <button disabled={busyId === item.id} onClick={() => void archive(item)} className="rounded-lg border border-stroke px-3 py-2 text-[10px] text-slate-500 hover:border-rose-300/30 hover:text-rose-200">Archive</button>}</>}</div>
          </article>)}
        </div>}
        <div className="flex items-center justify-between border-t border-stroke/70 px-4 py-3 sm:px-5"><p className="text-[10px] text-slate-500">Page {page} · {total ? `showing ${(page - 1) * 12 + 1}–${Math.min(page * 12, total)}` : "no records"}</p><div className="flex gap-2"><QuietButton disabled={page <= 1 || loading} onClick={() => setPage((n) => n - 1)}>← Previous</QuietButton><QuietButton disabled={page * 12 >= total || loading} onClick={() => setPage((n) => n + 1)}>Next →</QuietButton></div></div>
      </Panel>
      <aside className="space-y-4">
        <Panel className="p-5"><LabelOverline>STUDIO WORKFLOW</LabelOverline><h3 className="mt-3 font-display text-base font-semibold text-foreground">Brief → structure → review</h3><ol className="mt-4 space-y-3">{["Set platform and objective", "Define audience and budget", "Generate campaign copy", "Review and simulate publishing"].map((text, i) => <li className="flex gap-3 text-[11px] text-slate-400" key={text}><span className="grid size-5 shrink-0 place-items-center rounded-full border border-stroke font-mono text-[9px] text-electric-bright">{i + 1}</span>{text}</li>)}</ol></Panel>
        <Panel className="overflow-hidden"><div className="border-b border-stroke/70 px-5 py-4"><LabelOverline>DATA PROVENANCE</LabelOverline><p className="mt-2 text-xs font-medium text-slate-200">No live ad platform activity</p></div><div className="space-y-3 p-5 text-[10px] leading-5 text-slate-500"><p>Campaign copy uses deterministic local simulation. No external AI provider is contacted.</p><p>Demo publishing only creates Tandem Ads records with a <span className="font-mono text-slate-300">demo_</span> reference.</p><p>Performance charts appear only after a persisted demo result exists.</p></div></Panel>
      </aside>
    </div>
  </div>;
}

function CampaignWizard({ workspace, token, forceSimulation = false }: { workspace: NonNullable<ReturnType<typeof useWorkspace>["activeWorkspace"]>; token: string; forceSimulation?: boolean }) {
  const navigate = useNavigate(); const [step, setStep] = useState(0); const [platform, setPlatform] = useState<CampaignPlatform | null>(null);
  const [objective, setObjective] = useState<string>(""); const [brief, setBrief] = useState<CampaignBrief>(() => initialBrief(workspace)); const [name, setName] = useState("");
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [generationState, setGenerationState] = useState<"idle" | "running" | "complete">("idle");
  const [externalProcessingConsent, setExternalProcessingConsent] = useState(false);
  const usesLiveAi = !forceSimulation && isLiveCampaignGenerationEnabled();
  const briefTouched = useRef(false);
  const update = <K extends keyof CampaignBrief>(key: K, value: CampaignBrief[K]) => { briefTouched.current = true; setBrief((previous) => ({ ...previous, [key]: value })); };
  useEffect(() => {
    let current = true;
    void Promise.all([
      getWorkspaceOnboarding(token, workspace.id).catch(() => null),
      getWorkspacePreferences(token, workspace.id).catch(() => null),
    ]).then(([progress, defaults]) => {
      if (!current || briefTouched.current) return;
      const data = progress?.setupData;
      const defaultPlatform: CampaignPlatform | null = defaults?.defaultCampaignFormat === "google_search" ? "google_ads" : defaults?.defaultCampaignFormat === "meta_social" ? "meta_ads" : null;
      const selectedPlatform = data?.platformFormat ?? defaultPlatform;
      if (selectedPlatform) setPlatform(selectedPlatform);
      const selectedGoal = data?.campaignGoal ?? (defaults ? ({ leads: "lead_generation", sales: "sales", traffic: selectedPlatform === "meta_ads" ? "traffic" : "website_traffic", awareness: "awareness", engagement: "engagement" } as const)[defaults.defaultMarketingObjective] : undefined);
      if (selectedPlatform && selectedGoal) {
        const mapped = selectedPlatform === "meta_ads" && selectedGoal === "website_traffic" ? "traffic" : selectedGoal;
        const allowed = selectedPlatform === "google_ads" ? ["website_traffic", "lead_generation", "sales", "awareness"] : ["awareness", "traffic", "engagement", "lead_generation", "app_promotion", "sales"];
        if (allowed.includes(mapped)) setObjective(mapped);
      }
      if (!data) return;
      const budget = ({ under_500: 250, "500_2000": 1000, "2000_5000": 3000, "5000_plus": 5000 } as Record<string, number>)[data.budgetRange ?? ""];
      const cta = ({ direct: "Get started", warm: "Contact us", minimal: "Learn more", confident: "Book now", custom: "Learn more" } as const)[data.ctaPreference ?? "custom"];
      const regions = (data.primaryRegion ?? "").split(/[,;\n]/).map((value) => value.trim()).filter(Boolean);
      setBrief((previous) => ({
        ...previous,
        productService: data.mainOffering || previous.productService,
        businessDescription: data.businessDescription || previous.businessDescription,
        regions: regions.length ? regions : previous.regions,
        intendedCustomer: data.audience || previous.intendedCustomer,
        audienceDescription: data.audience || previous.audienceDescription,
        brandVoice: data.brandTone ?? previous.brandVoice,
        tone: data.brandTone ?? previous.tone,
        preferredCta: cta,
        ...(budget ? { budgetAmount: budget } : {}),
      }));
    });
    return () => { current = false; };
  }, [token, workspace.id]);
  const objectiveOptions: Array<[string, string]> = platform === "google_ads"
    ? [["website_traffic", "Website traffic"], ["lead_generation", "Lead generation"], ["sales", "Sales"], ["awareness", "Awareness"]]
    : [["awareness", "Awareness"], ["traffic", "Traffic"], ["engagement", "Engagement"], ["lead_generation", "Leads"], ["app_promotion", "App promotion"], ["sales", "Sales"]];
  function choosePlatform(value: CampaignPlatform) { briefTouched.current = true; setPlatform(value); setObjective(value === "google_ads" ? "website_traffic" : "traffic"); }
  async function persistBrief() {
    if (!platform || !objective) throw new Error("Choose a platform and objective first.");
    const parsed = CampaignBriefSchema.safeParse(brief);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = typeof issue?.path[0] === "string" ? issue.path[0] : "";
      const label = briefFieldLabels[field];
      if (field === "landingPageUrl") throw new Error("Enter a valid landing page URL beginning with http:// or https://.");
      if (label && issue?.message.toLowerCase().includes("too small")) throw new Error(`${label} is required.`);
      throw new Error(label && issue ? `${label}: ${issue.message}` : issue?.message ?? "Complete the campaign brief before saving.");
    }
    const campaignName = name.trim() || `${brief.businessName} · ${brief.productService}`;
    const created = await createCampaign(token, workspace.id, { name: campaignName, platform, objective, brief: parsed.data, plan: null });
    setCampaign(created); setName(created.name); return created;
  }
  async function saveAndAdvance() {
    setError(null); setBusy(true);
    try { await persistBrief(); setStep(7); setGenerationState("idle"); }
    catch (caught) { setError(messageFor(caught)); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (!campaign) return;
    if (usesLiveAi && !externalProcessingConsent) { setError("Confirm that this brief may be sent to the configured AI provider before generating."); return; }
    setError(null); setBusy(true); setGenerationState("running");
    try {
      const generated = usesLiveAi
        ? await generateCampaignOpenAI(token, workspace.id, campaign.id)
        : await generateCampaignDemo(token, workspace.id, campaign.id);
      setCampaign(generated); setGenerationState("complete"); setExternalProcessingConsent(false);
    }
    catch (caught) { setError(messageFor(caught)); setGenerationState("idle"); }
    finally { setBusy(false); }
  }
  const stepValid = step === 0 ? Boolean(platform) : step === 1 ? Boolean(objective) : true;
  function stepContent() {
    if (step === 0) return <div><LabelOverline>STEP 01 · DRAFT FORMAT</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Where should this draft be structured?</h2><p className="mt-2 max-w-xl text-xs leading-5 text-slate-400">Select a format for the Tandem Ads draft. This does not connect an account or create a campaign on a provider.</p><div className="mt-7 grid gap-4 md:grid-cols-2">
      {([{ id: "google_ads" as const, label: "Google Ads", name: "Search campaign plan", desc: "Ad groups, keyword themes and responsive search copy.", mark: "G" }, { id: "meta_ads" as const, label: "Meta Ads", name: "Campaign · Ad sets · Ads", desc: "Audience, placements, budget and feed-ready creative copy.", mark: "∞" }]).map((item) => <button key={item.id} onClick={() => choosePlatform(item.id)} className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${platform === item.id ? "border-electric/60 bg-electric/[.07] shadow-[inset_0_0_0_1px_rgba(120,148,255,.18)]" : "border-stroke bg-surface-muted hover:border-slate-600"}`}><span className="absolute -right-5 -top-8 size-32 rounded-full border border-white/[.035] transition group-hover:scale-110" /><span className="relative flex items-center gap-4"><span className={`grid size-12 place-items-center rounded-2xl border text-lg font-bold ${item.id === "google_ads" ? "border-sky-300/20 bg-sky-300/[.06] text-sky-200" : "border-indigo-300/20 bg-indigo-300/[.06] text-indigo-200"}`}>{item.mark}</span><span><span className="block text-sm font-semibold text-foreground">{item.label}</span><span className="mt-1 block text-[10px] text-slate-500">{item.name}</span></span><span className={`ml-auto grid size-5 place-items-center rounded-full border text-[10px] ${platform === item.id ? "border-electric bg-electric text-primary-foreground" : "border-slate-700 text-transparent"}`}>✓</span></span><p className="relative mt-5 text-xs leading-5 text-slate-400">{item.desc}</p></button>)}</div></div>;
    if (step === 1) return <div><LabelOverline>STEP 02 · CAMPAIGN OBJECTIVE</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Choose the outcome to plan for.</h2><p className="mt-2 text-xs text-slate-400">Objectives are mapped to the selected draft format and are not provider-validated.</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{objectiveOptions.map(([value, label]) => <button key={value} onClick={() => setObjective(value)} className={`flex min-h-16 items-center justify-between rounded-xl border px-4 text-left text-xs transition ${objective === value ? "border-electric/50 bg-electric/[.08] text-foreground" : "border-stroke bg-surface-muted text-slate-400 hover:border-slate-600"}`}><span>{label}</span><span className={`grid size-5 place-items-center rounded-full border text-[9px] ${objective === value ? "border-electric bg-electric text-primary-foreground" : "border-slate-700 text-transparent"}`}>✓</span></button>)}</div></div>;
    if (step === 2) return <div><LabelOverline>STEP 03 · BUSINESS CONTEXT</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Give the draft a real business to represent.</h2><p className="mt-2 text-xs text-slate-400">Workspace values are prefilled where available. Complete the fields with accurate details.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Business name"><Input value={brief.businessName} onChange={(e) => update("businessName", e.target.value)} /></Field><Field label="Industry"><Select value={brief.industry} onChange={(e) => update("industry", e.target.value as CampaignBrief["industry"])}>{INDUSTRIES.map((industry) => <option key={industry.key} value={industry.key}>{industry.name}</option>)}</Select></Field>{brief.industry === "other" && <Field label="Custom industry"><Input value={brief.industryLabel ?? ""} onChange={(e) => update("industryLabel", e.target.value)} /></Field>}<Field label="Product or service"><Input value={brief.productService} placeholder="What is being promoted?" onChange={(e) => update("productService", e.target.value)} /></Field><Field label="Primary offer"><Input value={brief.offer} placeholder="Optional promotion or proposition" onChange={(e) => update("offer", e.target.value)} /></Field><Field label="Landing page URL"><Input type="url" value={brief.landingPageUrl} placeholder="https://example.com/page" onChange={(e) => update("landingPageUrl", e.target.value)} /></Field><Field label="Brand voice"><Select value={brief.brandVoice} onChange={(e) => update("brandVoice", e.target.value as CampaignBrief["brandVoice"])}>{["clear", "warm", "confident", "playful", "premium", "expert"].map((v) => <option key={v} value={v}>{v[0]?.toUpperCase()}{v.slice(1)}</option>)}</Select></Field><Field label="Preferred call to action"><Input value={brief.preferredCta} onChange={(e) => update("preferredCta", e.target.value)} /></Field><Field label="Business description" help="State what you offer in plain, verifiable terms."><Textarea value={brief.businessDescription} onChange={(e) => update("businessDescription", e.target.value)} /></Field><Field label="Unique selling points" help="One per line. Only include differentiators you can substantiate."><Textarea value={brief.uniqueSellingPoints.join("\n")} onChange={(e) => update("uniqueSellingPoints", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} /></Field></div></div>;
    if (step === 3) return <div><LabelOverline>STEP 04 · TARGET AUDIENCE</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Describe the people and places.</h2><p className="mt-2 text-xs text-slate-400">These are draft inputs. The demo engine does not estimate reach or audience availability.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Country"><Input value={brief.country} placeholder="Country" onChange={(e) => update("country", e.target.value)} /></Field><Field label="Regions or cities" help="One location per line."><Textarea value={brief.regions.join("\n")} onChange={(e) => update("regions", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} /></Field><Field label="Language"><Input value={brief.language} onChange={(e) => update("language", e.target.value)} /></Field><Field label="Intended customer"><Input value={brief.intendedCustomer} placeholder="Who is this for?" onChange={(e) => update("intendedCustomer", e.target.value)} /></Field><Field label="Audience description"><Textarea value={brief.audienceDescription} onChange={(e) => update("audienceDescription", e.target.value)} /></Field>{platform === "google_ads" ? <Field label="Keyword themes" help="No search-volume or CPC estimates are supplied."><Textarea value={brief.keywords.join("\n")} onChange={(e) => update("keywords", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} /></Field> : <Field label="Interest themes" help="Planning themes only; availability needs provider review."><Textarea value={brief.interestThemes.join("\n")} onChange={(e) => update("interestThemes", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} /></Field>}<Field label="Audience exclusions" help="One per line. Review against provider and local policy."><Textarea value={brief.exclusions.join("\n")} onChange={(e) => update("exclusions", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} /></Field></div></div>;
    if (step === 4) return <div><LabelOverline>STEP 05 · BUDGET & SCHEDULE</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Set a planning budget.</h2><p className="mt-2 text-xs text-slate-400">Demo budget values are stored only in Tandem Ads. They are not submitted to Google or Meta.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Budget type"><Select value={brief.budgetType} onChange={(e) => update("budgetType", e.target.value as CampaignBrief["budgetType"])}><option value="daily">Daily</option><option value="lifetime">Lifetime</option></Select></Field><Field label="Budget amount"><Input type="number" min="1" step="0.01" value={brief.budgetAmount} onChange={(e) => update("budgetAmount", Number(e.target.value))} /></Field><Field label="Currency"><Input maxLength={3} value={brief.currency} onChange={(e) => update("currency", e.target.value.toUpperCase())} /></Field><Field label="Bidding preference"><Select value={brief.biddingPreference} onChange={(e) => update("biddingPreference", e.target.value as CampaignBrief["biddingPreference"])}><option value="manual_review">Set after provider review</option><option value="maximize_clicks">Maximize clicks (draft)</option><option value="maximize_conversions">Maximize conversions (draft)</option></Select></Field><Field label="Start date"><Input type="date" value={brief.startDate} onChange={(e) => update("startDate", e.target.value)} /></Field><Field label="End date"><Input type="date" value={brief.endDate ?? ""} onChange={(e) => update("endDate", e.target.value || null)} /></Field><Field label="Budget rationale" help="Optional note for the reviewer."><Textarea value={brief.budgetRationale} onChange={(e) => update("budgetRationale", e.target.value)} /></Field></div><p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.04] px-4 py-3 text-[10px] leading-5 text-amber-100">Planning input only · no actual ad spend · not accepted or forecast by a provider.</p></div>;
    if (step === 5) return <div><LabelOverline>STEP 06 · CREATIVE DIRECTION</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Set a direction for the words.</h2><p className="mt-2 text-xs text-slate-400">{usesLiveAi ? "AI will draft campaign copy from this brief after you confirm external processing." : "The simulation composes copy from your brief. It does not call an AI model or generate images."}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Tone"><Select value={brief.tone} onChange={(e) => update("tone", e.target.value as CampaignBrief["tone"])}>{["clear", "warm", "confident", "playful", "premium", "expert"].map((v) => <option key={v} value={v}>{v}</option>)}</Select></Field><Field label="Copy style"><Select value={brief.copyStyle} onChange={(e) => update("copyStyle", e.target.value as CampaignBrief["copyStyle"])}><option value="benefit_led">Benefit-led</option><option value="concise">Concise</option><option value="story">Story-led</option></Select></Field><Field label="Main message"><Textarea value={brief.mainMessage} onChange={(e) => update("mainMessage", e.target.value)} /></Field><Field label="Promotional hook"><Textarea value={brief.promotionalHook} onChange={(e) => update("promotionalHook", e.target.value)} /></Field><Field label="Brand attributes" help="One per line."><Textarea value={brief.brandAttributes.join("\n")} onChange={(e) => update("brandAttributes", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} /></Field></div></div>;
    if (step === 6) return <div><LabelOverline>STEP 07 · REVIEW BRIEF</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">Check the brief before saving.</h2><p className="mt-2 text-xs text-slate-400">This creates a persisted workspace draft. You can edit it any time.</p><div className="mt-6 grid gap-3 md:grid-cols-2"><ReviewFact label="Platform" value={platform === "google_ads" ? "Google Ads · Search planning" : "Meta Ads · Campaign / ad set planning"} /><ReviewFact label="Objective" value={goalNames[objective] ?? objective} /><ReviewFact label="Business" value={`${brief.businessName} · ${INDUSTRIES.find((industry) => industry.key === brief.industry)?.name ?? brief.industry}`} /><ReviewFact label="Product / offer" value={`${brief.productService || "Not provided"}${brief.offer ? ` · ${brief.offer}` : ""}`} /><ReviewFact label="Landing page" value={brief.landingPageUrl || "Not provided"} /><ReviewFact label="Audience" value={`${brief.intendedCustomer || "Not provided"} · ${brief.regions.join(", ") || brief.country || "Location needed"}`} /><ReviewFact label="Budget" value={`${brief.budgetAmount} ${brief.currency} · ${brief.budgetType}`} /><ReviewFact label="Schedule" value={`${brief.startDate}${brief.endDate ? ` to ${brief.endDate}` : " · End date open"}`} /><ReviewFact label="Creative" value={`${brief.tone} tone · ${brief.preferredCta}`} /><div className="md:col-span-2"><Field label="Campaign name"><Input placeholder={`${brief.businessName} · ${brief.productService || "Campaign"}`} value={name} onChange={(e) => setName(e.target.value)} /></Field></div></div></div>;
    return <div><LabelOverline>STEP 08 · {usesLiveAi ? "AI GENERATION" : "RULE-BASED GENERATION"}</LabelOverline><h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">{usesLiveAi ? "Draft campaign copy with AI." : "Build a structured demo plan."}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">{usesLiveAi ? "Your brief will be sent to OpenAI only after you confirm. The result is stored as a Tandem Ads draft for human review; no ad platform is contacted." : "Tandem Ads uses deterministic, industry-aware templates. Your brief is already saved; generation writes an editable plan to this workspace campaign."}</p><div className="mt-6 space-y-2">{[
      { title: "Brief saved to workspace", done: Boolean(campaign), note: campaign ? `Revision ${campaign.revision} · stored in PostgreSQL` : "Save the brief first" },
      { title: "Compose relevant draft content", done: generationState === "complete", note: generationState === "running" ? (usesLiveAi ? "OpenAI draft generation in progress" : "Rule-based composition in progress") : generationState === "complete" ? "Generated from the submitted business inputs" : (usesLiveAi ? "OpenAI · per-request consent required" : "Offline simulation · no AI API") },
      { title: "Persist structured campaign plan", done: generationState === "complete", note: generationState === "complete" ? "Ready to edit, validate and review" : "Stored when generation returns" },
    ].map((stage, i) => <div key={stage.title} className="flex items-center gap-4 rounded-xl border border-stroke bg-surface-muted p-4"><span className={`grid size-8 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${stage.done ? "border-electric/40 bg-electric/10 text-electric-bright" : generationState === "running" && i === 1 ? "border-sky-300/35 bg-sky-300/[.06] text-sky-200 animate-pulse" : "border-stroke text-slate-600"}`}>{stage.done ? "✓" : `0${i + 1}`}</span><span className="min-w-0"><span className="block text-xs font-semibold text-slate-200">{stage.title}</span><span className="mt-1 block text-[10px] text-slate-500">{stage.note}</span></span></div>)}</div>{usesLiveAi ? <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4 text-[10px] leading-5 text-amber-100"><input className="mt-1 size-4 accent-amber-300" type="checkbox" checked={externalProcessingConsent} onChange={(event) => setExternalProcessingConsent(event.target.checked)} /><span><strong>Send this brief to OpenAI for AI generation.</strong> The full campaign brief is sent to the configured OpenAI API, including business and product details, offer, landing page URL, audience and exclusions, locations, budget, and brand voice. One campaign-generation usage operation is recorded. The result stays a Tandem Ads draft and still needs human review.</span></label> : <div className="mt-5"><Notice tone="info"><strong>AI Simulation.</strong> These drafts come from deterministic Tandem Ads templates. They are not produced by a generative model and are not verified by Google or Meta.</Notice></div>}{generationState === "complete" && campaign && <div className="mt-4"><Notice tone="success">Draft plan saved as revision {campaign.revision}. Continue to edit your copy and targeting.</Notice></div>}</div>;
  }
  return <div className="mx-auto min-h-[calc(100vh-110px)] max-w-[1250px] px-4 py-6 sm:px-7 sm:py-10 lg:px-10" data-tour-id="campaign-wizard">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/app/campaigns" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-foreground"><span>←</span> Campaign Studio</Link><span className="rounded-full border border-electric/20 bg-electric/[.06] px-3 py-1.5 text-[9px] font-semibold tracking-[.1em] text-electric-bright">DEMO · NO PROVIDER ACCOUNT</span></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-stroke bg-surface-muted p-4 xl:sticky xl:top-5 xl:h-fit"><LabelOverline>CAMPAIGN SETUP</LabelOverline><div className="mt-4 space-y-1">{wizardNames.map((label, i) => <button key={label} onClick={() => i <= step && setStep(i)} disabled={i > step || busy} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${step === i ? "bg-electric/[.09] text-electric-bright" : i < step ? "text-slate-300 hover:bg-surface-hover" : "text-slate-600"}`}><span className={`grid size-6 place-items-center rounded-full border font-mono text-[9px] ${i < step ? "border-electric/25 text-electric-bright" : step === i ? "border-electric/50 text-electric-bright" : "border-stroke"}`}>{i < step ? "✓" : String(i + 1).padStart(2, "0")}</span><span className="text-[10px] font-medium">{label}</span></button>)}</div><div className="mt-5 border-t border-stroke pt-4 text-[9px] leading-4 text-slate-600">Brief details remain in this guided flow until you save the draft at review.</div></aside>
      <Panel className="min-h-[620px] p-5 sm:p-8 lg:p-10">
        <div className="mb-8 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-electric to-indigo-400 transition-all duration-300" style={{ width: `${((step + 1) / wizardNames.length) * 100}%` }} /></div>
        {error && <div className="mb-5"><Notice tone="error">{error}</Notice></div>}
        <div className="min-h-[420px]">{stepContent()}</div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stroke/70 pt-5"><p className="text-[10px] text-slate-600">Step {String(step + 1).padStart(2, "0")} of 08 <span className="px-1">·</span> {brief.businessName}</p><div className="flex gap-2">{step > 0 && <QuietButton disabled={busy} onClick={() => { setError(null); setStep((i) => Math.max(0, i - 1)); }}>Back</QuietButton>}{step < 6 && <PrimaryButton disabled={!stepValid || busy} onClick={() => { setError(null); setStep((i) => i + 1); }}>Continue <span>→</span></PrimaryButton>}{step === 6 && <PrimaryButton disabled={busy} onClick={() => void saveAndAdvance()}>{busy ? "Saving…" : "Save brief and continue"}<span>→</span></PrimaryButton>}{step === 7 && <>{generationState === "complete" && campaign && <PrimaryButton onClick={() => navigate(`/app/campaigns/${campaign.id}/edit${forceSimulation ? "?onboarding=1" : ""}`)}>Open campaign editor <span>→</span></PrimaryButton>}<PrimaryButton disabled={busy || generationState === "complete" || !campaign || (usesLiveAi && !externalProcessingConsent)} onClick={() => void generate()}>{busy ? "Generating draft…" : generationState === "complete" ? "Plan generated" : usesLiveAi ? "Generate AI draft" : "Generate demo plan"}</PrimaryButton></>}</div></div>
      </Panel>
    </div>
  </div>;
}
function ReviewFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-stroke/80 bg-input p-4"><LabelOverline>{label}</LabelOverline><p className="mt-2 break-words text-xs leading-5 text-slate-200">{value}</p></div>;
}

function EditorView({ workspaceId, token, campaignId, role, routeMode, forceSimulation = false }: { workspaceId: string; token: string; campaignId: string; role: string; routeMode: "detail" | "edit" | "review" | "preview"; forceSimulation?: boolean }) {
  const navigate = useNavigate(); const [campaign, setCampaign] = useState<CampaignRecord | null>(null); const [name, setName] = useState(""); const [objective, setObjective] = useState(""); const [brief, setBrief] = useState<CampaignBrief | null>(null); const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved"); const [error, setError] = useState<string | null>(null); const [validation, setValidation] = useState<Awaited<ReturnType<typeof validateCampaignDraft>> | null>(null);
  const [externalProcessingConsent, setExternalProcessingConsent] = useState(false); const usesLiveAi = !forceSimulation && isLiveCampaignGenerationEnabled();
  const [comments, setComments] = useState(""); const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]); const [revisions, setRevisions] = useState<Array<Record<string, unknown>>>([]); const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]); const [analytics, setAnalytics] = useState<Array<{ id: string; scenario: string; seed: number; metrics: { days: Array<{ date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpa: number | null; roas: number | null }> }; dataSource: string; simulatedAt: string }>>([]);
  const [metricsScenario, setMetricsScenario] = useState("average"); const [imagePreview, setImagePreview] = useState<string | null>(null); const [imageError, setImageError] = useState<string | null>(null);
  const [publishingAttempts, setPublishingAttempts] = useState<Array<{ id: string; status: string; scenario: string; failureCode: string | null; localDemoReference: string; revision: number; publishedExternally: false; createdAt: string; completedAt: string | null }>>([]);
  const [googleGroupId, setGoogleGroupId] = useState<string | null>(null); const [googleAdId, setGoogleAdId] = useState<string | null>(null); const [newKeyword, setNewKeyword] = useState("");
  const [metaSetId, setMetaSetId] = useState<string | null>(null); const [metaAdId, setMetaAdId] = useState<string | null>(null);
  const baseline = useRef(""); const canManage = hasWorkspacePermission(role as never, "campaigns.manage"); const canApprove = hasWorkspacePermission(role as never, "campaigns.approve"); const canPublish = hasWorkspacePermission(role as never, "campaigns.publishDemo");
  const current = useMemo(() => JSON.stringify({ name, objective, brief, plan }), [brief, name, objective, plan]);
  const dirty = Boolean(campaign && baseline.current !== current);
  const setLoaded = useCallback((value: CampaignRecord) => {
    setCampaign(value); setName(value.name); setObjective(value.objective); setBrief(value.brief); setPlan(value.plan);
    baseline.current = JSON.stringify({ name: value.name, objective: value.objective, brief: value.brief, plan: value.plan }); setSaveState("saved");
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await getCampaign(token, workspaceId, campaignId); setLoaded(result);
      const [activityResult, reviewResult, revisionResult, analyticsResult, publishingResult] = await Promise.all([
        getCampaignActivity(token, workspaceId, campaignId).catch(() => ({ activity: [] })),
        getCampaignReviews(token, workspaceId, campaignId).catch(() => ({ reviews: [] })),
        getCampaignRevisions(token, workspaceId, campaignId).catch(() => ({ revisions: [] })),
        getDemoAnalytics(token, workspaceId, campaignId).catch(() => ({ label: "", analytics: [] })),
        getDemoPublishingAttempts(token, workspaceId, campaignId).catch(() => ({ label: "", attempts: [] })),
      ]);
      setActivity(activityResult.activity); setReviews(reviewResult.reviews); setRevisions(revisionResult.revisions); setAnalytics(analyticsResult.analytics); setPublishingAttempts(publishingResult.attempts);
    } catch (caught) { setError(messageFor(caught)); }
    finally { setLoading(false); }
  }, [campaignId, setLoaded, token, workspaceId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    setSaveState("unsaved");
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload); return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const save = useCallback(async () => {
    if (!campaign || !brief || !canManage) return campaign;
    setSaveState("saving"); setError(null);
    try {
      const saved = await saveCampaign(token, workspaceId, campaign.id, { name, platform: campaign.platform, objective, brief, plan, expectedRevision: campaign.revision });
      setLoaded(saved); setSaveState("saved"); return saved;
    } catch (caught) { setSaveState("error"); setError(messageFor(caught)); throw caught; }
  }, [brief, campaign, canManage, name, objective, plan, setLoaded, token, workspaceId]);
  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true); setError(null);
    try { await action(); if (success) setError(null); await refresh(); }
    catch (caught) { setError(messageFor(caught)); }
    finally { setBusy(false); }
  }
  async function saveThen(action: (record: CampaignRecord) => Promise<unknown>) {
    if (!campaign) return;
    setBusy(true); setError(null);
    try { const saved = dirty ? await save() : campaign; if (saved) await action(saved); await refresh(); }
    catch (caught) { setError(messageFor(caught)); }
    finally { setBusy(false); }
  }
  const googleGroup = plan?.google?.adGroups.find((group) => group.id === googleGroupId) ?? plan?.google?.adGroups[0];
  const googleAd = googleGroup?.ads.find((ad) => ad.id === googleAdId) ?? googleGroup?.ads[0];
  const metaSet = plan?.meta?.adSets.find((set) => set.id === metaSetId) ?? plan?.meta?.adSets[0];
  const metaAd = metaSet?.ads.find((ad) => ad.id === metaAdId) ?? metaSet?.ads[0];
  function commitPlan(next: CampaignPlan, marker: string) {
    setPlan({ ...next, generation: { ...next.generation, userModifications: next.generation.userModifications.includes(marker) ? next.generation.userModifications : [...next.generation.userModifications, marker] } });
  }
  function editGoogle(patch: { headlines?: string[]; descriptions?: string[]; finalUrl?: string; keywords?: Array<{ text: string; matchType: "broad" | "phrase" | "exact" }> }) {
    if (!plan?.google || !googleGroup) return;
    const updated = { ...plan, google: { adGroups: plan.google.adGroups.map((group) => group.id !== googleGroup.id ? group : { ...group, ...(patch.keywords ? { keywords: patch.keywords } : {}), ads: group.ads.map((ad) => ad.id !== googleAd?.id ? ad : { ...ad, ...(patch.headlines ? { headlines: patch.headlines.slice(0, 15) } : {}), ...(patch.descriptions ? { descriptions: patch.descriptions.slice(0, 4) } : {}), ...(patch.finalUrl ? { finalUrl: patch.finalUrl } : {}) }) }) } };
    commitPlan(updated, "edited_google_draft");
  }
  function editMeta(patch: { primaryText?: string; headline?: string; description?: string; cta?: string; destinationUrl?: string; audience?: string; locations?: string[]; placements?: Array<"feed" | "stories" | "reels" | "automatic">; budgetAmount?: number; budgetType?: "daily" | "lifetime"; creativeReference?: string | null }) {
    if (!plan?.meta || !metaSet) return;
    const updated = { ...plan, meta: { adSets: plan.meta.adSets.map((set) => set.id !== metaSet.id ? set : { ...set, ...(patch.audience !== undefined ? { audience: patch.audience } : {}), ...(patch.locations ? { locations: patch.locations } : {}), ...(patch.placements ? { placements: patch.placements } : {}), ...(patch.budgetAmount !== undefined ? { budgetAmount: patch.budgetAmount } : {}), ...(patch.budgetType ? { budgetType: patch.budgetType } : {}), ads: set.ads.map((ad) => ad.id !== metaAd?.id ? ad : { ...ad, ...(patch.primaryText !== undefined ? { primaryText: patch.primaryText } : {}), ...(patch.headline !== undefined ? { headline: patch.headline } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.cta !== undefined ? { cta: patch.cta } : {}), ...(patch.destinationUrl !== undefined ? { destinationUrl: patch.destinationUrl } : {}), ...(patch.creativeReference !== undefined ? { creativeReference: patch.creativeReference } : {}) }) }) } };
    commitPlan(updated, "edited_meta_draft");
  }
  function changeObjective(value: string) {
    const next = value as CampaignObjective; setObjective(next);
    if (plan) commitPlan({ ...plan, objective: next }, "edited_objective");
  }
  function changeLandingPage(value: string) {
    if (brief) setBrief({ ...brief, landingPageUrl: value });
    if (!plan) return;
    const updated: CampaignPlan = plan.google
      ? { ...plan, google: { adGroups: plan.google.adGroups.map((group) => ({ ...group, ads: group.ads.map((ad) => ({ ...ad, finalUrl: value })) })) } }
      : plan.meta ? { ...plan, meta: { adSets: plan.meta.adSets.map((set) => ({ ...set, ads: set.ads.map((ad) => ({ ...ad, destinationUrl: value })) })) } }
        : plan;
    commitPlan(updated, "edited_destination_url");
  }
  function changeBudgetAmount(value: number) {
    if (brief) setBrief({ ...brief, budgetAmount: value });
    if (plan?.meta) commitPlan({ ...plan, meta: { adSets: plan.meta.adSets.map((set) => ({ ...set, budgetAmount: value })) } }, "edited_budget");
  }
  function changeBudgetType(value: CampaignBrief["budgetType"]) {
    if (brief) setBrief({ ...brief, budgetType: value });
    if (plan?.meta) commitPlan({ ...plan, meta: { adSets: plan.meta.adSets.map((set) => ({ ...set, budgetType: value })) } }, "edited_budget_type");
  }
  function addGoogleGroup() {
    if (!plan?.google || plan.google.adGroups.length >= 30) return;
    const source = googleGroup ?? plan.google.adGroups[0]; if (!source) return;
    const group = { ...source, id: crypto.randomUUID(), name: `Ad group ${plan.google.adGroups.length + 1}`, ads: source.ads.map((ad) => ({ ...ad, id: crypto.randomUUID() })) };
    commitPlan({ ...plan, google: { adGroups: [...plan.google.adGroups, group] } }, "added_google_ad_group"); setGoogleGroupId(group.id); setGoogleAdId(group.ads[0]?.id ?? null);
  }
  function removeGoogleGroup() {
    if (!plan?.google || !googleGroup || plan.google.adGroups.length <= 1) return;
    const adGroups = plan.google.adGroups.filter((group) => group.id !== googleGroup.id);
    commitPlan({ ...plan, google: { adGroups } }, "removed_google_ad_group"); setGoogleGroupId(adGroups[0]?.id ?? null); setGoogleAdId(adGroups[0]?.ads[0]?.id ?? null);
  }
  function addGoogleAd() {
    if (!plan?.google || !googleGroup || googleGroup.ads.length >= 10) return;
    const source = googleAd ?? googleGroup.ads[0]; if (!source) return;
    const ad = { ...source, id: crypto.randomUUID() };
    const updated = { ...plan, google: { adGroups: plan.google.adGroups.map((group) => group.id === googleGroup.id ? { ...group, ads: [...group.ads, ad] } : group) } };
    commitPlan(updated, "added_google_search_ad"); setGoogleAdId(ad.id);
  }
  function removeGoogleAd() {
    if (!plan?.google || !googleGroup || !googleAd || googleGroup.ads.length <= 1) return;
    const ads = googleGroup.ads.filter((ad) => ad.id !== googleAd.id);
    commitPlan({ ...plan, google: { adGroups: plan.google.adGroups.map((group) => group.id === googleGroup.id ? { ...group, ads } : group) } }, "removed_google_search_ad"); setGoogleAdId(ads[0]?.id ?? null);
  }
  function addMetaSet() {
    if (!plan?.meta || plan.meta.adSets.length >= 30) return;
    const source = metaSet ?? plan.meta.adSets[0]; if (!source) return;
    const adSets = { ...source, id: crypto.randomUUID(), name: `Ad set ${plan.meta.adSets.length + 1}`, ads: source.ads.map((ad) => ({ ...ad, id: crypto.randomUUID() })) };
    commitPlan({ ...plan, meta: { adSets: [...plan.meta.adSets, adSets] } }, "added_meta_ad_set"); setMetaSetId(adSets.id); setMetaAdId(adSets.ads[0]?.id ?? null);
  }
  function removeMetaSet() {
    if (!plan?.meta || !metaSet || plan.meta.adSets.length <= 1) return;
    const adSets = plan.meta.adSets.filter((set) => set.id !== metaSet.id);
    commitPlan({ ...plan, meta: { adSets } }, "removed_meta_ad_set"); setMetaSetId(adSets[0]?.id ?? null); setMetaAdId(adSets[0]?.ads[0]?.id ?? null);
  }
  function addMetaAd() {
    if (!plan?.meta || !metaSet || metaSet.ads.length >= 10) return;
    const source = metaAd ?? metaSet.ads[0]; if (!source) return;
    const ad = { ...source, id: crypto.randomUUID() };
    commitPlan({ ...plan, meta: { adSets: plan.meta.adSets.map((set) => set.id === metaSet.id ? { ...set, ads: [...set.ads, ad] } : set) } }, "added_meta_ad"); setMetaAdId(ad.id);
  }
  function removeMetaAd() {
    if (!plan?.meta || !metaSet || !metaAd || metaSet.ads.length <= 1) return;
    const ads = metaSet.ads.filter((ad) => ad.id !== metaAd.id);
    commitPlan({ ...plan, meta: { adSets: plan.meta.adSets.map((set) => set.id === metaSet.id ? { ...set, ads } : set) } }, "removed_meta_ad"); setMetaAdId(ads[0]?.id ?? null);
  }
  function onImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; setImageError(null); if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setImageError("Choose a PNG, JPEG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setImageError("Image must be 5 MB or smaller."); return; }
    const url = URL.createObjectURL(file); setImagePreview((old) => { if (old) URL.revokeObjectURL(old); return url; });
  }
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  if (loading) return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-xs text-slate-500" role="status">Loading campaign from this workspace…</div>;
  if (!campaign || !brief) return <div className="mx-auto max-w-3xl px-5 py-16"><Notice tone="error">{error ?? "Campaign not found in this workspace."}</Notice><Link to="/app/campaigns" className="mt-5 inline-block text-xs text-electric-bright">← Return to Campaign Studio</Link></div>;
  const metrics = analytics[0]?.metrics?.days ?? []; const totals = metrics.reduce((sum, day) => ({ impressions: sum.impressions + day.impressions, clicks: sum.clicks + day.clicks, spend: sum.spend + day.spend, conversions: sum.conversions + day.conversions }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
  const previewLines = campaign.platform === "google_ads" ? googleAd?.headlines ?? [] : metaAd?.headline ? [metaAd.headline] : [];
  return <div className="mx-auto max-w-[1340px] px-4 pb-14 pt-6 sm:px-7 sm:pt-9 lg:px-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><Link to="/app/campaigns" className="text-xs text-slate-400 hover:text-foreground">← Campaign Studio</Link><div className="flex flex-wrap items-center gap-2"><span className={`text-[10px] ${saveState === "saved" ? "text-slate-500" : saveState === "saving" ? "text-sky-200" : saveState === "error" ? "text-rose-200" : "text-amber-200"}`} role="status">{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Unsaved changes"}</span>{canManage && routeMode === "edit" && <PrimaryButton disabled={!dirty || busy} onClick={() => void save()}>{saveState === "saving" ? "Saving…" : "Save draft"}</PrimaryButton>}</div></div>
    <div className="mt-5 flex flex-col justify-between gap-5 border-b border-stroke/80 pb-6 lg:flex-row lg:items-end"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><PlatformMark platform={campaign.platform} /><div className="min-w-0"><LabelOverline>{campaign.platform === "google_ads" ? "GOOGLE ADS · SEARCH DRAFT" : "META ADS · CAMPAIGN DRAFT"} · REVISION {campaign.revision}</LabelOverline><h1 className="mt-2 break-words font-display text-2xl font-semibold tracking-[-.035em] text-foreground sm:text-3xl">{routeMode === "edit" && canManage ? <input className="w-full min-w-0 bg-transparent focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} aria-label="Campaign name" /> : campaign.name}</h1></div></div><div className="mt-3 flex flex-wrap items-center gap-2 pl-[52px]"><StatePill value={campaign.status} /><span className="text-[10px] text-slate-500">{goalNames[campaign.objective]} · Demo execution only</span></div></div><nav aria-label="Campaign sections" className="flex flex-wrap gap-2">{([ ["Overview", `/app/campaigns/${campaign.id}`], ["Edit draft", `/app/campaigns/${campaign.id}/edit`], ["Preview", `/app/campaigns/${campaign.id}/preview`], ["Review", `/app/campaigns/${campaign.id}/review`] ] as const).map(([label, href]) => <Link key={href} to={href} className={`rounded-lg border px-3 py-2 text-[10px] ${href.endsWith(routeMode === "detail" ? campaign.id : `/${routeMode}`) ? "border-electric/35 bg-electric/[.07] text-electric-bright" : "border-stroke text-slate-400 hover:text-foreground"}`}>{label}</Link>)}</nav></div>
    <div className="mt-5 space-y-3">{error && <Notice tone="error">{error}</Notice>}{publishingAttempts[0] && <Notice tone={publishingAttempts[0].status === "succeeded" ? "info" : "warning"}><strong>{publishingAttempts[0].status === "succeeded" ? "Published in Demo Mode" : "Demo publishing attempt failed"}</strong><span className="block">Not live on Google Ads or Meta Ads · no provider request was made.</span><span className="mt-1 block font-mono text-[10px]">Local reference: {publishingAttempts[0].localDemoReference} · draft v{publishingAttempts[0].revision}</span>{publishingAttempts[0].failureCode && <span className="mt-1 block">Recorded cause: {publishingAttempts[0].failureCode}</span>}</Notice>}</div>
    {routeMode === "review" ? <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]"><Panel className="p-5 sm:p-7"><LabelOverline>HUMAN REVIEW · DRAFT REVISION {campaign.revision}</LabelOverline><h2 className="mt-3 font-display text-xl font-semibold text-foreground">Review this version with care.</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Approval authorizes a Tandem Ads demo publishing simulation only. It is not platform approval or permission to spend.</p><div className="mt-5">{validation ? <Notice tone={validation.valid ? "success" : "warning"}>{validation.label}{validation.issues.map((issue, i) => <p key={`${issue.code}-${i}`} className="mt-2">{issue.severity.toUpperCase()} · {issue.message}</p>)}</Notice> : <QuietButton disabled={busy} onClick={() => void run(async () => setValidation(await validateCampaignDraft(token, workspaceId, campaign.id)))}>Run local validation</QuietButton>}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><ReviewFact label="Brief" value={`${brief.businessName} · ${brief.productService} · ${INDUSTRIES.find((item) => item.key === brief.industry)?.name ?? brief.industry}`} /><ReviewFact label="Audience / region" value={`${brief.intendedCustomer} · ${brief.regions.join(", ") || brief.country}`} /><ReviewFact label="Budget" value={`${brief.budgetAmount} ${brief.currency} ${brief.budgetType} · ${brief.startDate}${brief.endDate ? ` — ${brief.endDate}` : ""}`} /><ReviewFact label="Generated source" value={plan ? `${plan.generation.label} · ${plan.generation.version}` : "Not generated"} /></div><Field label="Review note"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Add feedback or approval context…" /></Field><div className="mt-4 flex flex-wrap gap-2">{canManage && campaign.status !== "needs_review" && <PrimaryButton disabled={busy || !plan} onClick={() => void saveThen(async (saved) => submitCampaignReview(token, workspaceId, saved.id))}>Submit current revision for review</PrimaryButton>}{canApprove && campaign.status === "needs_review" && <><PrimaryButton disabled={busy} onClick={() => void run(() => decideCampaignReview(token, workspaceId, campaign.id, "approve-demo", comments))}>Approve for demo</PrimaryButton><QuietButton disabled={busy || !comments.trim()} onClick={() => void run(() => decideCampaignReview(token, workspaceId, campaign.id, "request-changes", comments))}>Request changes</QuietButton></>}{canApprove && ["approved_for_demo", "demo_published", "changes_requested"].includes(campaign.status) && <QuietButton disabled={busy} onClick={() => void run(() => decideCampaignReview(token, workspaceId, campaign.id, "reopen", comments))}>Reopen draft</QuietButton>}</div><p className="mt-4 text-[10px] text-slate-600">Editors can submit for review. Owners and admins can approve. The server checks current workspace membership for every decision.</p></Panel><aside className="space-y-4"><Panel className="p-5"><LabelOverline>REVISION & REVIEW HISTORY</LabelOverline><div className="mt-3 space-y-2 border-b border-stroke pb-4"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Saved draft versions</p>{revisions.length ? revisions.map((revision) => <div key={String(revision.id)} className="flex items-start gap-2"><span className="font-mono text-[9px] text-electric-bright">v{String(revision.revision)}</span><span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{String(revision.name)}</span><span className="shrink-0 text-[8px] text-slate-600">{new Date(String(revision.createdAt)).toLocaleDateString()}</span></div>) : <p className="text-[10px] text-slate-500">No saved revision history returned.</p>}</div><div className="mt-4 space-y-3">{reviews.length ? reviews.map((review) => <div key={String(review.id)} className="border-l border-electric/25 pl-3"><p className="text-[10px] font-semibold text-slate-200">{statusLabel[String(review.decision)] ?? String(review.decision)} · v{String(review.draft_revision)}</p><p className="mt-1 text-[9px] text-slate-500">{new Date(String(review.created_at ?? review.createdAt)).toLocaleString()}</p>{typeof review.comments === "string" && review.comments.length > 0 && <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-slate-400">{String(review.comments)}</p>}</div>) : <p className="text-[10px] text-slate-500">No review decisions saved yet.</p>}</div></Panel><Panel className="p-5"><LabelOverline>APPROVAL BOUNDARY</LabelOverline><p className="mt-3 text-xs leading-5 text-slate-400">Edits increment the draft revision and clear stale approval. Approval stays attached to the exact revision reviewed.</p></Panel></aside></div>
      : routeMode === "preview" ? <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]"><Panel className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><LabelOverline>CREATIVE STUDIO · LOCAL PREVIEW</LabelOverline><h2 className="mt-2 font-display text-lg font-semibold text-foreground">{campaign.platform === "google_ads" ? "Search result preview" : "Feed creative preview"}</h2></div><span className="rounded-full border border-indigo-300/20 bg-indigo-300/[.05] px-3 py-1.5 text-[9px] text-indigo-200">{plan?.generation.label ?? "Campaign draft"} copy</span></div>{campaign.platform === "google_ads" && googleAd ? <div className="creative-preview mt-6 max-w-[650px] rounded-xl border border-stroke bg-[#f9fafb] p-5 text-[#202124]" data-theme="light"><p className="text-[10px] text-[#5f6368]">Ad · {googleAd.finalUrl.replace(/^https?:\/\//, "").split("/")[0]}</p><a className="mt-1 block text-lg font-medium text-[#1a0dab]" href="#preview">{googleAd.headlines.slice(0, 3).join(" | ")}</a><p className="mt-2 text-xs leading-5 text-[#4d5156]">{googleAd.descriptions.slice(0, 2).join(" ")}</p><p className="mt-3 text-[9px] text-[#5f6368]">Preview only · Ad format and policy not verified.</p></div> : campaign.platform === "meta_ads" && metaAd ? <div className="creative-preview mt-6 max-w-[430px] overflow-hidden rounded-2xl border border-stroke bg-[#0b111a] shadow-2xl" data-theme="dark"><div className="flex items-center gap-3 p-4"><span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-blue-400/40 to-indigo-500/30 text-xs font-bold text-indigo-100">{brief.businessName.slice(0, 1)}</span><div><p className="text-[11px] font-semibold text-slate-100">{brief.businessName}</p><p className="mt-1 text-[9px] text-slate-500">Sponsored · Demo preview</p></div></div><p className="px-4 pb-3 text-xs leading-5 text-slate-300">{metaAd.primaryText}</p><div className="relative grid aspect-[1.35] place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_40%_30%,rgba(101,116,196,.35),transparent_48%),linear-gradient(135deg,#18243a,#111827_60%,#211a39)]">{imagePreview ? <img src={imagePreview} alt="User-provided local campaign creative preview" className="h-full w-full object-cover" /> : <div className="max-w-[250px] text-center"><span className="text-[9px] tracking-[.2em] text-indigo-200/80">LOCAL CREATIVE CANVAS</span><p className="mt-3 font-display text-xl font-semibold text-white">{brief.productService}</p><p className="mt-2 text-[10px] leading-4 text-slate-300">Original preview layout · no generated image</p></div>}<div className="absolute bottom-3 right-3 rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[8px] text-white/70">Tandem demo</div></div><div className="flex items-center justify-between gap-3 p-4"><div><p className="text-xs font-semibold text-slate-100">{metaAd.headline}</p><p className="mt-1 text-[9px] text-slate-500">{metaAd.description}</p></div><button className="rounded-lg border border-stroke bg-white/[.04] px-3 py-2 text-[9px] font-semibold text-slate-200">{metaAd.cta}</button></div></div> : <Notice tone="warning">Generate a campaign plan to see a creative preview.</Notice>}</Panel><Panel className="p-5 sm:p-6"><LabelOverline>CREATIVE INPUT</LabelOverline><h3 className="mt-2 font-display text-base font-semibold text-foreground">Use a local reference image</h3><p className="mt-2 text-[10px] leading-5 text-slate-500">Image storage is not configured. This file stays in this browser tab and is not uploaded or retained after refresh.</p><input className="mt-4 block w-full text-[10px] text-slate-400 file:mr-3 file:rounded-lg file:border file:border-stroke file:bg-panel file:px-3 file:py-2 file:text-[10px] file:text-slate-200" type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage} />{imageError && <p className="mt-2 text-[10px] text-rose-200">{imageError}</p>}<p className="mt-2 text-[9px] text-slate-600">PNG, JPEG or WebP · 5 MB max. Uploads are not saved in campaign assets.</p><div className="mt-6 border-t border-stroke pt-5"><QuietButton onClick={() => navigate(`/app/campaigns/${campaign.id}/edit`)}>Edit creative copy</QuietButton></div></Panel></div>
      : <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><Panel className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><LabelOverline>{campaign.platform === "google_ads" ? "GOOGLE SEARCH STRUCTURE" : "META CAMPAIGN STRUCTURE"}</LabelOverline><h2 className="mt-2 font-display text-lg font-semibold text-foreground">{routeMode === "detail" ? "Campaign plan" : "Edit the draft structure"}</h2></div><div className="flex gap-2">{routeMode === "detail" && <Link to={`/app/campaigns/${campaign.id}/edit`} className="rounded-lg border border-stroke px-3 py-2 text-[10px] text-slate-300">Open editor</Link>}{routeMode === "edit" && <Link to={`/app/campaigns/${campaign.id}/preview`} className="rounded-lg border border-electric/25 px-3 py-2 text-[10px] text-electric-bright">Preview creative</Link>}</div></div>
        {routeMode === "edit" ? <div className="mt-6 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Campaign objective"><Select disabled={!canManage} value={objective} onChange={(e) => changeObjective(e.target.value)}>{(campaign.platform === "google_ads" ? [["website_traffic", "Website traffic"], ["lead_generation", "Lead generation"], ["sales", "Sales"], ["awareness", "Awareness"]] : [["awareness", "Awareness"], ["traffic", "Traffic"], ["engagement", "Engagement"], ["lead_generation", "Leads"], ["app_promotion", "App promotion"], ["sales", "Sales"]]).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</Select></Field><Field label="Budget amount"><Input disabled={!canManage} type="number" min="1" value={brief.budgetAmount} onChange={(e) => changeBudgetAmount(Number(e.target.value))} /></Field><Field label="Budget type"><Select disabled={!canManage} value={brief.budgetType} onChange={(e) => changeBudgetType(e.target.value as CampaignBrief["budgetType"])}><option value="daily">Daily</option><option value="lifetime">Lifetime</option></Select></Field><Field label="Landing page"><Input disabled={!canManage} type="url" value={brief.landingPageUrl} onChange={(e) => changeLandingPage(e.target.value)} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product or service"><Input disabled={!canManage} value={brief.productService} onChange={(event) => setBrief({ ...brief, productService: event.target.value })} /></Field>
            <Field label="Primary offer"><Input disabled={!canManage} value={brief.offer} onChange={(event) => setBrief({ ...brief, offer: event.target.value })} /></Field>
            <Field label="Intended customer"><Input disabled={!canManage} value={brief.intendedCustomer} onChange={(event) => setBrief({ ...brief, intendedCustomer: event.target.value })} /></Field>
            <Field label="Country or market"><Input disabled={!canManage} value={brief.country} onChange={(event) => setBrief({ ...brief, country: event.target.value })} /></Field>
            <Field label="Cities or regions · one per line"><Textarea disabled={!canManage} value={brief.regions.join("\n")} onChange={(event) => setBrief({ ...brief, regions: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></Field>
            <Field label="Audience description"><Textarea disabled={!canManage} value={brief.audienceDescription} onChange={(event) => setBrief({ ...brief, audienceDescription: event.target.value })} /></Field>
            <Field label="Start date"><Input disabled={!canManage} type="date" value={brief.startDate} onChange={(event) => setBrief({ ...brief, startDate: event.target.value })} /></Field>
            <Field label="End date"><Input disabled={!canManage} type="date" value={brief.endDate ?? ""} onChange={(event) => setBrief({ ...brief, endDate: event.target.value || null })} /></Field>
            <Field label="Unique selling points · one per line"><Textarea disabled={!canManage} value={brief.uniqueSellingPoints.join("\n")} onChange={(event) => setBrief({ ...brief, uniqueSellingPoints: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></Field>
            <Field label="Main message"><Textarea disabled={!canManage} value={brief.mainMessage} onChange={(event) => setBrief({ ...brief, mainMessage: event.target.value })} /></Field>
          </div>
          {campaign.platform === "google_ads" && googleGroup && googleAd ? <div className="space-y-4">
            <div className="rounded-xl border border-stroke bg-surface-muted p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Ad group"><Select disabled={!canManage} value={googleGroup.id} onChange={(event) => { setGoogleGroupId(event.target.value); setGoogleAdId(null); }}>{plan?.google?.adGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>
                <QuietButton disabled={!canManage || busy || (plan?.google?.adGroups.length ?? 0) >= 30} onClick={addGoogleGroup}>Add ad group</QuietButton>
                <QuietButton disabled={!canManage || busy || (plan?.google?.adGroups.length ?? 0) <= 1} onClick={removeGoogleGroup}>Remove group</QuietButton>
                <span className="ml-auto pb-2 font-mono text-[9px] text-slate-500">{googleGroup.keywords.length} keyword themes</span>
              </div>
              <div className="mt-4 space-y-2">
                <LabelOverline>KEYWORDS · LOCAL PLANNING, NO VOLUME OR CPC FORECAST</LabelOverline>
                {googleGroup.keywords.map((keyword, index) => <div key={`${googleGroup.id}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
                  <Input disabled={!canManage} aria-label={`Keyword ${index + 1}`} value={keyword.text} onChange={(event) => editGoogle({ keywords: googleGroup.keywords.map((value, currentIndex) => currentIndex === index ? { ...value, text: event.target.value } : value) })} />
                  <Select disabled={!canManage} aria-label={`Match type for keyword ${index + 1}`} value={keyword.matchType} onChange={(event) => editGoogle({ keywords: googleGroup.keywords.map((value, currentIndex) => currentIndex === index ? { ...value, matchType: event.target.value as "broad" | "phrase" | "exact" } : value) })}><option value="broad">Broad</option><option value="phrase">Phrase</option><option value="exact">Exact</option></Select>
                  <QuietButton disabled={!canManage || busy || googleGroup.keywords.length <= 1} aria-label={`Remove keyword ${index + 1}`} onClick={() => editGoogle({ keywords: googleGroup.keywords.filter((_, currentIndex) => currentIndex !== index) })}>Remove</QuietButton>
                </div>)}
                <div className="flex gap-2"><Input disabled={!canManage} value={newKeyword} placeholder="Add a keyword theme" aria-label="New keyword theme" onChange={(event) => setNewKeyword(event.target.value)} /><PrimaryButton disabled={!canManage || busy || !newKeyword.trim() || googleGroup.keywords.length >= 100} onClick={() => { const text = newKeyword.trim(); if (!text) return; editGoogle({ keywords: [...googleGroup.keywords, { text, matchType: "phrase" }] }); setNewKeyword(""); }}>Add keyword</PrimaryButton></div>
              </div>
            </div>
            <div className="rounded-xl border border-stroke bg-surface-muted p-4">
              <div className="flex flex-wrap items-end gap-3"><Field label="Responsive search ad"><Select disabled={!canManage} value={googleAd.id} onChange={(event) => setGoogleAdId(event.target.value)}>{googleGroup.ads.map((ad, index) => <option key={ad.id} value={ad.id}>Ad variant {index + 1}</option>)}</Select></Field><QuietButton disabled={!canManage || busy || googleGroup.ads.length >= 10} onClick={addGoogleAd}>Add ad variant</QuietButton><QuietButton disabled={!canManage || busy || googleGroup.ads.length <= 1} onClick={removeGoogleAd}>Remove variant</QuietButton></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Headlines · max 30 characters each"><Textarea disabled={!canManage} value={googleAd.headlines.join("\n")} onChange={(event) => editGoogle({ headlines: event.target.value.split("\n").filter(Boolean) })} /><span className="mt-1 block text-[9px] text-slate-500">{googleAd.headlines.map((value) => value.length).join(" · ")} characters each</span></Field><Field label="Descriptions · max 90 characters each"><Textarea disabled={!canManage} value={googleAd.descriptions.join("\n")} onChange={(event) => editGoogle({ descriptions: event.target.value.split("\n").filter(Boolean) })} /><span className="mt-1 block text-[9px] text-slate-500">{googleAd.descriptions.map((value) => value.length).join(" · ")} characters each</span></Field></div>
            </div>
          </div> : campaign.platform === "meta_ads" && metaSet && metaAd ? <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><Field label="Ad set"><Select disabled={!canManage} value={metaSet.id} onChange={(event) => { setMetaSetId(event.target.value); setMetaAdId(null); }}>{plan?.meta?.adSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</Select></Field><QuietButton disabled={!canManage || busy || (plan?.meta?.adSets.length ?? 0) >= 30} onClick={addMetaSet}>Add ad set</QuietButton><QuietButton disabled={!canManage || busy || (plan?.meta?.adSets.length ?? 0) <= 1} onClick={removeMetaSet}>Remove ad set</QuietButton></div>
            <div className="grid gap-4 md:grid-cols-2"><Field label="Audience"><Textarea disabled={!canManage} value={metaSet.audience} onChange={(event) => editMeta({ audience: event.target.value })} /></Field><Field label="Locations · one per line"><Textarea disabled={!canManage} value={metaSet.locations.join("\n")} onChange={(event) => editMeta({ locations: event.target.value.split("\n").filter(Boolean) })} /></Field></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Ad set budget"><Input disabled={!canManage} type="number" min="1" value={metaSet.budgetAmount} onChange={(event) => editMeta({ budgetAmount: Number(event.target.value) })} /></Field><Field label="Budget duration"><Select disabled={!canManage} value={metaSet.budgetType} onChange={(event) => editMeta({ budgetType: event.target.value as "daily" | "lifetime" })}><option value="daily">Daily</option><option value="lifetime">Lifetime</option></Select></Field><Field label="Placement preference"><Select disabled={!canManage} value={metaSet.placements[0]} onChange={(event) => editMeta({ placements: [event.target.value as "feed" | "stories" | "reels" | "automatic"] })}><option value="automatic">Automatic</option><option value="feed">Feed</option><option value="stories">Stories</option><option value="reels">Reels</option></Select></Field></div>
            <div className="rounded-xl border border-stroke bg-surface-muted p-4"><div className="flex flex-wrap items-end gap-3"><Field label="Ad creative"><Select disabled={!canManage} value={metaAd.id} onChange={(event) => setMetaAdId(event.target.value)}>{metaSet.ads.map((ad, index) => <option key={ad.id} value={ad.id}>Ad {index + 1}</option>)}</Select></Field><QuietButton disabled={!canManage || busy || metaSet.ads.length >= 10} onClick={addMetaAd}>Add ad</QuietButton><QuietButton disabled={!canManage || busy || metaSet.ads.length <= 1} onClick={removeMetaAd}>Remove ad</QuietButton></div>
              <Field label="Primary text"><Textarea disabled={!canManage} value={metaAd.primaryText} onChange={(event) => editMeta({ primaryText: event.target.value })} /></Field><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Headline"><Input disabled={!canManage} value={metaAd.headline} onChange={(event) => editMeta({ headline: event.target.value })} /></Field><Field label="Call to action"><Input disabled={!canManage} value={metaAd.cta} onChange={(event) => editMeta({ cta: event.target.value })} /></Field><Field label="Description"><Input disabled={!canManage} value={metaAd.description} onChange={(event) => editMeta({ description: event.target.value })} /></Field><Field label="Destination URL"><Input disabled={!canManage} type="url" value={metaAd.destinationUrl} onChange={(event) => editMeta({ destinationUrl: event.target.value })} /></Field><Field label="Creative reference"><Input disabled={!canManage} value={metaAd.creativeReference ?? ""} placeholder="Optional note or approved asset name" onChange={(event) => editMeta({ creativeReference: event.target.value || null })} /></Field></div>
            </div>
          </div> : <Notice tone="warning">Generate a structured draft to edit platform-specific campaign fields.</Notice>}
          {routeMode === "edit" && usesLiveAi && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4 text-[10px] leading-5 text-amber-100"><input className="mt-1 size-4 accent-amber-300" type="checkbox" checked={externalProcessingConsent} onChange={(event) => setExternalProcessingConsent(event.target.checked)} /><span><strong>Send this brief to OpenAI for AI generation.</strong> The full campaign brief is sent to the configured OpenAI API, including business and product details, offer, landing page URL, audience and exclusions, locations, budget, and brand voice. One campaign-generation usage operation is recorded. The generated plan remains a draft for human review.</span></label>}
          <div className="flex flex-wrap gap-2 border-t border-stroke pt-5"><PrimaryButton disabled={!canManage || !dirty || busy} onClick={() => void save()}>{saveState === "saving" ? "Saving…" : "Save revision"}</PrimaryButton><QuietButton disabled={!canManage || busy || (usesLiveAi && !externalProcessingConsent)} onClick={() => void saveThen(async (saved) => { const next = usesLiveAi ? await generateCampaignOpenAI(token, workspaceId, saved.id) : await generateCampaignDemo(token, workspaceId, saved.id); setLoaded(next); setExternalProcessingConsent(false); })}>{usesLiveAi ? "Regenerate with AI" : "Regenerate demo plan"}</QuietButton><QuietButton disabled={busy} onClick={() => void run(async () => setValidation(await validateCampaignDraft(token, workspaceId, campaign.id)))}>Validate locally</QuietButton>{canManage && <QuietButton disabled={busy} onClick={() => void saveThen(async (saved) => submitCampaignReview(token, workspaceId, saved.id))}>Submit for review</QuietButton>}</div>
        </div> : <div className="mt-5 space-y-4"><ReviewFact label="Business and offer" value={`${brief.businessName} · ${brief.productService}${brief.offer ? ` · ${brief.offer}` : ""}`} /><ReviewFact label="Audience and geography" value={`${brief.intendedCustomer} · ${brief.regions.join(", ") || brief.country}`} /><ReviewFact label="Budget planning" value={`${brief.budgetAmount} ${brief.currency} ${brief.budgetType}; starts ${brief.startDate}`} />{plan && <><p className="rounded-xl border border-indigo-300/15 bg-indigo-300/[.04] px-4 py-3 text-[10px] text-indigo-100">{plan.generation.label} · {plan.generation.version}{plan.generation.mode === "simulation" ? ` · reproducible seed ${plan.generation.seed}` : ""}</p><div className="rounded-xl border border-stroke bg-surface-muted p-4"><LabelOverline>STRATEGY OVERVIEW</LabelOverline><p className="mt-2 text-xs leading-6 text-slate-300">{plan.strategy}</p></div><div className="grid gap-4 md:grid-cols-2"><div><LabelOverline>CREATIVE VARIANTS</LabelOverline><ul className="mt-2 space-y-2">{previewLines.map((line, i) => <li key={`${line}-${i}`} className="rounded-lg border border-stroke/70 bg-input px-3 py-2 text-[10px] text-slate-300">{line}</li>)}</ul></div><div><LabelOverline>LOCAL WARNINGS</LabelOverline><ul className="mt-2 space-y-2">{plan.warnings.map((warning, i) => <li key={i} className="rounded-lg border border-amber-300/10 bg-amber-300/[.025] px-3 py-2 text-[10px] leading-4 text-amber-100/80">{warning}</li>)}</ul></div></div></>}{validation && <Notice tone={validation.valid ? "success" : "warning"}>{validation.label} · {validation.issues.length} notes</Notice>}</div>}
      </Panel>
      {routeMode !== "edit" && campaign.status === "demo_published" && <Panel className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><LabelOverline>DEMO ANALYTICS</LabelOverline><h2 className="mt-2 font-display text-lg font-semibold text-foreground">Scenario report</h2></div><span className="rounded-full border border-amber-300/20 bg-amber-300/[.05] px-3 py-1.5 text-[9px] text-amber-100">Simulated Data — Not Actual Ad Performance</span></div>{analytics.length ? <><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Impressions", totals.impressions.toLocaleString()], ["Clicks", totals.clicks.toLocaleString()], ["Demo spend", `${totals.spend.toFixed(2)} ${brief.currency}`], ["Conversions", totals.conversions.toLocaleString()]].map(([label, value]) => <div key={label} className="rounded-xl border border-stroke bg-input p-4"><LabelOverline>{label}</LabelOverline><p className="mt-2 font-display text-xl font-semibold text-foreground">{value}</p></div>)}</div><p className="mt-4 text-[10px] text-slate-500">Scenario: {analytics[0]?.scenario} · deterministic seed {analytics[0]?.seed} · sourced from persisted simulation result.</p><div className="mt-5 flex h-28 items-end gap-1 rounded-xl border border-stroke bg-input p-3" aria-label="Simulated spend by day">{metrics.slice(0, 30).map((day) => <div key={day.date} title={`${day.date}: ${day.spend.toFixed(2)} ${brief.currency}`} className="min-w-1 flex-1 rounded-t bg-gradient-to-t from-electric/25 to-electric/80" style={{ height: `${Math.max(6, day.spend / Math.max(...metrics.map((v) => v.spend), 1) * 100)}%` }} />)}</div></> : <p className="mt-4 text-xs text-slate-500">No demo report was returned by storage.</p>}</Panel>}
      </div><aside className="space-y-4"><Panel className="p-5"><LabelOverline>CAMPAIGN ACTIONS</LabelOverline><p className="mt-2 text-xs text-slate-300">Revision {campaign.revision}<span className="px-1.5 text-slate-700">·</span>{campaign.approvedRevision === campaign.revision ? "Current revision approved" : "Not approved"}</p><div className="mt-4 space-y-2">{routeMode === "detail" && canManage && <QuietButton className="w-full" disabled={busy} onClick={() => void run(async () => { const copy = await duplicateCampaign(token, workspaceId, campaign.id, `${campaign.name} — copy`); navigate(`/app/campaigns/${copy.id}/edit`); })}>Duplicate draft</QuietButton>}{routeMode === "detail" && canManage && campaign.status !== "archived" && <QuietButton className="w-full" disabled={busy} onClick={() => void run(() => archiveCampaign(token, workspaceId, campaign.id))}>Archive campaign</QuietButton>}{routeMode === "edit" && <Link className="flex min-h-10 items-center justify-center rounded-xl border border-electric/25 bg-electric/[.05] text-xs text-electric-bright hover:bg-electric/10" to={`/app/creatives/new?campaignId=${encodeURIComponent(campaign.id)}`}>Create a campaign creative</Link>}{routeMode === "edit" && <Link className="flex min-h-10 items-center justify-center rounded-xl border border-stroke text-xs text-slate-300 hover:text-foreground" to={`/app/campaigns/${campaign.id}/preview`}>Open creative preview</Link>}<Link className="flex min-h-10 items-center justify-center rounded-xl border border-stroke text-xs text-slate-300 hover:text-foreground" to={`/app/campaigns/${campaign.id}/review`}>Open review history</Link></div></Panel>
        {routeMode !== "edit" && campaign.status === "approved_for_demo" && canPublish && <Panel className="p-5"><LabelOverline>DEMO PUBLISHING ONLY</LabelOverline><p className="mt-2 text-xs leading-5 text-slate-400">Creates a Tandem Ads simulation record. It cannot contact an ad platform or spend money.</p><Field label="Performance scenario"><Select value={metricsScenario} onChange={(e) => setMetricsScenario(e.target.value)}><option value="low">Low performance</option><option value="average">Average performance</option><option value="high">High performance</option><option value="gradual_improvement">Gradual improvement</option><option value="decline">Performance decline</option></Select></Field><div className="mt-3 space-y-2"><PrimaryButton className="w-full" disabled={busy} onClick={() => void run(() => simulatePublish(token, workspaceId, campaign.id, "success", metricsScenario))}>Simulate Publishing</PrimaryButton><QuietButton className="w-full" disabled={busy} onClick={() => void run(() => simulatePublish(token, workspaceId, campaign.id, "provider_unavailable", metricsScenario))}>Test demo failure + retry</QuietButton></div><p className="mt-3 text-[9px] leading-4 text-slate-600">Published in Demo Mode · Not live on Google Ads or Meta Ads</p></Panel>}
        {routeMode !== "edit" && campaign.status === "needs_review" && canApprove && <Panel className="p-5"><LabelOverline>REVIEW QUEUE</LabelOverline><p className="mt-2 text-xs leading-5 text-slate-400">A workspace owner or admin can record a demo approval or request changes.</p><Field label="Reviewer comments"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} /></Field><div className="mt-3 flex flex-col gap-2"><PrimaryButton disabled={busy} onClick={() => void run(() => decideCampaignReview(token, workspaceId, campaign.id, "approve-demo", comments || "Approved for demo use."))}>Approve for demo</PrimaryButton><QuietButton disabled={busy || !comments.trim()} onClick={() => void run(() => decideCampaignReview(token, workspaceId, campaign.id, "request-changes", comments))}>Request changes</QuietButton></div></Panel>}
        <Panel className="p-5"><LabelOverline>ACTIVITY</LabelOverline><div className="mt-3 space-y-3">{activity.length ? activity.slice(0, 8).map((event) => <div key={String(event.id)} className="flex gap-2 border-l border-electric/20 pl-3"><span className="text-[9px] font-medium text-slate-300">{String(event.event).replaceAll("_", " ")}</span><span className="ml-auto shrink-0 text-[8px] text-slate-600">{new Date(String(event.createdAt)).toLocaleDateString()}</span></div>) : <p className="text-[10px] text-slate-500">No activity recorded yet.</p>}</div></Panel>
      </aside>
    </div>}
  </div>;
}

export function CampaignStudioPage() {
  const { session } = useAuth(); const { activeWorkspace, status, error: workspaceError } = useWorkspace(); const location = useLocation(); const { campaignId } = useParams();
  const [workspaceInit, setWorkspaceInit] = useState<string | null>(null);
  useEffect(() => { if (activeWorkspace) setWorkspaceInit(activeWorkspace.id); }, [activeWorkspace]);
  if (status === "loading" || !workspaceInit) return <WorkspaceAppLayout title="Campaign Studio"><div className="mx-auto max-w-5xl px-5 py-20 text-center text-xs text-slate-500" role="status">Loading your workspace campaign data…</div></WorkspaceAppLayout>;
  if (status === "error" || !activeWorkspace) return <WorkspaceAppLayout title="Campaign Studio"><div className="mx-auto max-w-3xl px-5 py-14"><Notice tone="error">{workspaceError ?? "Workspace access could not be verified."}</Notice></div></WorkspaceAppLayout>;
  if (!session?.access_token) return null;
  const canManage = hasWorkspacePermission(activeWorkspace.role, "campaigns.manage");
  if (location.pathname.endsWith("/new")) return <WorkspaceAppLayout title="New campaign"><CampaignWizard key={activeWorkspace.id} workspace={activeWorkspace} token={session.access_token} forceSimulation={new URLSearchParams(location.search).get("onboarding") === "1"} /></WorkspaceAppLayout>;
  if (campaignId) {
    const routeMode = location.pathname.endsWith("/review") ? "review" : location.pathname.endsWith("/preview") ? "preview" : location.pathname.endsWith("/edit") ? "edit" : "detail";
    return <WorkspaceAppLayout title={routeMode === "review" ? "Review" : "Campaign editor"}><EditorView key={`${activeWorkspace.id}:${campaignId}`} workspaceId={activeWorkspace.id} token={session.access_token} campaignId={campaignId} role={activeWorkspace.role} routeMode={routeMode} forceSimulation={new URLSearchParams(location.search).get("onboarding") === "1"} /></WorkspaceAppLayout>;
  }
  return <WorkspaceAppLayout title="Campaign Studio"><CampaignList key={activeWorkspace.id} workspaceId={activeWorkspace.id} token={session.access_token} canManage={canManage} /></WorkspaceAppLayout>;
}
