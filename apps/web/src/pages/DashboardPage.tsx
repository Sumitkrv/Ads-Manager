import { useEffect, useState } from "react";
import type { HealthResponse } from "@ai-ads/shared";
import { Link } from "react-router";
import { getHealth } from "../api/health";
import { ApiRequestError, getCurrentUser } from "../api/me";
import { useAuth } from "../auth/AuthProvider";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import { WorkspaceRequiredRoute } from "../workspace/WorkspaceRouteGuard";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { getWorkspaceIndustryName } from "../workspace/industryLabels";

type ApiState =
  | { status: "checking" }
  | { status: "connected"; health: HealthResponse }
  | { status: "unavailable" };

type IdentityState =
  | { status: "checking" }
  | { status: "verified" }
  | { status: "unavailable"; message: string };

const futureModules = [
  { title: "Business profile & Brand Kit", description: "Save industry, business context, colors, voice and creative preferences.", status: "Ready" },
  { title: "Campaign Studio", description: "Create offline campaign drafts, generate a plan and follow workspace review.", status: "Ready" },
  { title: "Creative Studio", description: "Build editable designs and attach authorized private assets to a campaign.", status: "Ready" },
  { title: "Analytics & reports", description: "Review stored simulated metrics and workspace-scoped report definitions.", status: "Demo data" },
  { title: "Optimization", description: "Review recommendations derived from simulated campaign data.", status: "Demo data" },
  { title: "Agency collaboration", description: "Create relationship requests and invitations through existing authorization flows.", status: "Ready" },
];

function StatusDot({ tone }: { tone: "blue" | "green" | "muted" | "red" }) {
  const toneClass = {
    blue: "bg-electric-bright shadow-[0_0_12px_rgba(111,143,255,0.65)]",
    green: "bg-emerald-400",
    muted: "bg-slate-500",
    red: "bg-rose-400",
  }[tone];
  return <span aria-hidden="true" className={`size-2 rounded-full ${toneClass}`} />;
}

function ConnectionStatus({ state }: { state: ApiState }) {
  if (state.status === "checking") return <div className="flex items-center gap-2 text-xs text-slate-400" role="status"><StatusDot tone="blue" />Checking API connection</div>;
  if (state.status === "unavailable") return <div className="flex items-center gap-2 text-xs text-rose-200" role="status"><StatusDot tone="red" />API unavailable. Check the backend and reload.</div>;
  return <div className="flex items-center gap-2 text-xs text-slate-300" role="status"><StatusDot tone="green" />Connected to {state.health.service}<span className="text-slate-600">·</span><span className="font-mono text-[10px] text-slate-500">v{state.health.version}</span></div>;
}

