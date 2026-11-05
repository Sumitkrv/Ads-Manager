import { Link, NavLink, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { SettingsTeamPage } from "./SettingsTeamPage";
import { SettingsPreferencesPage } from "./SettingsPreferencesPage";
import { SettingsSecurityPage } from "./SettingsSecurityPage";
import { SettingsDataPage } from "./SettingsDataPage";
import { SettingsDefaultsPage } from "./SettingsDefaultsPage";

const base = "/app/settings";
const navItems = [
  { label: "Overview", href: base, icon: "◫", end: true },
  { label: "Personal profile", href: "/app/profile", icon: "◉" },
  { label: "Business identity", href: `${base}/workspace`, icon: "⌂" },
  { label: "Team & access", href: `${base}/team`, icon: "♙", roles: ["owner", "admin"] },
  { label: "Workspace defaults", href: `${base}/defaults`, icon: "⌘", roles: ["owner", "admin"] },
  { label: "Preferences", href: `${base}/preferences`, icon: "◐" },
  { label: "Notifications", href: `${base}/notifications`, icon: "◌" },
  { label: "Security", href: `${base}/security`, icon: "◇" },
  { label: "Data & privacy", href: `${base}/data`, icon: "▤" },
] as const;

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="mb-6 border-b border-stroke pb-5"><p className="text-[10px] font-semibold tracking-[0.19em] text-electric-bright">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">{title}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{description}</p></header>;
}

function SettingsOverview() {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const role = activeWorkspace?.role ?? "viewer";
  const links = [
    { title: "Brand Kit", copy: "Manage the existing logo, colors, voice and creative defaults.", href: "/app/brand-kit", label: "Open Brand Kit", icon: "◈" },
    { title: "Billing & plan", copy: "Review the active demo plan, usage, seats and plan requests.", href: "/app/billing/settings", label: "Review billing", icon: "◒" },
    ...(activeWorkspace?.industryKey === "marketing_agencies" ? [{ title: "Agency Command Center", copy: "Open authorized client relationships and agency collaboration.", href: "/app/agency/settings", label: "Open agency", icon: "◉" }] : []),
    { title: "Integration status", copy: "Review configured advertising integrations and their current status.", href: "/app/integrations", label: "Review integrations", icon: "↗" },
  ];
  return <>
    <SectionTitle eyebrow="SETTINGS CENTER" title="One place for your workspace" description="Manage your account, workspace access and working preferences. Each section follows your current account and workspace permissions." />
    <section className="rounded-2xl border border-electric/20 bg-gradient-to-br from-electric/[.10] via-panel to-panel p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-semibold tracking-[.18em] text-electric-bright">CURRENT WORKSPACE</p><h3 className="mt-2 font-display text-xl font-semibold text-foreground">{activeWorkspace?.name ?? "Workspace unavailable"}</h3><p className="mt-1.5 text-xs text-slate-400">{activeWorkspace?.industryCustomLabel || activeWorkspace?.industryKey.replaceAll("_", " ") || "Workspace"} · {role.charAt(0).toUpperCase() + role.slice(1)}</p></div><span className="rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-[10px] text-slate-400">{user?.email ?? "Account"}</span></div>
      <p className="mt-5 max-w-2xl text-xs leading-5 text-slate-500">Settings made here stay with the selected workspace. Switch workspaces from the app navigation to manage a different business.</p>
    </section>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((item) => <article className="rounded-2xl border border-stroke bg-panel p-5 transition-colors hover:border-electric/25" key={item.title}><span className="grid size-9 place-items-center rounded-xl border border-electric/20 bg-electric/[.07] text-base text-electric-bright" aria-hidden="true">{item.icon}</span><h3 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{item.copy}</p><Link className="mt-4 inline-flex text-xs font-semibold text-electric-bright hover:text-foreground" to={item.href}>{item.label}<span aria-hidden="true" className="ml-2">→</span></Link></article>)}
    </div>
    <section className="mt-5 rounded-2xl border border-stroke bg-panel p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-sm font-semibold text-foreground">Workspace access</h3><p className="mt-1 text-xs text-slate-500">{role === "owner" ? "You own this workspace and can manage its settings and team." : role === "admin" ? "You can manage operational settings and eligible team roles." : `Your ${role} membership has read access to permitted workspace settings.`}</p></div>{role === "owner" || role === "admin" ? <Link className="rounded-lg border border-stroke px-3 py-2 text-[11px] font-medium text-slate-300 hover:border-electric/30 hover:text-foreground" to={`${base}/team`}>Manage team</Link> : <span className="rounded-full border border-stroke px-3 py-1.5 text-[10px] text-slate-500">Administration is restricted</span>}</div></section>
  </>;
}

