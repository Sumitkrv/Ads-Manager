import type { ReactNode } from "react";
import { Link, Navigate } from "react-router";
import { useWorkspace } from "./WorkspaceContext";

export function WorkspaceAccessStatus({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-5 py-12 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-stroke bg-panel p-6 sm:p-8" aria-labelledby="workspace-status-title">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-electric-bright">WORKSPACE ACCESS</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-foreground" id="workspace-status-title">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {retry && <button className="rounded-lg bg-electric-bright px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-primary-hover" onClick={retry} type="button">Try again</button>}
          <Link className="rounded-lg border border-stroke px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-foreground" to="/app/profile">Personal profile</Link>
        </div>
      </section>
    </main>
  );
}

export function WorkspaceRequiredRoute({ children }: { children: ReactNode }) {
  const { activeWorkspace, error, refresh, status, workspaces } = useWorkspace();
  if (status === "loading") {
    return <main className="grid min-h-[70vh] place-items-center bg-midnight px-6 text-slate-200"><p className="text-sm" role="status">Verifying workspace membership…</p></main>;
  }
  if (status === "error") {
    return <WorkspaceAccessStatus title="Workspace access could not be checked" message={error ?? "Try again after your connection is restored."} retry={() => void refresh()} />;
  }
  if (!workspaces.length || !activeWorkspace) return <Navigate to="/onboarding" replace />;
  return children;
}

export function WorkspaceEntryRoute({ children }: { children: ReactNode }) {
  const { activeWorkspace, error, refresh, status, workspaces } = useWorkspace();
  if (status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-midnight px-6 text-slate-200"><p className="text-sm" role="status">Confirming your workspace access…</p></main>;
  }
  if (status === "error") {
    return <WorkspaceAccessStatus title="Workspace access could not be checked" message={error ?? "Try again after your connection is restored."} retry={() => void refresh()} />;
  }
  if (!workspaces.length || !activeWorkspace) return <Navigate to="/onboarding" replace />;
  return children;
}
