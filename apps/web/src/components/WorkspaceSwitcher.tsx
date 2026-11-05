import { useState } from "react";
import { Link } from "react-router";
import { INDUSTRIES } from "@ai-ads/shared";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { getWorkspaceIndustryName } from "../workspace/industryLabels";
import { WorkspaceApiError } from "../api/workspaces";

function roleName(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { activeWorkspace, refresh, selectWorkspace, status, workspaces } = useWorkspace();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(workspaceId: string) {
    setSwitching(true);
    setError("");
    try {
      await selectWorkspace(workspaceId);
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError ? caught.message : "Workspace access could not be confirmed.");
      if (caught instanceof WorkspaceApiError && (caught.status === 401 || caught.status === 404)) void refresh();
    } finally {
      setSwitching(false);
    }
  }

  if (status === "loading") {
    return <div aria-label="Loading workspaces" className="h-14 animate-pulse rounded-xl border border-stroke bg-surface-muted" />;
  }

  if (!workspaces.length || !activeWorkspace) {
    return (
      <Link className="workspace-create-link" to="/onboarding">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg border border-electric/30 bg-electric/10 text-lg text-electric-bright">+</span>
        <span><span className="block text-xs font-medium text-foreground">Create a workspace</span><span className="mt-1 block text-[10px] text-slate-500">Set up a business</span></span>
      </Link>
    );
  }

  const currentIndustry = getWorkspaceIndustryName(activeWorkspace);
  return (
    <div className="min-w-0 rounded-xl border border-stroke bg-surface-muted p-2.5">
      <label className="mb-1 block px-1 text-[9px] font-semibold tracking-[0.16em] text-slate-500" htmlFor={compact ? "mobile-workspace" : "sidebar-workspace"}>
        ACTIVE WORKSPACE
      </label>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-electric/10 text-[10px] font-semibold text-electric-bright">
          {activeWorkspace.name.trim().slice(0, 2).toUpperCase() || "TA"}
        </span>
        <select
          aria-label="Switch workspace"
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          disabled={switching}
          id={compact ? "mobile-workspace" : "sidebar-workspace"}
          onChange={(event) => void handleChange(event.currentTarget.value)}
          value={activeWorkspace.id}
        >
          {workspaces.map((workspace) => {
            const industry = INDUSTRIES.find((item) => item.key === workspace.industryKey);
            const label = workspace.industryKey === "other" && workspace.industryCustomLabel
              ? workspace.industryCustomLabel
              : industry?.name ?? "Business";
            return <option key={workspace.id} value={workspace.id}>{workspace.name} · {label} · {roleName(workspace.role)}</option>;
          })}
        </select>
      </div>
      <p className="mt-2 truncate pl-10 text-[10px] text-slate-500">{currentIndustry} · {roleName(activeWorkspace.role)}</p>
      {error && <p className="mt-2 px-1 text-[10px] leading-4 text-rose-300" role="alert">{error}</p>}
      {compact ? (
        <Link aria-label="Create another workspace" className="mt-2 inline-flex pl-10 text-[10px] font-medium text-electric-bright hover:text-foreground" to="/onboarding">+ New workspace</Link>
      ) : (
        <Link className="mt-2 inline-flex pl-10 text-[10px] font-medium text-electric-bright hover:text-foreground" to="/onboarding">
          Create another workspace <span aria-hidden="true" className="ml-1">↗</span>
        </Link>
      )}
    </div>
  );
}
