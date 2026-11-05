import { createContext, useContext } from "react";
import type { CreateWorkspaceInput, WorkspaceWithRole } from "@ai-ads/shared";

export type WorkspaceState = {
  userId: string | null;
  status: "loading" | "ready" | "error";
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  error: string | null;
};

export type WorkspaceContextValue = WorkspaceState & {
  activeWorkspace: WorkspaceWithRole | null;
  refresh: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<WorkspaceWithRole>;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider.");
  return context;
}
