import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AuthGuestRoute, HomeRoute, ProtectedRoute } from "./auth/RouteGuards";
import { AuthLayout } from "./components/AuthLayout";
import { supabaseConfiguration } from "./auth/supabase";
import { WorkspaceProvider } from "./workspace/WorkspaceProvider";
import { WorkspaceRequiredRoute } from "./workspace/WorkspaceRouteGuard";

const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((page) => ({ default: page.ForgotPasswordPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((page) => ({ default: page.LoginPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((page) => ({ default: page.ProfilePage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((page) => ({ default: page.ResetPasswordPage })));
const SignupPage = lazy(() => import("./pages/SignupPage").then((page) => ({ default: page.SignupPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((page) => ({ default: page.DashboardPage })));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage").then((page) => ({ default: page.OnboardingPage })));
const GettingStartedPage = lazy(() => import("./pages/GettingStartedPage").then((page) => ({ default: page.GettingStartedPage })));
const WorkspaceSettingsPage = lazy(() => import("./pages/WorkspaceSettingsPage").then((page) => ({ default: page.WorkspaceSettingsPage })));
const SettingsCenterPage = lazy(() => import("./pages/SettingsCenterPage").then((page) => ({ default: page.SettingsCenterPage })));
const TrackingCenterPage = lazy(() => import("./pages/TrackingCenterPage").then((page) => ({ default: page.TrackingCenterPage })));
const CampaignStudioPage = lazy(() => import("./pages/CampaignStudioPage").then((page) => ({ default: page.CampaignStudioPage })));
const CreativeStudioPage = lazy(() => import("./pages/CreativeStudioPage").then((page) => ({ default: page.CreativeStudioPage })));
const BrandKitPage = lazy(() => import("./pages/BrandAssetPages").then((page) => ({ default: page.BrandKitPage })));
const AssetLibraryPage = lazy(() => import("./pages/BrandAssetPages").then((page) => ({ default: page.AssetLibraryPage })));
const OptimizationStudioPage = lazy(() => import("./pages/OptimizationStudioPage").then((page) => ({ default: page.OptimizationStudioPage })));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage").then((page) => ({ default: page.AnalyticsPage })));
const ReportsLibraryPage = lazy(() => import("./pages/ReportPages").then((page) => ({ default: page.ReportsLibraryPage })));
const ReportBuilderPage = lazy(() => import("./pages/ReportPages").then((page) => ({ default: page.ReportBuilderPage })));
const ReportDetailPage = lazy(() => import("./pages/ReportPages").then((page) => ({ default: page.ReportDetailPage })));
const AgencyCommandCenterPage = lazy(() => import("./pages/AgencyCommandCenterPage").then((page) => ({ default: page.AgencyCommandCenterPage })));
const ClientPortalPage = lazy(() => import("./pages/AgencyCommandCenterPage").then((page) => ({ default: page.AgencyCommandCenterPage })));
const InvitationAcceptancePage = lazy(() => import("./pages/AgencyCommandCenterPage").then((page) => ({ default: page.InvitationAcceptancePage })));
const BillingPage = lazy(() => import("./pages/BillingPages").then((page) => ({ default: page.BillingPage })));
const PricingPage = lazy(() => import("./pages/BillingPages").then((page) => ({ default: page.PricingPage })));
const BillingAdminPage = lazy(() => import("./pages/BillingPages").then((page) => ({ default: page.BillingAdminPage })));
const PlatformAdminPage = lazy(() => import("./pages/PlatformAdminPages").then((page) => ({ default: page.PlatformAdminPage })));
const WorkspaceSupportPage = lazy(() => import("./pages/PlatformAdminPages").then((page) => ({ default: page.WorkspaceSupportPage })));

function RouteLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-midnight px-6 text-slate-200">
      <p className="text-sm" role="status">Loading Tandem Ads…</p>
    </main>
  );
}

function SupabaseSetupRequired() {
  return (
    <AuthLayout
      eyebrow="AUTHENTICATION SETUP REQUIRED"
      title="Connect a Supabase project"
      description="Sign-in is unavailable until this application is configured with your Supabase project. No demo account or authentication bypass is provided."
      footer={<span>After setup, reload this page to continue.</span>}
    >
      <div className="space-y-5">
        <div className="auth-message auth-message-info">
          <p className="font-medium text-slate-100">Required frontend variables</p>
          <ul className="mt-3 space-y-2 font-mono text-xs text-electric-bright">
            {supabaseConfiguration.missing.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
        <div className="auth-message auth-message-info">
          <p className="font-medium text-slate-100">Required API variables</p>
          <p className="mt-3 font-mono text-xs leading-6 text-slate-300">SUPABASE_URL<br />SUPABASE_PUBLISHABLE_KEY</p>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Add the values to the local workspace env files described in <code className="text-slate-300">docs/supabase-setup.md</code>. Use only the publishable key in the browser. Never place a secret or service-role key in Vite configuration.
        </p>
      </div>
    </AuthLayout>
  );
}

function ConfiguredRoutes() {
  const { configured } = useAuth();
  if (!configured) return <SupabaseSetupRequired />;

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<AuthGuestRoute><LoginPage /></AuthGuestRoute>} />
        <Route path="/signup" element={<AuthGuestRoute><SignupPage /></AuthGuestRoute>} />
        <Route path="/forgot-password" element={<AuthGuestRoute><ForgotPasswordPage /></AuthGuestRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/app/getting-started" element={<ProtectedRoute><WorkspaceRequiredRoute><GettingStartedPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/app/settings" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/team" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/defaults" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/preferences" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/notifications" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/security" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/data" element={<ProtectedRoute><WorkspaceRequiredRoute><SettingsCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/invitations/accept" element={<ProtectedRoute><InvitationAcceptancePage /></ProtectedRoute>} />
        <Route path="/app/agency" element={<ProtectedRoute><WorkspaceRequiredRoute><AgencyCommandCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/agency/clients" element={<ProtectedRoute><WorkspaceRequiredRoute><AgencyCommandCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/agency/team" element={<ProtectedRoute><WorkspaceRequiredRoute><AgencyCommandCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/agency/assignments" element={<ProtectedRoute><WorkspaceRequiredRoute><AgencyCommandCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/agency/activity" element={<ProtectedRoute><WorkspaceRequiredRoute><AgencyCommandCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/agency/settings" element={<ProtectedRoute><WorkspaceRequiredRoute><AgencyCommandCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/client/overview" element={<ProtectedRoute><WorkspaceRequiredRoute><ClientPortalPage portal /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/client/campaigns" element={<ProtectedRoute><WorkspaceRequiredRoute><ClientPortalPage portal /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/client/creatives" element={<ProtectedRoute><WorkspaceRequiredRoute><ClientPortalPage portal /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/client/approvals" element={<ProtectedRoute><WorkspaceRequiredRoute><ClientPortalPage portal /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/client/reports" element={<ProtectedRoute><WorkspaceRequiredRoute><ClientPortalPage portal /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/client/requests" element={<ProtectedRoute><WorkspaceRequiredRoute><ClientPortalPage portal /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/billing" element={<ProtectedRoute><WorkspaceRequiredRoute><BillingPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/billing/plans" element={<ProtectedRoute><WorkspaceRequiredRoute><BillingPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/billing/usage" element={<ProtectedRoute><WorkspaceRequiredRoute><BillingPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/billing/history" element={<ProtectedRoute><WorkspaceRequiredRoute><BillingPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/billing/settings" element={<ProtectedRoute><WorkspaceRequiredRoute><BillingPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/platform-admin/billing" element={<ProtectedRoute><BillingAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/tenants" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/tenants/:workspaceId" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/users" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/users/:userId" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/usage" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/health" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/audit" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/support" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/support/:caseId" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/platform-admin/settings" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
        <Route path="/app/support" element={<ProtectedRoute><WorkspaceRequiredRoute><WorkspaceSupportPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/integrations" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/readiness" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/goals" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/events" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/mappings" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/utm-builder" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/implementation" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/tracking/diagnostics" element={<ProtectedRoute><WorkspaceRequiredRoute><TrackingCenterPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/campaigns" element={<ProtectedRoute><WorkspaceRequiredRoute><CampaignStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/campaigns/new" element={<ProtectedRoute><WorkspaceRequiredRoute><CampaignStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/campaigns/:campaignId" element={<ProtectedRoute><WorkspaceRequiredRoute><CampaignStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/campaigns/:campaignId/edit" element={<ProtectedRoute><WorkspaceRequiredRoute><CampaignStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/campaigns/:campaignId/review" element={<ProtectedRoute><WorkspaceRequiredRoute><CampaignStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/campaigns/:campaignId/preview" element={<ProtectedRoute><WorkspaceRequiredRoute><CampaignStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/creatives" element={<ProtectedRoute><WorkspaceRequiredRoute><CreativeStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/creatives/new" element={<ProtectedRoute><WorkspaceRequiredRoute><CreativeStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/creatives/:creativeId" element={<ProtectedRoute><WorkspaceRequiredRoute><CreativeStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/creatives/:creativeId/edit" element={<ProtectedRoute><WorkspaceRequiredRoute><CreativeStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/creatives/:creativeId/preview" element={<ProtectedRoute><WorkspaceRequiredRoute><CreativeStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/brand-kit" element={<ProtectedRoute><WorkspaceRequiredRoute><BrandKitPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/assets" element={<ProtectedRoute><WorkspaceRequiredRoute><AssetLibraryPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/optimization" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/optimization/recommendations" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/optimization/scenarios" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/optimization/creative-insights" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/optimization/history" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/automation" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/automation/new" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/automation/executions" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/automation/:ruleId" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/automation/:ruleId/edit" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/notifications" element={<ProtectedRoute><WorkspaceRequiredRoute><OptimizationStudioPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/analytics" element={<ProtectedRoute><WorkspaceRequiredRoute><AnalyticsPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/analytics/campaigns" element={<ProtectedRoute><WorkspaceRequiredRoute><AnalyticsPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/analytics/platforms" element={<ProtectedRoute><WorkspaceRequiredRoute><AnalyticsPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/analytics/creatives" element={<ProtectedRoute><WorkspaceRequiredRoute><AnalyticsPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/reports" element={<ProtectedRoute><WorkspaceRequiredRoute><ReportsLibraryPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/reports/new" element={<ProtectedRoute><WorkspaceRequiredRoute><ReportBuilderPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/reports/:reportId" element={<ProtectedRoute><WorkspaceRequiredRoute><ReportDetailPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/reports/:reportId/edit" element={<ProtectedRoute><WorkspaceRequiredRoute><ReportBuilderPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="/app/settings/workspace" element={<ProtectedRoute><WorkspaceRequiredRoute><WorkspaceSettingsPage /></WorkspaceRequiredRoute></ProtectedRoute>} />
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <WorkspaceProvider>
          <ConfiguredRoutes />
        </WorkspaceProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