function DashboardContent() {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [apiState, setApiState] = useState<ApiState>({ status: "checking" });
  const [identity, setIdentity] = useState<IdentityState>({ status: "checking" });

  useEffect(() => {
    let current = true;
    getHealth().then((health) => {
      if (current) setApiState({ status: "connected", health });
    }).catch(() => {
      if (current) setApiState({ status: "unavailable" });
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    const token = session?.access_token;
    if (!token) {
      setIdentity({ status: "unavailable", message: "Session not available." });
      return () => { current = false; };
    }
    setIdentity({ status: "checking" });
    getCurrentUser(token).then(() => {
      if (current) setIdentity({ status: "verified" });
    }).catch((error: unknown) => {
      if (!current) return;
      setIdentity({
        status: "unavailable",
        message: error instanceof ApiRequestError ? error.message : "API identity check failed.",
      });
    });
    return () => { current = false; };
  }, [session?.access_token]);

  if (!activeWorkspace) return null;
  const industryName = getWorkspaceIndustryName(activeWorkspace);
  const apiTone = apiState.status === "connected" ? "green" : apiState.status === "unavailable" ? "red" : "blue";

  return (
    <WorkspaceAppLayout title="Overview">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-8 sm:px-7 sm:pt-11 lg:px-10 lg:pt-14">
        <section aria-labelledby="welcome-title">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-electric-bright"><span>BUSINESS WORKSPACE</span><span aria-hidden="true" className="text-slate-600">/</span><span className="text-slate-500">{industryName.toUpperCase()}</span></div>
          <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-4xl lg:text-[48px]" id="welcome-title">{activeWorkspace.name}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">A workspace for your {industryName.toLocaleLowerCase()} business. Company information and advertising drafts stay scoped to this workspace.</p><Link className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-electric px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover" to="/app/getting-started">Open Getting Started <span aria-hidden="true" className="ml-2">→</span></Link></div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-stroke bg-panel px-3.5 py-3"><span className="grid size-7 place-items-center rounded-full border border-electric/30 bg-electric/10 text-[10px] font-semibold text-electric-bright">{activeWorkspace.role.slice(0, 1).toUpperCase()}</span><span><span className="block text-[9px] tracking-wide text-slate-500">YOUR ROLE</span><span className="mt-1 block text-xs font-medium capitalize text-slate-200">{activeWorkspace.role}</span></span></div>
          </div>
        </section>

        <section aria-labelledby="connection-heading" className="mt-8 rounded-2xl border border-stroke bg-panel p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div><p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">PLATFORM STATUS</p><h2 className="mt-2 font-display text-lg font-semibold text-foreground" id="connection-heading">Verified workspace access</h2><div className="mt-3"><ConnectionStatus state={apiState} /></div><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]" role="status"><span className="text-slate-500">Authenticated API</span><span className="text-slate-700">·</span>{identity.status === "checking" ? <span className="text-slate-400">Verifying current session</span> : identity.status === "verified" ? <span className="text-electric-bright">Identity verified by the API</span> : <span className="text-rose-200">{identity.message}</span>}</div></div>
            <div className="flex items-center gap-3 rounded-xl border border-stroke bg-midnight/70 px-4 py-3"><StatusDot tone={apiTone} /><div><p className="text-[10px] text-slate-500">API health</p><p className="mt-1 text-xs font-medium text-slate-200">{apiState.status === "connected" ? "Operational" : apiState.status === "checking" ? "Checking" : "Unavailable"}</p></div></div>
          </div>
        </section>

        <section aria-labelledby="configuration-heading" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">WORKSPACE CONFIGURATION</p><h2 className="mt-2 font-display text-xl font-semibold text-foreground" id="configuration-heading">Business foundation</h2></div><p className="text-[10px] text-slate-500">Saved workspace data · no campaign metrics</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-stroke bg-panel/75 p-4"><p className="text-[10px] tracking-wide text-slate-500">INDUSTRY</p><p className="mt-3 text-sm font-medium text-slate-100">{industryName}</p><p className="mt-1 text-[10px] text-slate-500">Workspace classification</p></article>
            <article className="rounded-xl border border-stroke bg-panel/75 p-4"><p className="text-[10px] tracking-wide text-slate-500">BUSINESS WEBSITE</p><p className="mt-3 truncate text-sm font-medium text-slate-100">{activeWorkspace.websiteUrl ?? "Not provided"}</p><p className="mt-1 text-[10px] text-slate-500">Saved business profile</p></article>
            <article className="rounded-xl border border-stroke bg-panel/75 p-4"><p className="text-[10px] tracking-wide text-slate-500">ADVERTISING ACCOUNTS</p><p className="mt-3 text-sm font-medium text-slate-100">Provider connections</p><p className="mt-1 text-[10px] text-slate-500">Review verified accounts for this workspace</p><Link className="mt-3 inline-flex text-[10px] font-semibold text-electric-bright hover:text-foreground" to="/app/integrations">Open integrations <span aria-hidden="true" className="ml-1">→</span></Link></article>
            <article className="rounded-xl border border-stroke bg-panel/75 p-4"><p className="text-[10px] tracking-wide text-slate-500">WORKSPACE ACCESS</p><p className="mt-3 text-sm font-medium text-slate-100">{activeWorkspace.role} membership</p><p className="mt-1 text-[10px] text-slate-500">Verified against current membership</p></article>
          </div>
        </section>

        <section aria-labelledby="modules-heading" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">WORKSPACE TOOLS</p><h2 className="mt-2 font-display text-xl font-semibold text-foreground" id="modules-heading">Tools available to your business</h2></div><p className="text-[10px] text-slate-500">Draft and simulation state is labeled in each module</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {futureModules.map((module, index) => <article className="rounded-xl border border-stroke bg-panel/55 p-4 sm:p-5" key={module.title}><div className="flex items-start justify-between gap-4"><span className="font-mono text-[10px] text-electric-bright/80">{String(index + 1).padStart(2, "0")}</span><span className="rounded-full border border-stroke px-2.5 py-1 text-[9px] font-medium text-slate-500">{module.status}</span></div><h3 className="mt-5 text-sm font-semibold text-slate-100">{module.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{module.description}</p></article>)}
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-2 border-t border-stroke pt-5 text-[10px] text-slate-600 sm:flex-row sm:justify-between"><span>Tandem Ads · {activeWorkspace.name}</span><span>Workspace access is checked by the API and PostgreSQL policies.</span></footer>
      </div>
    </WorkspaceAppLayout>
  );
}

export function DashboardPage() {
  return <WorkspaceRequiredRoute><DashboardContent /></WorkspaceRequiredRoute>;
}
