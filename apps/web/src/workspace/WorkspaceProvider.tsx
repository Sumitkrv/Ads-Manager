import {
  type CreateWorkspaceInput,
} from "@ai-ads/shared";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createWorkspace as createWorkspaceRequest, getWorkspace, getWorkspaces, WorkspaceApiError } from "../api/workspaces";
import { useAuth } from "../auth/AuthProvider";
import { WorkspaceContext, type WorkspaceContextValue, type WorkspaceState } from "./WorkspaceContext";
const EMPTY_STATE: WorkspaceState = {
  userId: null,
  status: "loading",
  workspaces: [],
  activeWorkspaceId: null,
  error: null,
};

function preferenceKey(userId: string): string {
  return "tandem-ads.active-workspace." + userId;
}

function readPreference(userId: string): string | null {
  try {
    return window.localStorage.getItem(preferenceKey(userId));
  } catch {
    return null;
  }
}

function writePreference(userId: string, workspaceId: string | null): void {
  try {
    if (workspaceId) window.localStorage.setItem(preferenceKey(userId), workspaceId);
    else window.localStorage.removeItem(preferenceKey(userId));
  } catch {
    // Workspace authorization comes from the server. Storage is only a UI preference.
  }
}

const TRANSIENT_RETRY_DELAYS_MS = [500, 1_000, 2_000];

