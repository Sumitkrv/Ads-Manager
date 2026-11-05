import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import { WorkspaceAccessStatus } from "../workspace/WorkspaceRouteGuard";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { getWorkspacePreferences } from "../api/settings";

export function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-midnight px-6 text-slate-200">
      <div className="flex items-center gap-3 text-sm" role="status">
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-electric/35 border-t-electric-bright" />
        Restoring your secure session…
      </div>
    </main>
  );
}

export function safeAppDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/app";
  }
  const pathname = value.split(/[?#]/, 1)[0] ?? "";
  if (pathname !== "/app" && !pathname.startsWith("/app/")) return "/app";
  return value;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { configured, loading, session, sessionExpired } = useAuth();
  const location = useLocation();

  if (!configured) return <Navigate to="/login" replace />;
  if (loading) return <SessionLoading />;
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search,
          ...(sessionExpired ? { notice: "Your session expired. Sign in again to continue." } : {}),
        }}
      />
    );
  }
  return children;
}

export function AuthGuestRoute({ children }: { children: ReactNode }) {
  const { configured, loading, session } = useAuth();
  const location = useLocation();

  if (!configured) return <Navigate to="/login" replace />;
  if (loading) return <SessionLoading />;
  if (session) {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeAppDestination(from)} replace />;
  }
  return children;
}

export function HomeRoute() {
  const { configured, loading, session } = useAuth();
  const workspace = useWorkspace();
  const [landingDestination, setLandingDestination] = useState<string | null>(null);
  useEffect(() => {
    const workspaceId = workspace.activeWorkspaceId;
    const token = session?.access_token;
    if (!workspaceId || !token || workspace.status !== "ready") { setLandingDestination(null); return; }
    let active = true;
    void getWorkspacePreferences(token, workspaceId).then((preferences) => {
      if (!active) return;
      setLandingDestination(({ overview: "/app", campaigns: "/app/campaigns", analytics: "/app/analytics", reports: "/app/reports" } as const)[preferences.defaultLandingPage]);
    }).catch(() => { if (active) setLandingDestination("/app"); });
    return () => { active = false; };
  }, [session?.access_token, workspace.activeWorkspaceId, workspace.status]);
  if (loading) return <SessionLoading />;
  if (!configured || !session) return <Navigate to="/login" replace />;
  if (workspace.status === "loading") return <SessionLoading />;
  if (workspace.status === "error") {
    return <WorkspaceAccessStatus title="Workspace access could not be checked" message={workspace.error ?? "Try again after your connection is restored."} retry={() => void workspace.refresh()} />;
  }
  if (!workspace.workspaces.length) return <Navigate to="/onboarding" replace />;
  return landingDestination ? <Navigate to={landingDestination} replace /> : <SessionLoading />;
}
