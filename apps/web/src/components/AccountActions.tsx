import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { useProfile } from "../profile/useProfile";

export function AccountActions() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", {
        replace: true,
        state: { notice: "Sign-out encountered an error. Reopen the app and confirm the session has ended." },
      });
    }
  }

  const label = profile?.full_name?.trim() || user?.email || "Account";

  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <Link
        aria-label="Open your profile"
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2.5"
        to="/app/profile"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-electric/30 bg-electric/10 text-[10px] font-semibold text-electric-bright">
          {profile?.full_name?.trim().charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "•"}
        </span>
        <span className="hidden max-w-[150px] truncate sm:block">{label}</span>
      </Link>
      <button
        className="rounded-lg border border-stroke px-2.5 py-2 text-[11px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-foreground disabled:opacity-60 sm:px-3 sm:text-xs"
        disabled={busy}
        onClick={() => void handleSignOut()}
        type="button"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
