import { createClient } from "@supabase/supabase-js";
import type { TokenVerifier } from "./auth.js";
import { config } from "./config.js";

const authClient =
  config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY
    ? createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export const verifySupabaseAccessToken: TokenVerifier = async (accessToken) => {
  if (!authClient) return { status: "unavailable" };

  try {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error) {
      if (error.status === 400 || error.status === 401) {
        return { status: "invalid" };
      }
      return { status: "unavailable" };
    }

    if (!data.user) return { status: "invalid" };

    return {
      status: "verified",
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        emailConfirmedAt: data.user.email_confirmed_at ?? null,
        createdAt: data.user.created_at,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
};
