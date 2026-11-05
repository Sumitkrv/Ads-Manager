import { act, cleanup, render as testingRender, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import type { Session, User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";
import type { AuthService } from "./supabase";
import { AuthGuestRoute, ProtectedRoute } from "./RouteGuards";
import { LoginPage } from "../pages/LoginPage";
import { SignupPage } from "../pages/SignupPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "../theme/ThemeProvider";

afterEach(() => cleanup());

function render(ui: ReactNode) {
  return testingRender(<ThemeProvider>{ui}</ThemeProvider>);
}

const user = {
  id: "6bfc5b42-a6bb-4be7-9163-71a61c740a4e",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Test User" },
  aud: "authenticated",
  created_at: "2026-01-02T03:04:05.000Z",
  email: "person@example.invalid",
  email_confirmed_at: null,
  identities: [],
  role: "authenticated",
} as unknown as User;

const session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 2000000000,
  user,
} as Session;

function createService(
  restoreSession: () => Promise<Session | null> = async () => null,
) {
  const listeners = new Set<(session: Session | null, event: string) => void>();
  const emit = (nextSession: Session | null, event: string) => {
    for (const listener of listeners) listener(nextSession, event);
  };
  const signIn = vi.fn(async (_email: string, _password: string) => null);
  const signUp = vi.fn(async (
    _fullName: string,
    _email: string,
    _password: string,
    _redirect: string,
  ) => null);
  const signOut = vi.fn(async () => {
    emit(null, "SIGNED_OUT");
  });
  const clearLocalSession = vi.fn(async () => {
    emit(null, "SIGNED_OUT");
  });
  const requestPasswordReset = vi.fn(async () => undefined);
  const resendSignupConfirmation = vi.fn(async (_email: string) => undefined);
  const service: AuthService = {
    restoreSession,
    refreshSession: async () => null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    signIn,
    signUp,
    resendSignupConfirmation,
    signOut,
    clearLocalSession,
    requestPasswordReset,
    updatePassword: vi.fn(async () => undefined),
    updateEmail: vi.fn(async () => undefined),
  };
  return { service, signIn, signUp, signOut, clearLocalSession, requestPasswordReset, resendSignupConfirmation, emit };
}

function ClearSessionHarness() {
  const { clearLocalSession } = useAuth();
  return <button onClick={() => void clearLocalSession()} type="button">Clear local session</button>;
}

function ProtectedHarness() {
  const { signOut } = useAuth();
  return (
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <div>
                <p>Private workspace</p>
                <button onClick={() => void signOut()} type="button">Sign out</button>
              </div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<p>Login destination</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("authentication routes and forms", () => {
  it("redirects an unauthenticated visitor away from a protected route", async () => {
    const { service } = createService();
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/app"]}>
          <Routes>
            <Route path="/app" element={<ProtectedRoute><p>Private workspace</p></ProtectedRoute>} />
            <Route path="/login" element={<p>Login destination</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText("Login destination")).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();
  });

  it("does not show an expired-session notice on a normal sign-in visit", async () => {
    const { service } = createService();
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthGuestRoute><LoginPage /></AuthGuestRoute>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByLabelText("Work email")).toBeTruthy();
    expect(screen.queryByText("Your session expired. Sign in again to continue.")).toBeNull();
  });

  it("does not render protected content while the session is restoring", async () => {
    let resolveRestore: (value: Session | null) => void = () => undefined;
    const pendingSession = new Promise<Session | null>((resolve) => {
      resolveRestore = resolve;
    });
    const { service } = createService(() => pendingSession);

    render(
      <AuthProvider service={service}>
        <ProtectedHarness />
      </AuthProvider>,
    );

    expect(screen.getByRole("status").textContent).toContain("Restoring your secure session");
    expect(screen.queryByText("Private workspace")).toBeNull();
    await act(async () => resolveRestore(session));
    expect(await screen.findByText("Private workspace")).toBeTruthy();
  });

  it("clears the authenticated UI state on logout", async () => {
    const { service, signOut } = createService(async () => session);
    render(
      <AuthProvider service={service}>
        <ProtectedHarness />
      </AuthProvider>,
    );

    await screen.findByText("Private workspace");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Login destination")).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();
  });

  it("clears a stale session locally without calling remote sign-out", async () => {
    const fixture = createService(async () => session);
    render(
      <AuthProvider service={fixture.service}>
        <ClearSessionHarness />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Clear local session" }));

    expect(fixture.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(fixture.signOut).not.toHaveBeenCalled();
  });

  it("requires a Supabase password-recovery event before showing the reset form", async () => {
    const fixture = createService(async () => session);
    render(
      <AuthProvider service={fixture.service}>
        <MemoryRouter initialEntries={["/reset-password"]}>
          <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText("Open your reset email")).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
    await act(async () => fixture.emit(session, "PASSWORD_RECOVERY"));
    expect(await screen.findByLabelText("New password")).toBeTruthy();
  });

  it("shows inline login validation and does not call Supabase for invalid input", async () => {
    const { service, signIn } = createService();
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthGuestRoute><LoginPage /></AuthGuestRoute>
        </MemoryRouter>
      </AuthProvider>,
    );

    const email = await screen.findByLabelText("Work email");
    await userEvent.type(email, "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("explains when Supabase rate-limits a sign-in attempt", async () => {
    const { service, signIn } = createService();
    signIn.mockRejectedValueOnce(Object.assign(new Error("Too many requests"), { status: 429 }));
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthGuestRoute><LoginPage /></AuthGuestRoute>
        </MemoryRouter>
      </AuthProvider>,
    );

    await userEvent.type(await screen.findByLabelText("Work email"), "person@example.com");
    await userEvent.type(screen.getByLabelText("Password", { selector: "input" }), "not-a-real-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Too many sign-in attempts. Wait a bit before trying again.")).toBeTruthy();
  });

  it("explains when Supabase rate-limits password recovery", async () => {
    const { service, requestPasswordReset } = createService();
    requestPasswordReset.mockRejectedValueOnce(Object.assign(new Error("Too many requests"), { status: 429 }));
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/forgot-password"]}>
          <Routes><Route path="/forgot-password" element={<ForgotPasswordPage />} /></Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await userEvent.type(await screen.findByLabelText("Work email"), "person@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset instructions" }));

    expect(await screen.findByText(/Password reset is temporarily rate-limited/)).toBeTruthy();
  });

  it("guides unconfirmed accounts through resend and explains SMTP recipient blocks", async () => {
    const { service, signIn, resendSignupConfirmation } = createService();
    signIn.mockRejectedValueOnce(Object.assign(new Error("Email not confirmed"), { status: 400, code: "email_not_confirmed" }));
    resendSignupConfirmation.mockRejectedValueOnce(Object.assign(new Error("Email address not authorized"), { status: 400, code: "email_address_not_authorized" }));
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthGuestRoute><LoginPage /></AuthGuestRoute>
        </MemoryRouter>
      </AuthProvider>,
    );

    await userEvent.type(await screen.findByLabelText("Work email"), "person@example.com");
    await userEvent.type(screen.getByLabelText("Password", { selector: "input" }), "test-password-value");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Confirm your email before signing in/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation" }));
    expect(await screen.findByText(/Configure custom SMTP for the project/)).toBeTruthy();
    expect(resendSignupConfirmation).toHaveBeenCalledWith("person@example.com");
  });

  it("rejects signup when passwords do not match and requires terms acceptance", async () => {
    const { service, signUp } = createService();
    render(
      <AuthProvider service={service}>
        <MemoryRouter initialEntries={["/signup"]}>
          <AuthGuestRoute><SignupPage /></AuthGuestRoute>
        </MemoryRouter>
      </AuthProvider>,
    );

    await userEvent.type(await screen.findByLabelText("Full name"), "Test User");
    await userEvent.type(screen.getByLabelText("Work email"), "person@example.invalid");
    await userEvent.type(screen.getByLabelText("Password", { selector: "input" }), "correct horse battery");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(await screen.findByText("Accept the terms to create an account.")).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });
});
