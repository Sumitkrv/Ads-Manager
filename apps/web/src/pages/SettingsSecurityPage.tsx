import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { getWorkspaceSettingsActivity } from "../api/settings";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Row = Record<string, unknown>;
const panel = "rounded-2xl border border-stroke bg-panel p-5 sm:p-6";
const field = "mt-2 min-h-11 w-full rounded-xl border border-stroke bg-input px-3.5 py-2.5 text-sm text-foreground focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg border border-electric/35 bg-electric/15 px-4 py-2 text-xs font-semibold text-electric-bright hover:bg-electric/25 disabled:cursor-wait disabled:opacity-50";
function rows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object") : []; }
function date(value: unknown) { if (typeof value !== "string") return "Date unavailable"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed); }

export function SettingsSecurityPage() {
  const { user, session, updatePassword, updateEmail, signOut } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<Row[]>([]);
  const [activityStatus, setActivityStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [signoutBusy, setSignoutBusy] = useState(false);
  const role = activeWorkspace?.role ?? "viewer";
  const canViewActivity = role === "owner" || role === "admin";
  const emailStatus = useMemo(() => user?.email_confirmed_at ? "Verified" : user?.email_confirmed_at === null ? "Not verified" : "Status unavailable", [user?.email_confirmed_at]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    const token = session?.access_token;
    if (!workspaceId || !token || !canViewActivity) { setActivityStatus("ready"); setActivity([]); return; }
    let current = true; setActivityStatus("loading");
    void getWorkspaceSettingsActivity(token, workspaceId).then((value) => {
      if (current) { setActivity(rows(value.activity)); setActivityStatus("ready"); }
    }).catch(() => { if (current) setActivityStatus("unavailable"); });
    return () => { current = false; };
  }, [activeWorkspace?.id, canViewActivity, session?.access_token]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (password.length < 12 || password.length > 72) { setError("Use a password between 12 and 72 characters."); return; }
    if (password !== confirm) { setError("The password entries do not match."); return; }
    setPasswordBusy(true);
    try { await updatePassword(password); setPassword(""); setConfirm(""); setNotice("Password updated through Supabase Auth."); }
    catch { setError("The password could not be updated. Your session may need to be refreshed; try again or use password reset."); }
    finally { setPasswordBusy(false); }
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const email = nextEmail.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    setEmailBusy(true);
    try {
      await updateEmail(email, `${window.location.origin}/app/settings/security`);
      setNextEmail("");
      setNotice("Email change requested through Supabase Auth. Follow the verification message to confirm the new address.");
    } catch {
      setError("The email change could not be requested. The current verified email remains unchanged.");
    } finally { setEmailBusy(false); }
  }

  async function logout() {
    setSignoutBusy(true); setError("");
    try { await signOut(); navigate("/login", { replace: true }); }
    catch { setError("Sign-out encountered an error. Reopen the app and confirm the session has ended."); navigate("/login", { replace: true }); }
    finally { setSignoutBusy(false); }
  }

  return <div className="space-y-5">
    <header className="border-b border-stroke pb-5"><p className="text-[10px] font-semibold tracking-[.19em] text-electric-bright">ACCOUNT SECURITY</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.03em] text-foreground">Security & access</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Authentication is handled by Supabase Auth. Tandem Ads does not store or display your password or session tokens.</p></header>
    {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[.06] px-4 py-3 text-xs text-rose-200" role="alert">{error}</p>}
    {notice && <p className="rounded-xl border border-electric/25 bg-electric/[.06] px-4 py-3 text-xs text-electric-bright" role="status">{notice}</p>}
    <section className={panel} aria-labelledby="identity-title"><p className="text-[9px] font-semibold tracking-[.16em] text-slate-500">ACCOUNT IDENTITY</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="identity-title">Verified email</h3><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-200">{user?.email ?? "Email unavailable"}</p><p className="mt-1 text-[10px] text-slate-500">Confirmation status: {emailStatus}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] ${user?.email_confirmed_at ? "border-electric/25 bg-electric/[.06] text-electric-bright" : "border-warning/25 bg-warning/[.06] text-warning"}`}>{emailStatus}</span></div><form className="mt-4 grid gap-3 border-t border-stroke pt-4 sm:grid-cols-[1fr_auto]" onSubmit={(event) => void changeEmail(event)}><label className="text-[10px] font-medium text-slate-300" htmlFor="new-email">Change account email<input autoComplete="email" className={field} id="new-email" onChange={(event) => setNextEmail(event.target.value)} required type="email" value={nextEmail}/></label><button className={`${button} self-end`} disabled={emailBusy || !nextEmail} type="submit">{emailBusy ? "Requesting…" : "Request verified change"}</button></form><p className="mt-3 text-[10px] leading-5 text-slate-600">Supabase Auth controls confirmation. Tandem Ads does not change the profile email directly.</p></section>
    <section className={panel} aria-labelledby="password-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-semibold tracking-[.16em] text-slate-500">PASSWORD</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="password-title">Change password</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">The new password is sent only to the active Supabase Auth session. It is never saved to Tandem Ads profile data.</p></div><Link className="text-[10px] font-medium text-electric-bright hover:text-foreground" to="/forgot-password">Use password reset ↗</Link></div>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void changePassword(event)}><label className="text-[10px] font-medium text-slate-300" htmlFor="new-password">New password<input autoComplete="new-password" className={field} id="new-password" maxLength={72} minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password}/><span className="mt-1 block text-[9px] text-slate-600">At least 12 characters.</span></label><label className="text-[10px] font-medium text-slate-300" htmlFor="confirm-password">Confirm password<input autoComplete="new-password" className={field} id="confirm-password" maxLength={72} minLength={12} onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm}/></label><div className="sm:col-span-2"><button className={button} disabled={passwordBusy || !password || !confirm} type="submit">{passwordBusy ? "Updating password…" : "Update password"}</button></div></form>
    </section>
    <section className={`${panel} flex flex-wrap items-center justify-between gap-4`} aria-labelledby="session-title"><div><p className="text-[9px] font-semibold tracking-[.16em] text-slate-500">CURRENT SESSION</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="session-title">Sign out of this browser</h3><p className="mt-1 text-[10px] text-slate-500">Other-session logout and device history are not available in the current authentication SDK flow.</p></div><button className="rounded-lg border border-stroke px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-rose-300/30 hover:text-rose-200 disabled:opacity-50" disabled={signoutBusy} onClick={() => void logout()} type="button">{signoutBusy ? "Signing out…" : "Sign out"}</button></section>
    <section className={panel} aria-labelledby="workspace-security-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-semibold tracking-[.16em] text-slate-500">WORKSPACE SECURITY</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="workspace-security-title">Membership activity</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">Role changes, member removals, invitations and workspace settings are audited without storing invitation links.</p></div>{canViewActivity && <Link className="text-[10px] font-medium text-electric-bright hover:text-foreground" to="/app/settings/team">Team management →</Link>}</div>
      {!canViewActivity ? <p className="mt-4 rounded-xl border border-stroke bg-surface-muted p-3 text-[10px] leading-5 text-slate-500">Your {role} role can review workspace information, but membership security activity is limited to owners and admins.</p> : activityStatus === "loading" ? <p className="mt-4 text-xs text-slate-500" role="status">Loading workspace security activity…</p> : activityStatus === "unavailable" ? <p className="mt-4 text-xs text-slate-500" role="status">Security activity is temporarily unavailable.</p> : activity.length === 0 ? <p className="mt-4 text-xs text-slate-500">No recent workspace security changes are recorded.</p> : <ul className="mt-4 divide-y divide-stroke/70">{activity.slice(0,10).map((item) => <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={String(item.id)}><span className="text-[11px] font-medium text-slate-300">{String(item.action ?? "Activity").replaceAll("_", " ")} <span className="font-normal text-slate-600">{Array.isArray(item.changedFields) ? item.changedFields.join(" · ") : ""}</span></span><time className="text-[9px] text-slate-600">{date(item.createdAt)}</time></li>)}</ul>}
    </section>
    <p className="px-1 text-[9px] leading-5 text-slate-600">No MFA or SSO enforcement is advertised here because it is not configured in this project. No device or login history is fabricated.</p>
  </div>;
}
