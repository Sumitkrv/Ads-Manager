import { createClient, type Session } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

function isProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const supabaseConfiguration = {
  configured: isProjectUrl(projectUrl) && publishableKey.length > 0,
  isLocal: isProjectUrl(projectUrl) && ["127.0.0.1", "localhost"].includes(new URL(projectUrl).hostname),
  missing: [
    ...(isProjectUrl(projectUrl) ? [] : ["VITE_SUPABASE_URL"]),
    ...(publishableKey ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
  ],
};

const authStorageKey = isProjectUrl(projectUrl)
  ? `sb-${new URL(projectUrl).hostname.split(".")[0]}-auth-token`
  : "sb-tandem-ads-auth-token";

const previousHostedAuthStorageKey = "sb-cmaxbauxzgvyikheqiyz-auth-token";
const projectHostname = isProjectUrl(projectUrl) ? new URL(projectUrl).hostname : "";
if (projectHostname === "127.0.0.1" || projectHostname === "localhost") {
  try {
    // Retire only Tandem's former hosted-project session on this app origin.
    localStorage.removeItem(previousHostedAuthStorageKey);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function removeStoredSession(storageKey = authStorageKey): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(storageKey);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

type SupabaseClientInstance = ReturnType<typeof createClient>;
type SupabaseHotData = { tandemAdsClient?: { projectUrl: string; storageKey: string; client: unknown } };
const hotData = import.meta.hot?.data as SupabaseHotData | undefined;
const cachedClient = hotData?.tandemAdsClient;
export const supabaseClient = supabaseConfiguration.configured
  ? cachedClient && cachedClient.projectUrl === projectUrl && cachedClient.storageKey === authStorageKey
    ? cachedClient.client as SupabaseClientInstance
    : createClient(projectUrl, publishableKey, {
      auth: {
        storageKey: authStorageKey,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
if (import.meta.hot && supabaseClient) {
  (import.meta.hot.data as SupabaseHotData).tandemAdsClient = {
    projectUrl,
    storageKey: authStorageKey,
    client: supabaseClient,
  };
}

export type AuthService = {
  restoreSession: () => Promise<Session | null>;
  refreshSession: () => Promise<Session | null>;
  subscribe: (listener: (session: Session | null, event: string) => void) => () => void;
  signIn: (email: string, password: string) => Promise<Session | null>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
    emailRedirectTo: string,
  ) => Promise<Session | null>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateEmail: (email: string, redirectTo: string) => Promise<void>;
};

export function createAuthService(
  client: NonNullable<typeof supabaseClient>,
  storageKey = authStorageKey,
): AuthService {
  return {
    async restoreSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async refreshSession() {
      const { data, error } = await client.auth.refreshSession();
      if (error) throw error;
      return data.session;
    },
    subscribe(listener) {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event: string, session: Session | null) =>
        listener(session, event),
      );
      return () => subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },
    async signUp(fullName, email, password, emailRedirectTo) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo,
        },
      });
      if (error) throw error;
      return data.session;
    },
    async resendSignupConfirmation(email) {
      const { error } = await client.auth.resend({ type: "signup", email });
      if (error) throw error;
    },
    async signOut() {
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
      } finally {
        removeStoredSession(storageKey);
      }
    },
    async clearLocalSession() {
      removeStoredSession(storageKey);
    },
    async requestPasswordReset(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },
    async updateEmail(email, redirectTo) {
      const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
      if (error) throw error;
    },
  };
}

export const authService = supabaseClient ? createAuthService(supabaseClient) : null;
