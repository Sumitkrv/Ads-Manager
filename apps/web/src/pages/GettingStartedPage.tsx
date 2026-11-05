import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import { getBillingSummary } from "../api/billing";
import { getWorkspaceActivation, recordActivationEvent } from "../api/onboarding";
import type { WorkspaceActivationResponse } from "@ai-ads/shared";
import { PRODUCT_TOURS, toursForRole } from "../onboarding/tours";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { getWorkspaceIndustryName } from "../workspace/industryLabels";

type BillingSummary = {
  mode?: string;
  subscription?: { status?: string; trialEndsAt?: string | null };
  plan?: { name?: string };
  remaining?: Record<string, number | null>;
};

const helpTopics = [
  { title: "Workspace", text: "A workspace contains one business or agency’s profile, members, campaigns, creative files, reports, and activation progress. Membership and database policies control who can access it." },
  { title: "Role", text: "Owner and admin roles manage settings and approvals. Editors can prepare campaign and creative drafts. Viewers can read permitted workspace information." },
  { title: "Campaign draft", text: "A campaign draft stores its platform format, brief, plan, revisions, and review state inside Tandem Ads. A platform name describes the draft format; it does not connect an ad account." },
  { title: "Creative", text: "Creative Studio saves editable project documents and private workspace assets. A typography layout can be saved without an uploaded image." },
  { title: "Demo publishing", text: "Demo publishing requires the current campaign review flow and creates a local Tandem Ads record. It does not publish to Google or Meta and does not spend money." },
  { title: "Simulated analytics", text: "Analytics are generated from saved demo publishing records. They are labeled as simulated and are not actual provider performance." },
  { title: "Optimization recommendation", text: "Recommendations are local decision-support records based on simulated campaign data. Any action still follows the workspace review and approval permissions." },
  { title: "Usage and subscription", text: "Plan limits and trial state are shown by the existing Tandem Ads billing simulation. A displayed plan or invoice is not proof of payment." },
  { title: "Agency and client access", text: "An agency relationship request is collaboration metadata. Client workspace access requires the existing invitation and membership flow; client billing stays separate." },
];

function ErrorState({ children, onRetry }: { children: string; onRetry: () => void }) {
  return <div className="rounded-2xl border border-danger/25 bg-danger-surface p-5 text-sm text-danger" role="alert"><p>{children}</p><button className="mt-3 rounded-lg border border-danger/30 px-3 py-2 text-xs font-medium" onClick={onRetry} type="button">Try again</button></div>;
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  return <svg aria-label={`${percent}% setup complete`} className="size-32 -rotate-90" role="img" viewBox="0 0 100 100">
    <circle className="stroke-surface-muted" cx="50" cy="50" fill="none" r={radius} strokeWidth="8" />
    <circle className="stroke-electric" cx="50" cy="50" fill="none" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} strokeLinecap="round" strokeWidth="8" />
    <text className="fill-foreground" dominantBaseline="middle" fontSize="20" fontWeight="700" textAnchor="middle" transform="rotate(90 50 50)" x="50" y="47">{percent}%</text>
    <text className="fill-slate-500" dominantBaseline="middle" fontSize="6" letterSpacing="1" textAnchor="middle" transform="rotate(90 50 50)" x="50" y="62">ACTIVATED</text>
  </svg>;
}

function tourPath(id: string): string {
  if (id === "campaign-studio") return "/app/campaigns?tour=campaign-studio";
  if (id === "creative-studio") return "/app/creatives?tour=creative-studio";
  if (id === "analytics") return "/app/analytics?tour=analytics";
  if (id === "agency-command-center") return "/app/agency?tour=agency-command-center";
  if (id === "client-portal") return "/app/client/overview?tour=client-portal";
  return "/app?tour=" + encodeURIComponent(id);
}

function activationHref(item: NonNullable<WorkspaceActivationResponse["items"][number]>) {
  return item.id === "first-campaign" || item.id === "offline-plan" ? "/app/campaigns/new?onboarding=1" : item.href;
}

function TourTitle({ id }: { id: string }) {
  return <>{PRODUCT_TOURS.find((tour) => tour.id === id)?.title ?? "Product tour"}</>;
}

