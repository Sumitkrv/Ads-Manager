export type TourStep = { target: string; title: string; body: string };
export type ProductTour = {
  id: string;
  title: string;
  audience: "owner" | "agency" | "editor" | "viewer" | "platform";
  steps: TourStep[];
};

export const PRODUCT_TOURS: readonly ProductTour[] = [
  {
    id: "owner-overview",
    title: "Workspace overview",
    audience: "owner",
    steps: [
      { target: "workspace-switcher", title: "Workspace context", body: "Switch between workspaces you are authorized to access. Each keeps its records and membership separate." },
      { target: "nav-overview", title: "Workspace overview", body: "Return to your selected workspace overview and its current business context." },
      { target: "nav-campaigns", title: "Campaign Studio", body: "Create a campaign draft, generate an offline plan, then use the existing review and demo publishing flow." },
      { target: "nav-creatives", title: "Creative Studio", body: "Build and save editable creative layouts with your workspace Brand Kit and private assets." },
      { target: "nav-optimization", title: "Optimization Studio", body: "Review recommendations built from Tandem Ads demo data. Actions remain local and follow approval permissions." },
      { target: "nav-analytics", title: "Demo analytics", body: "Review simulated performance stored from Tandem Ads demo publishing. It is not actual ad performance." },
      { target: "nav-reports", title: "Reports", body: "Create workspace-scoped report definitions and exports from the available demo data." },
      { target: "nav-billing", title: "Plan and usage", body: "Review current subscription simulation, usage and plan limits for this workspace." },
    ],
  },
  {
    id: "campaign-studio",
    title: "Campaign Studio",
    audience: "editor",
    steps: [
      { target: "nav-campaigns", title: "Start with a draft", body: "Campaign Studio saves a workspace draft before any review or publishing action." },
      { target: "campaign-new", title: "Build and generate", body: "Describe the goal, audience and budget preference, then generate an offline rule-based plan for human review." },
    ],
  },
  {
    id: "creative-studio",
    title: "Creative Studio",
    audience: "editor",
    steps: [
      { target: "nav-brand-kit", title: "Brand context", body: "Configure approved workspace colors, voice and CTA preferences." },
      { target: "nav-creatives", title: "Editable creative projects", body: "Create a typography-based canvas or upload an authorized workspace asset." },
      { target: "creative-project-list", title: "Saved work", body: "Creative projects are stored in this workspace and can be reopened after refresh." },
    ],
  },
  {
    id: "analytics",
    title: "Analytics and reporting",
    audience: "editor",
    steps: [
      { target: "nav-analytics", title: "Workspace metrics", body: "Analytics is scoped to this workspace and uses saved demo publishing records." },
      { target: "analytics-source-label", title: "Data provenance", body: "Look for the simulation label. These numbers are not actual Google or Meta performance." },
      { target: "nav-reports", title: "Share a report", body: "Saved reports and exports follow workspace role and access rules." },
    ],
  },
  {
    id: "agency-command-center",
    title: "Agency Command Center",
    audience: "agency",
    steps: [
      { target: "nav-agency", title: "Agency workspace", body: "Manage agency-owned team and collaboration records from this workspace." },
      { target: "agency-clients", title: "Client directory", body: "Client workspaces remain client-owned. A relationship request does not grant access by itself." },
      { target: "agency-team", title: "Team and invitations", body: "Use the authorized invitation flow. New links are created, not emailed." },
      { target: "nav-reports", title: "Client reporting", body: "Open reports only for workspaces your current membership allows." },
    ],
  },
  {
    id: "client-portal",
    title: "Client Portal",
    audience: "viewer",
    steps: [
      { target: "nav-client-portal", title: "Your client workspace", body: "Review visible campaign and collaboration activity in the workspace that invited you." },
      { target: "client-reports", title: "Read-only reporting", body: "Reports show stored simulation data and do not imply a live provider connection." },
    ],
  },
  {
    id: "viewer-reporting",
    title: "Read-only workspace tour",
    audience: "viewer",
    steps: [
      { target: "workspace-switcher", title: "Authorized workspaces", body: "The workspace switcher lists only workspaces where you have membership." },
      { target: "nav-campaigns", title: "Campaign visibility", body: "View campaign status and review history without editing or publishing." },
      { target: "nav-analytics", title: "Workspace reporting", body: "Analytics and reports are scoped to this workspace and clearly labeled as simulated." },
    ],
  },
] as const;

export function toursForRole(role: string, agency = false): ProductTour[] {
  if (role === "viewer") return PRODUCT_TOURS.filter((tour) => tour.audience === "viewer");
  if (role === "editor") return PRODUCT_TOURS.filter((tour) => tour.audience === "editor");
  if (agency) return PRODUCT_TOURS.filter((tour) => tour.audience === "agency" || tour.audience === "editor" || tour.audience === "owner");
  return PRODUCT_TOURS.filter((tour) => tour.audience === "owner" || tour.audience === "editor");
}

export function getProductTour(id: string): ProductTour | undefined {
  return PRODUCT_TOURS.find((tour) => tour.id === id);
}

const PLATFORM_TOUR_SECTIONS = [
  { capability: "platform.tenants.read", target: "platform-nav-tenants", title: "Tenant directory", body: "Review workspace metadata and lifecycle state. Customer campaign and creative content stays outside this directory." },
  { capability: "platform.users.read", target: "platform-nav-users", title: "Account directory", body: "Review account metadata available to your assigned platform capability." },
  { capability: "platform.usage.read", target: "platform-nav-usage", title: "Workspace usage", body: "Usage panels show stored resource counts and plan records, not live advertising spend." },
  { capability: "platform.health.read", target: "platform-nav-health", title: "Service health", body: "Health indicators are based on measured service checks and report unavailable dependencies explicitly." },
  { capability: "platform.support.manage", target: "platform-nav-support", title: "Support queue", body: "Support cases are internal records. A request for diagnostics does not grant access to customer content." },
  { capability: "platform.audit.read", target: "platform-nav-audit", title: "Audit center", body: "Review privileged actions recorded by the platform operations system." },
  { capability: "platform.settings.manage", target: "platform-nav-settings", title: "Settings and flags", body: "Operational changes use the existing server-side capability checks and audited update flow." },
] as const;

export function getPlatformOperatorTour(capabilities: Readonly<Record<string, boolean>>): ProductTour | undefined {
  if (capabilities["platform.dashboard.read"] !== true) return undefined;
  const steps: TourStep[] = [
    { target: "platform-page-title", title: "Restricted operations console", body: "This console is available only through server-verified platform capabilities. Your tour shows only areas enabled for your account." },
    ...PLATFORM_TOUR_SECTIONS.filter((section) => capabilities[section.capability] === true)
      .map(({ target, title, body }) => ({ target, title, body })),
  ];
  return steps.length > 1 ? { id: "platform-operator", title: "Platform operations", audience: "platform", steps } : undefined;
}
