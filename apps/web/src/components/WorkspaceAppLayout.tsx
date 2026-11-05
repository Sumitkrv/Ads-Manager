import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { AccountActions } from "./AccountActions";
import { BrandMark } from "./AuthLayout";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { ProductTour as TourOverlay } from "./ProductTour";
import { getProductTour, toursForRole } from "../onboarding/tours";
import { getProductTourProgress } from "../api/onboarding";

export function WorkspaceAppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const activeWorkspaceId = activeWorkspace?.id;
  const [tourId, setTourId] = useState<string | null>(null);
  const [tourStart, setTourStart] = useState(0);
  const role = activeWorkspace?.role ?? "viewer";
  const availableTours = useMemo(() => toursForRole(role, activeWorkspace?.industryKey === "marketing_agencies"), [activeWorkspace?.industryKey, role]);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const requested = query.get("tour");
    if (!requested) { setTourId(null); return; }
    if (!availableTours.some((tour) => tour.id === requested)) { setTourId(null); return; }
    const definition = getProductTour(requested);
    const explicitStart = query.has("tourStep");
    const requestedStart = Number(query.get("tourStep") ?? "0");
    if (!definition || !Number.isInteger(requestedStart) || requestedStart < 0 || requestedStart >= definition.steps.length || !session?.access_token || !activeWorkspaceId) return;
    let current = true;
    void getProductTourProgress(session.access_token, activeWorkspaceId).then((progress) => {
      if (!current) return;
      const saved = progress.find((item) => item.tourId === requested && item.status === "running");
      const start = explicitStart ? requestedStart : saved?.stepIndex ?? 0;
      setTourStart(Math.min(start, definition.steps.length - 1));
      setTourId(requested);
    }).catch(() => {
      if (!current) return;
      setTourStart(requestedStart);
      setTourId(requested);
    });
    return () => { current = false; };
  }, [activeWorkspaceId, availableTours, location.search, session?.access_token]);
  function startTour(id: string) {
    if (!availableTours.some((tour) => tour.id === id)) return;
    setTourStart(0);
    setTourId(id);
  }
  function startRecommendedTour() {
    startTour(role === "viewer" ? "viewer-reporting" : role === "editor" ? "campaign-studio" : activeWorkspace?.industryKey === "marketing_agencies" ? "agency-command-center" : "owner-overview");
  }
  function closeTour() {
    setTourId(null);
    const query = new URLSearchParams(location.search);
    query.delete("tour"); query.delete("tourStep");
    navigate({ pathname: location.pathname, search: query.toString() ? "?" + query.toString() : "" }, { replace: true });
  }
  const navClass = ({ isActive }: { isActive: boolean }) =>
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition-colors " +
    (isActive ? "bg-electric/10 text-electric-bright" : "text-slate-400 hover:bg-surface-hover hover:text-slate-200");

  return (
    <div className="min-h-screen bg-midnight text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[270px] flex-col border-r border-stroke bg-rail px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-1">
          <BrandMark />
          <div><p className="font-display text-sm font-semibold text-foreground">Tandem Ads</p><p className="mt-1 text-[9px] tracking-[0.18em] text-slate-500">BUSINESS WORKSPACES</p></div>
        </div>
        <div className="mt-9" data-tour-id="workspace-switcher"><WorkspaceSwitcher /></div>
        <nav aria-label="Workspace navigation" className="mt-8 space-y-1">
          <p className="mb-2 px-3 text-[9px] font-semibold tracking-[0.18em] text-slate-600">WORKSPACE</p>
          <NavLink className={navClass} data-tour-id="nav-overview" end to="/app"><span aria-hidden="true">◫</span>Overview</NavLink>
          <NavLink className={navClass} data-tour-id="nav-campaigns" to="/app/campaigns"><span aria-hidden="true">▤</span>Campaign Studio</NavLink>
          <NavLink className={navClass} data-tour-id="nav-optimization" to="/app/optimization"><span aria-hidden="true">⌁</span>Optimization Studio</NavLink>
          <NavLink className={navClass} data-tour-id="nav-analytics" to="/app/analytics"><span aria-hidden="true">▥</span>Analytics</NavLink>
          <NavLink className={navClass} data-tour-id="nav-reports" to="/app/reports"><span aria-hidden="true">▤</span>Reports</NavLink>
          <NavLink className={navClass} to="/app/automation"><span aria-hidden="true">⤳</span>Automation</NavLink>
          <NavLink className={navClass} data-tour-id="nav-creatives" to="/app/creatives"><span aria-hidden="true">✳</span>Creative Studio</NavLink>
          <NavLink className={navClass} data-tour-id="nav-brand-kit" to="/app/brand-kit"><span aria-hidden="true">◈</span>Brand Kit</NavLink>
          <NavLink className={navClass} to="/app/assets"><span aria-hidden="true">▧</span>Asset Library</NavLink>
          <NavLink className={navClass} data-tour-id="nav-billing" to="/app/billing"><span aria-hidden="true">◒</span>Billing & plans</NavLink>
          <NavLink className={navClass} to="/app/support"><span aria-hidden="true">◌</span>Support</NavLink>
          <NavLink className={navClass} to="/app/integrations"><span aria-hidden="true">↗</span>Integrations & measurement</NavLink>
          <p className="mb-2 mt-6 px-3 text-[9px] font-semibold tracking-[0.18em] text-slate-600">COLLABORATION</p>
          <NavLink className={navClass} data-tour-id="nav-agency" to="/app/agency"><span aria-hidden="true">◉</span>Agency Command Center</NavLink>
          <NavLink className={navClass} data-tour-id="nav-client-portal" to="/app/client/overview"><span aria-hidden="true">⌂</span>Client Portal</NavLink>
          <NavLink className={navClass} data-tour-id="nav-getting-started" to="/app/getting-started"><span aria-hidden="true">↗</span>Getting Started</NavLink>
          <NavLink className={navClass} to="/app/settings"><span aria-hidden="true">⚙</span>Settings Center</NavLink>
          <NavLink className={navClass} to="/app/settings/workspace"><span aria-hidden="true">⌘</span>Business settings</NavLink>
        </nav>
        <div className="mt-auto border-t border-stroke pt-4">
          <div className="px-2 pb-3"><AccountActions /></div>
          <p className="px-2 text-[10px] leading-5 text-slate-600">Workspace access follows your current membership and role.</p>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[270px]">
        <header className="border-b border-stroke/80 px-4 py-3 sm:px-7 lg:px-9">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div className="flex shrink-0 items-center gap-2"><BrandMark /><span className="font-display text-xs font-semibold text-foreground">Tandem Ads</span></div>
            <div className="min-w-0 flex-1" data-tour-id="workspace-switcher"><WorkspaceSwitcher compact /></div>
            <ThemeSwitcher />
          </div>
          <div className="hidden min-h-12 items-center justify-between lg:flex">
            <p className="text-xs tracking-[0.08em] text-slate-500">TANDEM ADS <span className="px-2 text-slate-700">/</span>{title.toUpperCase()}</p>
            <ThemeSwitcher />
          </div>
          <nav aria-label="Mobile account actions" className="mt-3 flex items-center gap-5 overflow-x-auto border-t border-stroke/60 pt-3 lg:hidden">
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-overview" end to="/app">Overview</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-campaigns" to="/app/campaigns">Campaigns</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-optimization" to="/app/optimization">Optimization</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-analytics" to="/app/analytics">Analytics</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-reports" to="/app/reports">Reports</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" to="/app/automation">Automation</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-creatives" to="/app/creatives">Creatives</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-brand-kit" to="/app/brand-kit">Brand Kit</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" to="/app/assets">Assets</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-billing" to="/app/billing">Billing</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" to="/app/support">Support</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" to="/app/integrations">Integrations</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-agency" to="/app/agency">Agency</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-client-portal" to="/app/client/overview">Client Portal</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" data-tour-id="nav-getting-started" to="/app/getting-started">Getting Started</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" to="/app/settings">Settings</NavLink>
            <NavLink className="shrink-0 text-[11px] text-slate-300" to="/app/settings/workspace">Business settings</NavLink>
            <button className="shrink-0 text-[11px] text-electric-bright" onClick={startRecommendedTour} type="button">Guided tour</button>
            <AccountActions />
          </nav>
        </header>
        <div className="fixed bottom-5 right-5 z-30 hidden lg:block">
          <button aria-label="Start a guided product tour" className="rounded-full border border-stroke bg-panel px-4 py-3 text-xs font-semibold text-foreground shadow-card hover:border-electric/40" onClick={startRecommendedTour} type="button">Guided tour</button>
        </div>
        {children}
      </main>
      {tourId && session?.access_token && activeWorkspace && getProductTour(tourId) && <TourOverlay key={tourId} onClose={closeTour} startIndex={tourStart} token={session.access_token} tour={getProductTour(tourId)!} workspaceId={activeWorkspace.id} />}
    </div>
  );
}