function isTransientWorkspaceError(error: unknown): boolean {
  return error instanceof WorkspaceApiError
    && (error.status === 0 || error.status === 429 || error.status >= 500);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, refreshSession, session, setRecoverableError, user } = useAuth();
  const [state, setState] = useState<WorkspaceState>(EMPTY_STATE);
  const requestSequence = useRef(0);
  const switchSequence = useRef(0);
  const authRefreshAttempted = useRef(false);
  const inFlightRefreshes = useRef(new Map<string, Promise<void>>());
  const currentUserId = user?.id ?? null;
  const currentAccessToken = session?.access_token ?? null;
  const identityRef = useRef({ userId: currentUserId, accessToken: currentAccessToken, generation: 0 });
  if (identityRef.current.userId !== currentUserId || identityRef.current.accessToken !== currentAccessToken) {
    identityRef.current = {
      userId: currentUserId,
      accessToken: currentAccessToken,
      generation: identityRef.current.generation + 1,
    };
  }

  const loadWorkspaces = useCallback(async (manualRetry: boolean) => {
    if (authLoading || !session?.access_token || !currentUserId) return;
    if (manualRetry) authRefreshAttempted.current = false;
    const requestKey = `${currentUserId}:${session.access_token}`;
    const alreadyRunning = inFlightRefreshes.current.get(requestKey);
    if (alreadyRunning) {
      await alreadyRunning;
      return;
    }

    const request = (async () => {
      const sequence = ++requestSequence.current;
      const identityGeneration = identityRef.current.generation;
      setState((current) => ({
        userId: currentUserId,
        status: current.userId === currentUserId && current.status === "ready" ? "ready" : "loading",
        workspaces: current.userId === currentUserId ? current.workspaces : [],
        activeWorkspaceId: current.userId === currentUserId ? current.activeWorkspaceId : null,
        error: null,
      }));
      const isCurrentRequest = () => requestSequence.current === sequence
        && identityRef.current.generation === identityGeneration
        && identityRef.current.userId === currentUserId
        && identityRef.current.accessToken === session.access_token;

      try {
        let result: Awaited<ReturnType<typeof getWorkspaces>>;
        for (let attempt = 0; ; attempt += 1) {
          try {
            result = await getWorkspaces(session.access_token);
            break;
          } catch (error) {
            if (error instanceof WorkspaceApiError && error.status === 401) {
              if (!authRefreshAttempted.current) {
                authRefreshAttempted.current = true;
                try {
                  const refreshedSession = await refreshSession();
                  if (!isCurrentRequest()) return;
                  if (refreshedSession?.user.id === currentUserId
                    && refreshedSession.access_token !== session.access_token) return;
                  if (!refreshedSession || refreshedSession.user.id !== currentUserId) return;
                } catch (refreshError) {
                  if (!isCurrentRequest()) return;
                  const status = refreshError instanceof WorkspaceApiError ? refreshError.status
                    : typeof refreshError === "object" && refreshError !== null && "status" in refreshError
                      ? (refreshError as { status?: unknown }).status
                      : null;
                  if (status === 400 || status === 401) return;
                  authRefreshAttempted.current = false;
                  const message = "Authentication could not be verified because the auth service is temporarily unavailable. Try again.";
                  setRecoverableError(message);
                  setState({ userId: currentUserId, status: "error", workspaces: [], activeWorkspaceId: null, error: message });
                  return;
                }
              }
              const message = "The workspace service rejected this session after one refresh attempt. Try again or sign in again.";
              setRecoverableError(message);
              setState({ userId: currentUserId, status: "error", workspaces: [], activeWorkspaceId: null, error: message });
              return;
            }
            const delay = TRANSIENT_RETRY_DELAYS_MS[attempt];
            if (!isCurrentRequest()) return;
            if (delay === undefined || !isTransientWorkspaceError(error)) throw error;
            await wait(delay);
            if (!isCurrentRequest()) return;
          }
        }
        if (!isCurrentRequest()) return;
        authRefreshAttempted.current = false;
        const workspaces = result.workspaces;
        const savedId = readPreference(currentUserId);
        const selected = workspaces.find((workspace) => workspace.id === savedId) ?? workspaces[0] ?? null;
        const activeWorkspaceId = selected?.id ?? null;
        writePreference(currentUserId, activeWorkspaceId);
        setState({ userId: currentUserId, status: "ready", workspaces, activeWorkspaceId, error: null });
      } catch (error) {
        if (!isCurrentRequest()) return;
        const message = error instanceof WorkspaceApiError
          ? error.message
          : "Your workspace access could not be verified. Try again.";
        setState({ userId: currentUserId, status: "error", workspaces: [], activeWorkspaceId: null, error: message });
        writePreference(currentUserId, null);
      }
    })();

    inFlightRefreshes.current.set(requestKey, request);
    try {
      await request;
    } finally {
      if (inFlightRefreshes.current.get(requestKey) === request) {
        inFlightRefreshes.current.delete(requestKey);
      }
    }
  }, [authLoading, currentUserId, refreshSession, session?.access_token, setRecoverableError]);

  const refresh = useCallback(() => loadWorkspaces(true), [loadWorkspaces]);

  useEffect(() => {
    if (authLoading) {
      requestSequence.current += 1;
      authRefreshAttempted.current = false;
      setState(EMPTY_STATE);
      return;
    }
    if (!session?.access_token || !currentUserId) {
      requestSequence.current += 1;
      authRefreshAttempted.current = false;
      setState(EMPTY_STATE);
      return;
    }
    void loadWorkspaces(false);
  }, [authLoading, currentUserId, loadWorkspaces, session?.access_token]);

  useEffect(() => {
    if (authLoading || !session?.access_token || !currentUserId) return;
    const revalidate = () => void loadWorkspaces(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(revalidate, 60_000);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [authLoading, currentUserId, loadWorkspaces, session?.access_token]);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    if (!currentUserId || !session?.access_token) throw new Error("Sign in to select a workspace.");
    const authorized = state.workspaces.some((workspace) => workspace.id === workspaceId);
    if (!authorized) throw new Error("This workspace is not available to your account.");
    const sequence = ++switchSequence.current;
    const identityGeneration = identityRef.current.generation;
    const verified = await getWorkspace(session.access_token, workspaceId);
    if (switchSequence.current !== sequence
      || identityRef.current.generation !== identityGeneration
      || identityRef.current.userId !== currentUserId
      || identityRef.current.accessToken !== session.access_token
      || !verified.role) return;
    setState((current) => current.userId !== currentUserId
      ? current
      : {
          ...current,
          workspaces: current.workspaces.map((workspace) => workspace.id === workspaceId
            ? { ...verified.workspace, role: verified.role }
            : workspace),
          activeWorkspaceId: workspaceId,
        });
    writePreference(currentUserId, workspaceId);
  }, [currentUserId, session?.access_token, state.workspaces]);

  const createWorkspace = useCallback(async (input: CreateWorkspaceInput) => {
    if (!currentUserId || !session?.access_token) throw new Error("Sign in to create a workspace.");
    const identityGeneration = identityRef.current.generation;
    const response = await createWorkspaceRequest(session.access_token, input);
    if (identityRef.current.generation !== identityGeneration
      || identityRef.current.userId !== currentUserId
      || identityRef.current.accessToken !== session.access_token) {
      throw new Error("Your session changed before workspace access could be confirmed.");
    }
    const result = await getWorkspaces(session.access_token);
    if (identityRef.current.generation !== identityGeneration
      || identityRef.current.userId !== currentUserId
      || identityRef.current.accessToken !== session.access_token) {
      throw new Error("Your session changed before workspace access could be confirmed.");
    }
    const created = result.workspaces.find((workspace) => workspace.id === response.workspace.id);
    if (!created || created.role !== "owner") {
      throw new Error("Workspace creation could not be confirmed for this account. Reload and try again.");
    }
    setState({
      userId: currentUserId,
      status: "ready",
      workspaces: result.workspaces,
      activeWorkspaceId: created.id,
      error: null,
    });
    writePreference(currentUserId, created.id);
    return created;
  }, [currentUserId, session?.access_token]);

  const visibleState = state.userId === currentUserId ? state : EMPTY_STATE;
  const activeWorkspace = visibleState.workspaces.find((item) => item.id === visibleState.activeWorkspaceId) ?? null;
  const value = useMemo<WorkspaceContextValue>(
    () => ({ ...visibleState, activeWorkspace, refresh, selectWorkspace, createWorkspace }),
    [activeWorkspace, createWorkspace, refresh, selectWorkspace, visibleState],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
