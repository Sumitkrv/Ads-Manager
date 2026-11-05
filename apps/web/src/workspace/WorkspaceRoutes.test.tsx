import { act, cleanup, render as testingRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { HomeRoute, ProtectedRoute } from "../auth/RouteGuards";
import type { AuthService } from "../auth/supabase";
import { OnboardingPage } from "../pages/OnboardingPage";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { WorkspaceApiError } from "../api/workspaces";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { useWorkspace } from "./WorkspaceContext";
import type { WorkspaceWithRole } from "@ai-ads/shared";

const mocks = vi.hoisted(() => ({
  getWorkspaces: vi.fn(),
  getWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  getUserOnboarding: vi.fn(),
  getWorkspaceOnboarding: vi.fn(),
  saveUserOnboarding: vi.fn(),
  saveWorkspaceOnboarding: vi.fn(),
  recordActivationEvent: vi.fn(),
  getBrandKit: vi.fn(),
  saveBrandKit: vi.fn(),
  uploadCreativeAsset: vi.fn(),
}));

vi.mock("../api/workspaces", () => ({
  getWorkspaces: mocks.getWorkspaces,
  getWorkspace: mocks.getWorkspace,
  createWorkspace: mocks.createWorkspace,
  WorkspaceApiError: class WorkspaceApiError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
  },
}));

vi.mock("../auth/supabase", () => ({ authService: null, supabaseClient: null }));
vi.mock("../api/onboarding", () => ({
  getUserOnboarding: mocks.getUserOnboarding,
  getWorkspaceOnboarding: mocks.getWorkspaceOnboarding,
  saveUserOnboarding: mocks.saveUserOnboarding,
  saveWorkspaceOnboarding: mocks.saveWorkspaceOnboarding,
  recordActivationEvent: mocks.recordActivationEvent,
}));
vi.mock("../api/creatives", () => ({
  getBrandKit: mocks.getBrandKit,
  saveBrandKit: mocks.saveBrandKit,
  uploadCreativeAsset: mocks.uploadCreativeAsset,
}));

afterEach(() => cleanup());

function render(ui: ReactNode) {
  return testingRender(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  localStorage.clear();
  mocks.getWorkspaces.mockReset();
  mocks.getWorkspace.mockReset();
  mocks.createWorkspace.mockReset();
  mocks.getUserOnboarding.mockReset().mockResolvedValue(null);
  mocks.getWorkspaceOnboarding.mockReset().mockResolvedValue(null);
  mocks.saveUserOnboarding.mockReset().mockResolvedValue(null);
  mocks.saveWorkspaceOnboarding.mockReset().mockResolvedValue(null);
  mocks.recordActivationEvent.mockReset().mockResolvedValue(null);
  mocks.getBrandKit.mockReset().mockResolvedValue(null);
  mocks.saveBrandKit.mockReset().mockResolvedValue(null);
  mocks.uploadCreativeAsset.mockReset().mockResolvedValue(null);
  mocks.getWorkspaces.mockResolvedValue({ workspaces: [] });
  mocks.getWorkspace.mockImplementation(async (_token: string, id: string) => ({
    workspace: id === workspaceB.id ? workspaceB : workspaceA,
    role: id === workspaceB.id ? "viewer" : "owner",
  }));
});

const account = {
  id: "6bfc5b42-a6bb-4be7-9163-71a61c740a4e",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Workspace User" },
  aud: "authenticated",
  created_at: "2026-01-02T03:04:05.000Z",
  email: "workspace@example.invalid",
  email_confirmed_at: "2026-01-02T03:04:05.000Z",
  identities: [],
  role: "authenticated",
} as unknown as User;

const session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 2000000000,
  user: account,
} as Session;

const workspaceA: WorkspaceWithRole = {
  id: "21000000-0000-4000-8000-000000000001",
  name: "Northstar Studio",
  slug: "northstar-studio",
  industryKey: "professional_services",
  industryCustomLabel: null,
  websiteUrl: "https://northstar.example",
  countryCode: "US",
  timezone: "America/New_York",
  logoUrl: null,
  createdBy: account.id,
  createdAt: "2026-10-27T12:00:00.000Z",
  updatedAt: "2026-10-27T12:00:00.000Z",
  role: "owner",
};