export function GettingStartedPage() {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const token = session?.access_token;
  const [storedActivation, setStoredActivation] = useState<WorkspaceActivationResponse | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingWorkspaceId, setBillingWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDemoAck, setSavingDemoAck] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const workspaceRef = useRef(workspaceId);
  const refreshSequence = useRef(0);
  workspaceRef.current = workspaceId;

  const refresh = useCallback(async () => {
    if (!token || !workspaceId) return;
    const sequence = ++refreshSequence.current;
    const stillCurrent = () => sequence === refreshSequence.current && workspaceRef.current === workspaceId;
    setLoading(true);
    setError("");
    try {
      const result = await getWorkspaceActivation(token, workspaceId);
      if (!stillCurrent()) return;
      setStoredActivation(result);
      void getBillingSummary(token, workspaceId).then((value) => { if (stillCurrent()) { setBilling(value); setBillingWorkspaceId(workspaceId); } }).catch(() => { if (stillCurrent()) { setBilling(null); setBillingWorkspaceId(null); } });
    } catch (caught) {
      if (!stillCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Workspace activation could not be loaded.");
      setStoredActivation(null);
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  }, [token, workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredHelp = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? helpTopics.filter((item) => (item.title + " " + item.text).toLocaleLowerCase().includes(term)) : helpTopics;
  }, [search]);
  const role = activeWorkspace?.role ?? "viewer";
  const agency = activeWorkspace?.industryKey === "marketing_agencies";
  const tours = useMemo(() => toursForRole(role, agency), [agency, role]);
  const activation = storedActivation?.workspaceId === workspaceId ? storedActivation : null;
  const currentBilling = billingWorkspaceId === workspaceId ? billing : null;
  const nextItem = activation?.items.find((item) => item.required && !item.completed) ?? null;
  const completedMilestones = activation?.items.filter((item) => item.completed && item.completedAt)
    .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt))).slice(0, 3) ?? [];
  const industry = activeWorkspace ? getWorkspaceIndustryName(activeWorkspace) : "your business";

  async function confirmDemoMode() {
    if (!token || !workspaceId || savingDemoAck) return;
    setSavingDemoAck(true); setNotice("");
    try {
      await recordActivationEvent(token, workspaceId, "demo_mode_reviewed");
      setNotice("Demo mode review saved for this workspace.");
      await refresh();
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Demo mode acknowledgement could not be saved."); }
    finally { setSavingDemoAck(false); }
  }

  return <WorkspaceAppLayout title="Getting Started">
    <main className="mx-auto max-w-[1320px] space-y-7 px-4 pb-16 pt-7 sm:px-7 lg:px-10 lg:py-10">
      <section className="relative overflow-hidden rounded-[28px] border border-stroke bg-panel p-6 shadow-card sm:p-9 lg:p-11">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full border border-electric/10 bg-electric/[.035]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-10 top-10 size-44 rounded-full border border-electric/10" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[.2em] text-electric-bright">YOUR ACTIVATION SPACE</p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-.035em] text-foreground sm:text-4xl lg:text-5xl">A clear path from workspace to first campaign.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Welcome to {activeWorkspace?.name ?? "your workspace"}. Work through the steps at your pace; your saved setup stays available when you return.</p>
            <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-[10px] text-muted-foreground">{industry}</span><span className="rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-[10px] capitalize text-muted-foreground">{role} access</span>{activation?.completedAt && <span className="rounded-full border border-success/25 bg-success-surface px-3 py-1.5 text-[10px] text-success">Onboarding completed {new Date(activation.completedAt).toLocaleDateString()}</span>}</div>
            <div className="mt-7 flex flex-wrap gap-3">
              {nextItem ? <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-electric px-5 py-3 text-xs font-semibold text-primary-foreground shadow-card transition hover:bg-primary-hover" to={activationHref(nextItem)}>{nextItem.id === "first-campaign" ? "Create your first campaign" : nextItem.id === "brand-kit" ? "Set up your Brand Kit" : "Continue setup"}<span aria-hidden="true" className="ml-3">→</span></Link> : <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-electric px-5 py-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover" to={role === "viewer" ? "/app/analytics" : "/app/campaigns/new"}>{role === "viewer" ? "Open workspace reporting" : "Start another campaign"}<span aria-hidden="true" className="ml-3">→</span></Link>}
              {activeWorkspace && (role === "owner" || role === "admin") && <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stroke bg-surface-muted px-4 py-3 text-xs font-medium text-foreground transition hover:bg-surface-hover" to="/app/brand-kit">Brand Kit <span aria-hidden="true" className="ml-2">↗</span></Link>}
              <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stroke px-4 py-3 text-xs font-medium text-foreground transition hover:bg-surface-hover" onClick={() => { const target = document.getElementById("product-tours"); target?.scrollIntoView({ behavior: "smooth", block: "start" }); }} type="button">Explore a tour</button>
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-stroke bg-surface-muted/70 p-4 sm:p-5 lg:flex-col lg:gap-2 lg:border-0 lg:bg-transparent lg:p-0">
            {loading ? <div aria-label="Loading activation progress" className="grid size-32 place-items-center rounded-full border-8 border-surface-muted" role="status"><span className="sr-only">Loading activation progress</span></div> : <ProgressRing percent={activation?.percent ?? 0} />}
            <div className="lg:text-center"><p className="text-sm font-semibold text-foreground">{loading ? "Checking progress" : `${activation?.completed ?? 0} of ${activation?.total ?? 0} steps complete`}</p><p className="mt-1 max-w-40 text-[10px] leading-4 text-muted-foreground">Progress comes from your saved workspace records.</p></div>
          </div>
        </div>
      </section>

      {error && <ErrorState onRetry={() => void refresh()}>{error}</ErrorState>}
      {notice && <p className="rounded-xl border border-info/20 bg-info-surface px-4 py-3 text-xs text-info" role="status">{notice}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
        <section aria-labelledby="checklist-heading" className="rounded-2xl border border-stroke bg-surface p-5 shadow-card sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">WORKSPACE CHECKLIST</p><h2 className="mt-2 font-display text-2xl font-semibold text-foreground" id="checklist-heading">Your next useful steps</h2><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Each check reflects a saved resource or a validated workspace event. Steps outside your role are optional.</p></div><button aria-label="Refresh activation checklist" className="rounded-lg border border-stroke px-3 py-2 text-[10px] font-medium text-foreground hover:bg-surface-hover" disabled={loading} onClick={() => void refresh()} type="button">Refresh</button></div>
          <div className="mt-6 space-y-2">
            {loading && !activation ? <div className="rounded-xl border border-stroke bg-surface-muted p-6 text-xs text-muted-foreground" role="status">Loading saved activation state…</div> : activation?.items.map((item, index) => <article className={`rounded-xl border p-4 transition ${item.completed ? "border-success/20 bg-success-surface/45" : nextItem?.id === item.id ? "border-electric/30 bg-electric/[.04]" : "border-stroke bg-surface-muted/55"}`} key={item.id}>
              <div className="flex items-start gap-3"><span aria-label={item.completed ? "Completed" : item.required ? "Incomplete" : "Optional"} className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${item.completed ? "border-success/30 bg-success-surface text-success" : item.required ? "border-stroke text-muted-foreground" : "border-stroke/70 text-subtle-foreground"}`}>{item.completed ? "✓" : String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-semibold text-foreground">{item.title}</h3>{!item.required && <span className="rounded-full border border-stroke px-2 py-0.5 text-[8px] text-subtle-foreground">Optional</span>}{item.completed && item.completedAt && <span className="text-[9px] text-success">Saved {new Date(item.completedAt).toLocaleDateString()}</span>}</div><p className="mt-1 text-[10px] leading-5 text-muted-foreground">{item.description}</p>{item.guidance && <p className="mt-1 text-[9px] leading-4 text-subtle-foreground">{item.guidance}</p>}
                {item.id === "demo-mode" && !item.completed && <div className="mt-3"><button className="rounded-lg border border-electric/25 bg-electric/10 px-3 py-2 text-[10px] font-semibold text-electric-bright disabled:opacity-50" disabled={savingDemoAck} onClick={() => void confirmDemoMode()} type="button">{savingDemoAck ? "Saving…" : "I understand demo mode"}</button></div>}
                {item.required && !item.completed && <Link className="mt-3 inline-flex text-[10px] font-semibold text-electric-bright hover:text-foreground" to={activationHref(item)}>{item.id === "first-campaign" ? "Create your first campaign" : item.id === "brand-kit" ? "Open Brand Kit" : "Open this step"}<span aria-hidden="true" className="ml-1">→</span></Link>}
              </div></div>
            </article>)}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-stroke bg-surface p-5 shadow-card sm:p-6">
            <p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">RECENT MILESTONES</p><h2 className="mt-2 font-display text-lg font-semibold text-foreground">Saved progress</h2>
            {completedMilestones.length ? <ol className="mt-4 space-y-3">{completedMilestones.map((item) => <li className="flex gap-3" key={item.id}><span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-electric" /><span><span className="block text-[11px] font-medium text-foreground">{item.title}</span><time className="mt-1 block text-[9px] text-muted-foreground" dateTime={item.completedAt ?? undefined}>{new Date(item.completedAt!).toLocaleString()}</time></span></li>)}</ol> : <p className="mt-4 rounded-xl border border-dashed border-stroke px-4 py-5 text-xs leading-5 text-muted-foreground">Your first saved milestone will appear here after an activation step is completed.</p>}
          </section>

          <section className="rounded-2xl border border-stroke bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">PLAN AWARENESS</p><h2 className="mt-2 font-display text-lg font-semibold text-foreground">Workspace usage</h2></div><span className="rounded-full border border-warning/25 bg-warning-surface px-2.5 py-1 text-[8px] text-warning">SIMULATION</span></div>
            {currentBilling?.subscription && currentBilling.plan ? <><p className="mt-3 text-xs text-muted-foreground">{currentBilling.plan.name} · {currentBilling.subscription.status?.replaceAll("_", " ")}</p>{currentBilling.subscription.status === "trialing" && currentBilling.subscription.trialEndsAt && <p className="mt-2 text-[10px] text-muted-foreground">Trial ends {new Date(currentBilling.subscription.trialEndsAt).toLocaleDateString()}</p>}<div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(currentBilling.remaining ?? {}).filter(([, remaining]) => remaining !== null).slice(0, 4).map(([key, remaining]) => <div className="rounded-xl border border-stroke bg-surface-muted p-3" key={key}><p className="truncate text-[9px] text-subtle-foreground">{key.replaceAll("_", " ")}</p><p className="mt-1 text-sm font-semibold text-foreground">{remaining} left</p></div>)}</div></> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Subscription state and quotas are provided by the existing workspace billing module. No checkout or payment is started here.</p>}
            <p className="mt-4 text-[9px] leading-4 text-subtle-foreground">A Tandem Ads plan state is not evidence of payment.</p><Link className="mt-3 inline-flex text-[10px] font-semibold text-electric-bright" to="/app/billing">Open billing and usage <span aria-hidden="true" className="ml-1">→</span></Link>
          </section>

          <section className="rounded-2xl border border-stroke bg-surface p-5 shadow-card sm:p-6">
            <p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">BUSINESS CONTEXT</p><h2 className="mt-2 font-display text-lg font-semibold text-foreground">Useful campaign starting points</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">For {industry.toLocaleLowerCase()}, start with one verifiable offer and a clear audience. {agency ? "Agency relationship requests need client acceptance before workspace access." : "These planning details prefill the existing campaign brief."}</p><Link className="mt-4 inline-flex text-[10px] font-semibold text-electric-bright" to={agency ? "/app/agency" : "/app/campaigns/new"}>{agency ? "Open agency collaboration" : "Open Campaign Studio"} <span aria-hidden="true" className="ml-1">→</span></Link>
          </section>
        </aside>
      </div>

      <section className="grid gap-6 lg:grid-cols-2" id="demo-mode">
        <article className="rounded-2xl border border-warning/20 bg-warning-surface/45 p-5 sm:p-7">
          <p className="text-[10px] font-semibold tracking-[.18em] text-warning">DEMO MODE · NO EXTERNAL ACTIVITY</p><h2 className="mt-2 font-display text-xl font-semibold text-foreground">Your campaigns stay inside Tandem Ads.</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">Offline Rule-Based Generation creates editable draft content. Review and demo publishing use saved Tandem Ads records. This campaign has not been published to Google or Meta, and no advertising budget or spend is changed.</p><p className="mt-3 text-[10px] font-semibold text-foreground">“This campaign exists in Tandem Ads demo mode. It has not been published to Google or Meta.”</p>
          {!activation?.items.find((item) => item.id === "demo-mode")?.completed && <button className="mt-4 rounded-lg border border-warning/25 px-3 py-2 text-[10px] font-semibold text-warning" disabled={savingDemoAck} onClick={() => void confirmDemoMode()} type="button">{savingDemoAck ? "Saving…" : "I understand"}</button>}
        </article>
        <article className="rounded-2xl border border-stroke bg-surface p-5 sm:p-7" id="business-profile"><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">SETUP DETAILS</p><h2 className="mt-2 font-display text-xl font-semibold text-foreground">Business information stays editable.</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">Update your workspace name, website, region and business profile from settings. Marketing preferences live with this workspace’s onboarding record and can be revisited through the setup flow.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="rounded-lg border border-stroke px-3 py-2 text-[10px] font-medium text-foreground hover:bg-surface-hover" to="/app/settings/workspace">Business settings</Link>{(role === "owner" || role === "admin") && <Link className="rounded-lg border border-electric/25 bg-electric/10 px-3 py-2 text-[10px] font-semibold text-electric-bright" to="/app/brand-kit">Configure Brand Kit</Link>}</div></article>
      </section>

      <section aria-labelledby="product-tours" className="rounded-2xl border border-stroke bg-surface p-5 shadow-card sm:p-7" id="product-tours">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">LEARN BY DOING</p><h2 className="mt-2 font-display text-2xl font-semibold text-foreground">Guided product tours</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Tours follow your current role and workspace type. Skip, restart or reopen them whenever you need.</p></div><span className="text-[9px] text-subtle-foreground">{role} view</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tours.map((tour) => <article className="rounded-xl border border-stroke bg-surface-muted/60 p-4" key={tour.id}><p className="text-[9px] font-semibold tracking-[.13em] text-electric-bright">{tour.audience.toUpperCase()} TOUR</p><h3 className="mt-2 text-sm font-semibold text-foreground"><TourTitle id={tour.id} /></h3><p className="mt-2 min-h-10 text-[10px] leading-5 text-muted-foreground">{tour.steps[0]?.body}</p><Link className="mt-4 inline-flex text-[10px] font-semibold text-electric-bright hover:text-foreground" to={tourPath(tour.id)}>Start or restart <span aria-hidden="true" className="ml-1">→</span></Link></article>)}</div>
      </section>

      {agency && <section className="rounded-2xl border border-electric/20 bg-electric/[.035] p-5 sm:p-7"><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">AGENCY ACTIVATION</p><h2 className="mt-2 font-display text-xl font-semibold text-foreground">Client work starts with authorization.</h2><p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">Complete the agency profile, create a client collaboration request and use the invitation link from Agency Command Center. Tandem Ads creates the link; it does not email it. The client must accept before membership or workspace access is granted.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="rounded-lg bg-electric px-4 py-2.5 text-[10px] font-semibold text-primary-foreground" to="/app/agency">Open Agency Command Center</Link><Link className="rounded-lg border border-stroke px-4 py-2.5 text-[10px] font-medium text-foreground" to="/app/agency/clients">Client directory</Link></div></section>}

      <section className="rounded-2xl border border-stroke bg-surface p-5 shadow-card sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">LOCAL HELP CENTER</p><h2 className="mt-2 font-display text-2xl font-semibold text-foreground">Find a product explanation</h2><p className="mt-2 text-xs text-muted-foreground">Search concise guides for concepts used in Tandem Ads.</p></div><input aria-label="Search help topics" className="min-h-10 w-full max-w-sm rounded-xl border border-stroke bg-input px-3 text-xs text-foreground outline-none focus:border-electric/60" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search workspace, campaign, billing…" value={search} /></div>
        {filteredHelp.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredHelp.map((item) => <details className="group rounded-xl border border-stroke bg-surface-muted/50 p-4" key={item.title}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-foreground">{item.title}<span aria-hidden="true" className="text-electric-bright transition group-open:rotate-45">＋</span></summary><p className="mt-3 text-[10px] leading-5 text-muted-foreground">{item.text}</p></details>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-stroke p-5 text-xs text-muted-foreground">No help topics match “{search}”. Try another product term.</p>}
      </section>
    </main>
  </WorkspaceAppLayout>;
}
