import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService as configuredAuthService, type AuthService } from "./supabase";

export type AuthStatus = "initializing" | "authenticated" | "unauthenticated" | "recoverable_error";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  status: AuthStatus;
  recoverableError: string | null;
  sessionExpired: boolean;
  passwordRecovery: boolean;
  session: Session | null;
  user: Session["user"] | null;
  signIn: (email: string, password: string) => Promise<Session | null>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
    emailRedirectTo: string,
  ) => Promise<Session | null>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  retrySessionRestore: () => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  setRecoverableError: (message: string) => void;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateEmail: (email: string, redirectTo: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

const AUTH_RECOVERY_MESSAGE = "Authentication service is temporarily unavailable. Try again.";

export function AuthProvider({
  children,
  service = configuredAuthService,
}: {
  children: ReactNode;
  service?: AuthService | null;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [recoverableError, setRecoverableErrorState] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!service) {
      setLoading(false);
      setSession(null);
      setStatus("unauthenticated");
      setRecoverableErrorState(null);
      setPasswordRecovery(false);
      return;
    }

    let mounted = true;
    let receivedAuthEvent = false;
    const unsubscribe = service.subscribe((nextSession, event) => {
      receivedAuthEvent = true;
      if (mounted) {
        setSession(nextSession);
        setStatus(nextSession ? "authenticated" : "unauthenticated");
        setRecoverableErrorState(null);
        if (nextSession) setSessionExpired(false);
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        if (event === "SIGNED_OUT") setPasswordRecovery(false);
        setLoading(false);
      }
    });

    void service
      .restoreSession()
      .then((restoredSession) => {
        if (mounted && !receivedAuthEvent) {
          setSession(restoredSession);
          setStatus(restoredSession ? "authenticated" : "unauthenticated");
          setRecoverableErrorState(null);
          if (restoredSession) setSessionExpired(false);
        }
      })
      .catch((error: unknown) => {
        if (mounted && !receivedAuthEvent) {
          if (errorStatus(error) === 400 || errorStatus(error) === 401) {
            setSession(null);
            setStatus("unauthenticated");
            setSessionExpired(true);
            void service.clearLocalSession().catch(() => undefined);
          } else {
            setStatus("recoverable_error");
            setRecoverableErrorState(AUTH_RECOVERY_MESSAGE);
          }
          setPasswordRecovery(false);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [service]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!service) throw new Error("Supabase authentication is not configured.");
      const nextSession = await service.signIn(email, password);
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
      setSessionExpired(false);
      setRecoverableErrorState(null);
      return nextSession;
    },
    [service],
  );

  const signUp = useCallback(
    async (fullName: string, email: string, password: string, emailRedirectTo: string) => {
      if (!service) throw new Error("Supabase authentication is not configured.");
      const nextSession = await service.signUp(fullName, email, password, emailRedirectTo);
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
      setSessionExpired(false);
      setRecoverableErrorState(null);
      return nextSession;
    },
    [service],
  );

  const resendSignupConfirmation = useCallback(async (email: string) => {
    if (!service) throw new Error("Supabase authentication is not configured.");
    await service.resendSignupConfirmation(email);
  }, [service]);

  const refreshSession = useCallback(async () => {
    if (!service) throw new Error("Supabase authentication is not configured.");
    try {
      const nextSession = await service.refreshSession();
      setSession(nextSession);
      if (nextSession) {
        setStatus("authenticated");
        setSessionExpired(false);
        setRecoverableErrorState(null);
      } else if (session) {
        setStatus("unauthenticated");
        setSessionExpired(true);
        setPasswordRecovery(false);
        await service.clearLocalSession().catch(() => undefined);
      } else {
        setStatus("unauthenticated");
        setPasswordRecovery(false);
      }
      return nextSession;
    } catch (error) {
      const responseStatus = errorStatus(error);
      if (responseStatus === 400 || responseStatus === 401) {
        setSession(null);
        setStatus("unauthenticated");
        setSessionExpired(true);
        setRecoverableErrorState(null);
        setPasswordRecovery(false);
        // The refresh token is no longer accepted. Remove it locally so this
        // browser does not keep replaying the same invalid session on reload.
        await service.clearLocalSession().catch(() => undefined);
      } else {
        setStatus("recoverable_error");
        setRecoverableErrorState(AUTH_RECOVERY_MESSAGE);
      }
      throw error;
    }
  }, [service, session]);

  const retrySessionRestore = useCallback(async () => {
    if (!service) throw new Error("Supabase authentication is not configured.");
    setLoading(true);
    setStatus("initializing");
    setRecoverableErrorState(null);
    try {
      const restoredSession = await service.restoreSession();
      setSession(restoredSession);
      setStatus(restoredSession ? "authenticated" : "unauthenticated");
      if (restoredSession) setSessionExpired(false);
    } catch (error) {
      if (errorStatus(error) === 400 || errorStatus(error) === 401) {
        setSession(null);
        setStatus("unauthenticated");
        setSessionExpired(true);
        await service.clearLocalSession().catch(() => undefined);
      } else {
        setStatus("recoverable_error");
        setRecoverableErrorState(AUTH_RECOVERY_MESSAGE);
      }
    } finally {
      setLoading(false);
    }
  }, [service]);

  const signOut = useCallback(async () => {
    if (!service) throw new Error("Supabase authentication is not configured.");
    setSession(null);
    setStatus("unauthenticated");
    setSessionExpired(false);
    setRecoverableErrorState(null);
    setPasswordRecovery(false);
    await service.signOut();
  }, [service]);

  const clearLocalSession = useCallback(async () => {
    if (!service) throw new Error("Supabase authentication is not configured.");
    setSession(null);
    setStatus("unauthenticated");
    setSessionExpired(true);
    setRecoverableErrorState(null);
    setPasswordRecovery(false);
    await service.clearLocalSession();
  }, [service]);

  const setRecoverableError = useCallback((message: string) => {
    setStatus("recoverable_error");
    setRecoverableErrorState(message);
  }, []);

  const requestPasswordReset = useCallback(
    async (email: string, redirectTo: string) => {
      if (!service) throw new Error("Supabase authentication is not configured.");
      await service.requestPasswordReset(email, redirectTo);
    },
    [service],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (!service) throw new Error("Supabase authentication is not configured.");
      await service.updatePassword(password);
      setPasswordRecovery(false);
    },
    [service],
  );

  const updateEmail = useCallback(async (email: string, redirectTo: string) => {
    if (!service) throw new Error("Supabase authentication is not configured.");
    await service.updateEmail(email, redirectTo);
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: service !== null,
      loading,
      status,
      recoverableError,
      sessionExpired,
      passwordRecovery,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      resendSignupConfirmation,
      refreshSession,
      retrySessionRestore,
      signOut,
      clearLocalSession,
      setRecoverableError,
      requestPasswordReset,
      updatePassword,
      updateEmail,
    }),
    [clearLocalSession, loading, passwordRecovery, recoverableError, refreshSession, requestPasswordReset, resendSignupConfirmation, retrySessionRestore, service, session, sessionExpired, setRecoverableError, signIn, signOut, signUp, status, updateEmail, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