const workspaceB: WorkspaceWithRole = {
  ...workspaceA,
  id: "21000000-0000-4000-8000-000000000002",
  name: "Harbor Supply",
  slug: "harbor-supply",
  industryKey: "ecommerce_retail",
  websiteUrl: null,
  countryCode: "GB",
  timezone: "Europe/London",
  role: "viewer",
};

function fakeAuthService(
  initialSession: Session | null = session,
  refreshedSession: Session | null = initialSession,
  refreshError?: unknown,
) {
  const listeners = new Set<(session: Session | null, event: string) => void>();
  const emit = (nextSession: Session | null, event: string) => listeners.forEach((listener) => listener(nextSession, event));
  const service: AuthService = {
    restoreSession: async () => initialSession,
    refreshSession: async () => {
      if (refreshError) throw refreshError;
      if (refreshedSession) emit(refreshedSession, "TOKEN_REFRESHED");
      return refreshedSession;
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    signIn: async () => initialSession,
    signUp: async () => null,
    resendSignupConfirmation: async () => undefined,
    signOut: async () => emit(null, "SIGNED_OUT"),
    clearLocalSession: async () => emit(null, "SIGNED_OUT"),
    requestPasswordReset: async () => undefined,
    updatePassword: async () => undefined,
    updateEmail: async () => undefined,
  };
  return { service, emit };
}

function ProviderTree({ children, initialSession = session, initialEntry = "/", refreshedSession = initialSession, refreshError }: {
  children?: ReactNode;
  initialSession?: Session | null;
  initialEntry?: string;
  refreshedSession?: Session | null;
  refreshError?: unknown;
}) {
  const auth = fakeAuthService(initialSession, refreshedSession, refreshError);
  return (
    <ThemeProvider>
      <AuthProvider service={auth.service}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function WorkspaceHarness() {
  const { activeWorkspace, status } = useWorkspace();
  return <><WorkspaceSwitcher /><p data-testid="active-workspace">{status === "ready" ? activeWorkspace?.name ?? "No active workspace" : "Checking workspaces"}</p></>;
}

function RefreshControl() {
  const { refresh } = useWorkspace();
  return <button onClick={() => void refresh()} type="button">Refresh workspaces</button>;
}

function AuthStateHarness() {
  const { session, status } = useAuth();
  return <output data-testid="auth-state">{status}:{session ? "session" : "no-session"}</output>;
}

function WorkspaceErrorHarness() {
  const { error, status } = useWorkspace();
  return <p data-testid="workspace-state">{status}:{error ?? ""}</p>;
}

function LogoutHarness() {
  const { signOut } = useAuth();
  const { activeWorkspace } = useWorkspace();
  return <><WorkspaceHarness /><button onClick={() => void signOut()} type="button">Sign out</button><span data-testid="logout-context">{activeWorkspace?.name ?? "No active workspace"}</span></>;
}

describe("workspace context and onboarding", () => {
  it("does not request workspaces while signed out on the login route", async () => {
    render(
      <ProviderTree initialSession={null} initialEntry="/login">
        <Routes><Route path="/login" element={<p>Sign in page</p>} /></Routes>
      </ProviderTree>,
    );

    expect(await screen.findByText("Sign in page")).toBeTruthy();
    await act(async () => Promise.resolve());
    expect(mocks.getWorkspaces).not.toHaveBeenCalled();
  });

  it("routes an authenticated user with no workspace to onboarding", async () => {
    mocks.getWorkspaces.mockResolvedValue({ workspaces: [] });
    render(
      <ProviderTree>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/onboarding" element={<p>Onboarding destination</p>} />
        </Routes>
      </ProviderTree>,
    );
    expect(await screen.findByText("Onboarding destination")).toBeTruthy();
  });

  it("recovers from a transient workspace service outage without manual refresh", async () => {
    mocks.getWorkspaces
      .mockRejectedValueOnce(new WorkspaceApiError(503, "Workspace service is temporarily unavailable."))
      .mockResolvedValue({ workspaces: [workspaceA] });
    render(<ProviderTree><WorkspaceHarness /></ProviderTree>);

    await waitFor(() => expect(screen.getByTestId("active-workspace").textContent).toContain("Northstar Studio"));
    expect(mocks.getWorkspaces).toHaveBeenCalledTimes(2);
  });

  it("deduplicates simultaneous workspace checks for the same session", async () => {
    let resolveRequest: (value: { workspaces: WorkspaceWithRole[] }) => void = () => undefined;
    mocks.getWorkspaces.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<ProviderTree><><WorkspaceHarness /><RefreshControl /></></ProviderTree>);

    await waitFor(() => expect(mocks.getWorkspaces).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Refresh workspaces" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh workspaces" }));
    expect(mocks.getWorkspaces).toHaveBeenCalledTimes(1);

    await act(async () => resolveRequest({ workspaces: [workspaceA] }));
    expect((await screen.findByTestId("active-workspace")).textContent).toContain("Northstar Studio");
  });

  it("refreshes an expired auth session once and reloads workspace access", async () => {
    const refreshedSession = { ...session, access_token: "refreshed-access-token" };
    mocks.getWorkspaces
      .mockRejectedValueOnce(new WorkspaceApiError(401, "Your session could not be verified. Sign in again to continue."))
      .mockResolvedValue({ workspaces: [workspaceA] });
    render(<ProviderTree refreshedSession={refreshedSession}><WorkspaceHarness /></ProviderTree>);

    await waitFor(() => expect(screen.getByTestId("active-workspace").textContent).toContain("Northstar Studio"));
    expect(mocks.getWorkspaces).toHaveBeenCalledWith("test-access-token");
    expect(mocks.getWorkspaces).toHaveBeenCalledWith("refreshed-access-token");
  });

  it("does not loop or discard a session when a refreshed token is still rejected", async () => {
    const refreshedSession = { ...session, access_token: "refreshed-access-token" };
    mocks.getWorkspaces
      .mockRejectedValueOnce(new WorkspaceApiError(401, "Your session could not be verified. Sign in again to continue."))
      .mockRejectedValue(new WorkspaceApiError(401, "Your session could not be verified. Sign in again to continue."));
    render(<ProviderTree refreshedSession={refreshedSession}><><AuthStateHarness /><WorkspaceErrorHarness /></></ProviderTree>);

    await waitFor(() => expect(screen.getByTestId("workspace-state").textContent).toContain("one refresh attempt"));
    expect(screen.getByTestId("auth-state").textContent).toBe("recoverable_error:session");
    expect(mocks.getWorkspaces).toHaveBeenCalledTimes(2);
  });

  it("clears an unusable session after a single unauthorized workspace check", async () => {
    mocks.getWorkspaces.mockRejectedValue(new WorkspaceApiError(401, "Your session could not be verified. Sign in again to continue."));
    render(
      <ProviderTree initialEntry="/app" refreshedSession={null}>
        <Routes>
          <Route path="/app" element={<ProtectedRoute><WorkspaceHarness /></ProtectedRoute>} />
          <Route path="/login" element={<p>Sign-in destination</p>} />
        </Routes>
      </ProviderTree>,
    );

    expect(await screen.findByText("Sign-in destination")).toBeTruthy();
    await waitFor(() => expect(mocks.getWorkspaces).toHaveBeenCalledTimes(1));
  });

  it("keeps the session when workspace access is forbidden", async () => {
    mocks.getWorkspaces.mockRejectedValue(new WorkspaceApiError(403, "Your role does not allow this workspace action."));
    render(
      <ProviderTree>
        <><AuthStateHarness /><WorkspaceErrorHarness /></>
      </ProviderTree>,
    );

    await waitFor(() => expect(screen.getByTestId("workspace-state").textContent).toContain("error:Your role does not allow this workspace action."));
    expect(screen.getByTestId("auth-state").textContent).toBe("authenticated:session");
    expect(mocks.getWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("keeps the session and offers recovery when token refresh has a network error", async () => {
    mocks.getWorkspaces.mockRejectedValue(new WorkspaceApiError(401, "The session was rejected."));
    render(
      <ProviderTree refreshError={Object.assign(new Error("offline"), { status: 0 })}>
        <><AuthStateHarness /><WorkspaceErrorHarness /></>
      </ProviderTree>,
    );

    await waitFor(() => expect(screen.getByTestId("workspace-state").textContent).toContain("error:Authentication could not be verified because the auth service is temporarily unavailable. Try again."));
    expect(screen.getByTestId("auth-state").textContent).toBe("recoverable_error:session");
    expect(mocks.getWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("shows only server-authorized workspaces and switches active context", async () => {
    mocks.getWorkspaces.mockResolvedValue({ workspaces: [workspaceA, workspaceB] });
    render(<ProviderTree><WorkspaceHarness /></ProviderTree>);

    await waitFor(() => expect(screen.getByTestId("active-workspace").textContent).toContain("Northstar Studio"));
    const selector = screen.getByRole("combobox", { name: "Switch workspace" });
    expect(selector.querySelectorAll("option")).toHaveLength(2);
    await userEvent.selectOptions(selector, workspaceB.id);
    await waitFor(() => expect(screen.getByTestId("active-workspace").textContent).toContain("Harbor Supply"));
  });

  it("revalidates a saved workspace choice and does not reuse another account's selection", async () => {
    localStorage.setItem("tandem-ads.active-workspace." + account.id, workspaceB.id);
    mocks.getWorkspaces.mockResolvedValue({ workspaces: [workspaceA] });
    render(<ProviderTree><WorkspaceHarness /></ProviderTree>);

    await waitFor(() => expect(screen.getByTestId("active-workspace").textContent).toContain("Northstar Studio"));
    expect(localStorage.getItem("tandem-ads.active-workspace." + account.id)).toBe(workspaceA.id);
  });

  it("keeps personal protected content independent of workspace membership", async () => {
    mocks.getWorkspaces.mockResolvedValue({ workspaces: [] });
    render(
      <ProviderTree initialEntry="/app/profile">
        <Routes>
          <Route path="/app/profile" element={<ProtectedRoute><p>Personal profile</p></ProtectedRoute>} />
          <Route path="/login" element={<p>Login destination</p>} />
        </Routes>
      </ProviderTree>,
    );
    expect(await screen.findByText("Personal profile")).toBeTruthy();
  });

  it("clears active workspace UI after logout", async () => {
    mocks.getWorkspaces.mockResolvedValue({ workspaces: [workspaceA] });
    render(
      <ProviderTree initialEntry="/app">
        <Routes>
          <Route path="/app" element={<ProtectedRoute><LogoutHarness /></ProtectedRoute>} />
          <Route path="/login" element={<LogoutHarness />} />
        </Routes>
      </ProviderTree>,
    );

    await waitFor(() => expect(screen.getByTestId("logout-context").textContent).toBe("Northstar Studio"));
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("logout-context").textContent).toBe("No active workspace"));
    expect(screen.getByText("No active workspace")).toBeTruthy();
  });

  it("validates industry and business details before calling workspace creation", async () => {
    render(
      <ProviderTree initialEntry="/onboarding">
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/app" element={<p>Created workspace destination</p>} />
        </Routes>
      </ProviderTree>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /Independent business/ }));
    expect(await screen.findByText("Choose your industry")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByText("Choose the closest industry, or describe your custom industry.")).toBeTruthy();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /E-commerce & Retail/ }));
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await userEvent.type(await screen.findByLabelText(/Business name/), "Harbor Supply");
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await userEvent.click(screen.getByRole("button", { name: /Skip optional preferences/ }));
    expect(await screen.findByText("Review your workspace")).toBeTruthy();
    expect(screen.getByText("Harbor Supply")).toBeTruthy();
  });

  it("creates a workspace through the API and opens Brand Kit only after owner access is confirmed", async () => {
    mocks.createWorkspace.mockResolvedValue({ workspace: workspaceA, role: "owner" });
    mocks.getWorkspaces
      .mockResolvedValueOnce({ workspaces: [] })
      .mockResolvedValue({ workspaces: [workspaceA] });
    render(
      <ProviderTree initialEntry="/onboarding">
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/app" element={<p>Business workspace created</p>} />
        </Routes>
      </ProviderTree>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /Independent business/ }));
    await userEvent.click(screen.getByRole("button", { name: /E-commerce & Retail/ }));
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await userEvent.type(await screen.findByLabelText(/Business name/), "Northstar Studio");
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await userEvent.click(screen.getByRole("button", { name: /Skip optional preferences/ }));
    await screen.findByText("Review your workspace");
    await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByLabelText(/Brand display name/)).toBeTruthy();
    expect(mocks.createWorkspace).toHaveBeenCalledWith("test-access-token", expect.objectContaining({
      name: "Northstar Studio",
      slug: "northstar-studio",
      industryKey: "ecommerce_retail",
      requestId: expect.any(String),
    }));
  });
});