export function SettingsCenterPage() {
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();
  const role = activeWorkspace?.role ?? "viewer";
  const path = location.pathname;
  const section = path === base ? "Overview" : path.split("/").at(-1)?.replaceAll("-", " ") ?? "Settings";
  const visibleItems = navItems.filter((item) => !("roles" in item) || role === "owner" || role === "admin");

  let content = <SettingsOverview />;
  if (path === `${base}/team`) content = <SettingsTeamPage />;
  else if (path === `${base}/preferences`) content = <SettingsPreferencesPage />;
  else if (path === `${base}/notifications`) content = <SettingsPreferencesPage notificationsOnly />;
  else if (path === `${base}/security`) content = <SettingsSecurityPage />;
  else if (path === `${base}/data`) content = <SettingsDataPage />;
  else if (path === `${base}/defaults`) content = <SettingsDefaultsPage />;

  return <WorkspaceAppLayout title={`Settings · ${section}`}>
    <div className="mx-auto max-w-[1370px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-stroke pb-5">
        <div><p className="text-[10px] font-semibold tracking-[.19em] text-electric-bright">ACCOUNT & WORKSPACE</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-.04em] text-foreground">Settings</h1><p className="mt-2 text-xs text-slate-500">{activeWorkspace?.name ?? "Current workspace"} · personal settings stay with your account</p></div>
        <Link className="rounded-lg border border-stroke bg-panel px-3 py-2 text-[11px] font-medium text-slate-300 hover:border-electric/30 hover:text-foreground" to="/app">← Back to workspace</Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-[215px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-2xl border border-stroke bg-panel/70 p-2 lg:sticky lg:top-5 lg:h-fit lg:flex-col lg:overflow-visible">
          {visibleItems.map((item) => <NavLink key={item.href} end={"end" in item ? item.end : false} to={item.href} className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-medium transition-colors ${isActive ? "bg-electric/10 text-electric-bright" : "text-slate-400 hover:bg-surface-hover hover:text-foreground"}`}><span aria-hidden="true" className="w-4 text-center">{item.icon}</span>{item.label}</NavLink>)}
          <p className="mt-2 hidden border-t border-stroke px-3 pt-3 text-[9px] font-semibold tracking-[.15em] text-slate-600 lg:block">SHORTCUTS</p>
          <Link className="hidden rounded-xl px-3 py-2 text-[11px] text-slate-500 hover:bg-surface-hover hover:text-foreground lg:block" to="/app/assets">Asset Library ↗</Link>
          {activeWorkspace?.industryKey === "marketing_agencies" && <Link className="hidden rounded-xl px-3 py-2 text-[11px] text-slate-500 hover:bg-surface-hover hover:text-foreground lg:block" to="/app/agency/settings">Agency management ↗</Link>}
          <Link className="hidden rounded-xl px-3 py-2 text-[11px] text-slate-500 hover:bg-surface-hover hover:text-foreground lg:block" to="/app/billing/settings">Billing settings ↗</Link>
          <Link className="hidden rounded-xl px-3 py-2 text-[11px] text-slate-500 hover:bg-surface-hover hover:text-foreground lg:block" to="/app/integrations">Integration status ↗</Link>
        </nav>
        <main className="min-w-0">{content}</main>
      </div>
    </div>
  </WorkspaceAppLayout>;
}
