import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { getBillingSummary } from "../api/billing";
import { SettingsApiError, changeTeamMemberRole, createTeamInvitation, getSettingsTeam, getWorkspacePreferences, getWorkspaceSettingsActivity, removeTeamMember, revokeTeamInvitation } from "../api/settings";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Row = Record<string, unknown>;
type Member = { id: string; userId: string; fullName: string | null; email: string | null; emailVerified: boolean; avatarUrl: string | null; role: "owner" | "admin" | "editor" | "viewer"; joinedAt: string };
type Invitation = { id: string; workspaceId: string; relationshipId: string | null; email: string; role: "admin" | "editor" | "viewer"; status: string; expiresAt: string; createdAt: string };
const panel = "rounded-2xl border border-stroke bg-panel p-5 sm:p-6";
const field = "min-h-10 w-full rounded-lg border border-stroke bg-input px-3 text-xs text-foreground focus:border-electric/60 focus:outline-none focus:ring-2 focus:ring-electric/15";
const quietButton = "inline-flex min-h-9 items-center justify-center rounded-lg border border-stroke px-3 py-2 text-[11px] font-medium text-slate-300 transition-colors hover:border-electric/35 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = "inline-flex min-h-10 items-center justify-center rounded-lg border border-electric/35 bg-electric/15 px-4 py-2 text-xs font-semibold text-electric-bright transition-colors hover:bg-electric/25 disabled:cursor-wait disabled:opacity-50";
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object") : []; }
function label(value: string) { return value.slice(0, 1).toUpperCase() + value.slice(1); }
function shortId(value: string) { return value.slice(0, 8); }
function time(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
function invitationStatus(item: Invitation) { return item.status === "pending" && new Date(item.expiresAt).getTime() <= Date.now() ? "expired" : item.status; }

export function SettingsTeamPage() {
  const { session, user } = useAuth();
  const { activeWorkspace, refresh } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activity, setActivity] = useState<Row[]>([]);
  const [teamStatus, setTeamStatus] = useState<"loading" | "ready" | "error">("loading");
  const [teamError, setTeamError] = useState("");
  const [activityNotice, setActivityNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteStatus, setInviteStatus] = useState("pending");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">(activeWorkspace?.role === "admin" ? "editor" : "admin");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [seatLoading, setSeatLoading] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const requestSequence = useRef(0);
  const workspaceId = activeWorkspace?.id;
  const token = session?.access_token;
  const role = activeWorkspace?.role ?? "viewer";
  const canManage = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    if (!workspaceId || !token || !canManage) return;
    const sequence = ++requestSequence.current;
    setTeamStatus("loading"); setTeamError("");
    try {
      const result = await getSettingsTeam(token, workspaceId);
      if (requestSequence.current !== sequence) return;
      setMembers(result.members as Member[]);
      setInvitations(result.invitations as Invitation[]);
      setTeamStatus("ready");
      void getWorkspaceSettingsActivity(token, workspaceId).then((value) => {
        if (requestSequence.current === sequence) setActivity(rows(value.activity));
      }).catch(() => {
        if (requestSequence.current === sequence) setActivityNotice("Recent settings activity is unavailable.");
      });
    } catch (error) {
      if (requestSequence.current !== sequence) return;
      setTeamStatus("error");
      setTeamError(error instanceof SettingsApiError ? error.message : "The workspace team could not be loaded.");
      if (error instanceof SettingsApiError && (error.status === 401 || error.status === 404)) void refresh();
    }
  }, [canManage, refresh, token, workspaceId]);

  useEffect(() => {
    setMembers([]); setInvitations([]); setActivity([]); setInviteLink(""); setInviteNotice("");
    if (!workspaceId || !token) return;
    if (!canManage) { setTeamStatus("ready"); return; }
    void load();
    return () => { requestSequence.current += 1; };
  }, [canManage, load, token, workspaceId]);

  useEffect(() => { setInviteRole(role === "owner" ? "admin" : "editor"); }, [role, workspaceId]);

  useEffect(() => {
    if (!token || !workspaceId || !canManage) { setDensity("comfortable"); return; }
    let active = true;
    void getWorkspacePreferences(token, workspaceId).then((preferences) => { if (active) setDensity(preferences.displayDensity); }).catch(() => { if (active) setDensity("comfortable"); });
    return () => { active = false; };
  }, [canManage, token, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !token) { setSeatLimit(null); return; }
    let current = true; setSeatLoading(true);
    void getBillingSummary(token, workspaceId).then((summary) => {
      if (!current) return;
      const limits = object(summary.limits);
      const seats = limits.seats;
      setSeatLimit(typeof seats === "number" ? seats : null);
    }).catch(() => { if (current) setSeatLimit(null); }).finally(() => { if (current) setSeatLoading(false); });
    return () => { current = false; };
  }, [token, workspaceId]);

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const text = `${member.fullName ?? ""} ${member.email ?? ""} ${member.userId}`.toLowerCase();
    return matchesRole && text.includes(query.trim().toLowerCase());
  }), [members, query, roleFilter]);
  const filteredInvitations = useMemo(() => invitations.filter((item) => inviteStatus === "all" || invitationStatus(item) === inviteStatus), [invitations, inviteStatus]);
  const pendingInvitations = invitations.filter((item) => item.status === "pending" && new Date(item.expiresAt).getTime() > Date.now()).length;

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createInvitationLink(email, inviteRole);
  }

  async function createInvitationLink(emailValue: string, roleValue: Invitation["role"]) {
    if (!token || !workspaceId || !canManage) return;
    setInviteError(""); setInviteNotice(""); setInviteLink(""); setCopyNotice(""); setInviteBusy(true);
    try {
      const created = await createTeamInvitation(token, workspaceId, emailValue, roleValue);
      const link = typeof created.invitationLink === "string" ? created.invitationLink : "";
      setInviteLink(link);
      setInviteNotice(typeof created.copyInstruction === "string" ? created.copyInstruction : "Invitation link created — not emailed.");
      setEmail("");
      await load();
    } catch (error) {
      setInviteError(error instanceof SettingsApiError ? error.message : "The invitation link could not be created.");
    } finally { setInviteBusy(false); }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyNotice("Invitation link copied.");
    } catch {
      setCopyNotice("Copy is unavailable here. Select and copy the link below.");
    }
  }

  async function changeRole(member: Member, nextRole: Member["role"]) {
    if (!token || !workspaceId || !canManage || nextRole === "owner" || nextRole === member.role || member.role === "owner" || member.userId === user?.id) return;
    const prompt = `Change ${member.fullName || `member ${shortId(member.userId)}`} from ${member.role} to ${nextRole}?`;
    if (!window.confirm(prompt)) return;
    setActionBusy(member.userId); setTeamError("");
    try { await changeTeamMemberRole(token, workspaceId, member.userId, nextRole); await load(); }
    catch (error) { setTeamError(error instanceof SettingsApiError ? error.message : "The member role could not be changed."); }
    finally { setActionBusy(null); }
  }

  async function remove(member: Member) {
    if (!token || !workspaceId || !canManage || member.role === "owner" || member.userId === user?.id) return;
    if (!window.confirm(`Remove ${member.fullName || `member ${shortId(member.userId)}`} from ${activeWorkspace?.name ?? "this workspace"}?`)) return;
    setActionBusy(member.userId); setTeamError("");
    try { await removeTeamMember(token, workspaceId, member.userId); await load(); }
    catch (error) { setTeamError(error instanceof SettingsApiError ? error.message : "The member could not be removed."); }
    finally { setActionBusy(null); }
  }

  async function revoke(invitation: Invitation) {
    if (!token || !workspaceId) return;
    if (!window.confirm(`Revoke the invitation for ${invitation.email}? The current link will stop working.`)) return;
    setActionBusy(invitation.id); setTeamError("");
    try { await revokeTeamInvitation(token, workspaceId, invitation.id); await load(); }
    catch (error) { setTeamError(error instanceof SettingsApiError ? error.message : "The invitation could not be revoked."); }
    finally { setActionBusy(null); }
  }

  if (!canManage) return <section className={panel}><p className="text-[10px] font-semibold tracking-[.18em] text-electric-bright">TEAM ACCESS</p><h2 className="mt-2 font-display text-xl font-semibold text-foreground">Team administration is restricted</h2><p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">Your {role} membership does not include team administration. Workspace owners and admins can review members, invitations and membership activity.</p></section>;

  return <div className="space-y-5">
    <header className="border-b border-stroke pb-5"><p className="text-[10px] font-semibold tracking-[.19em] text-electric-bright">WORKSPACE ACCESS</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold tracking-[-.03em] text-foreground">Team & invitations</h2><p className="mt-2 text-xs text-slate-500">Manage membership for <span className="font-medium text-slate-300">{activeWorkspace?.name}</span>. Email delivery is not configured.</p></div><Link className={quietButton} to="/app/billing/usage">Review seat usage</Link></div></header>
    {teamError && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[.06] px-4 py-3 text-xs text-rose-200" role="alert">{teamError}</p>}
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Workspace seat summary">
      <div className={`${panel} p-4`}><p className="text-[9px] font-semibold tracking-[.15em] text-slate-500">ACTIVE MEMBERS</p><p className="mt-2 text-2xl font-semibold text-foreground">{teamStatus === "ready" ? members.length : "—"}</p></div>
      <div className={`${panel} p-4`}><p className="text-[9px] font-semibold tracking-[.15em] text-slate-500">PENDING INVITATIONS</p><p className="mt-2 text-2xl font-semibold text-foreground">{teamStatus === "ready" ? pendingInvitations : "—"}</p></div>
      <div className={`${panel} p-4`}><p className="text-[9px] font-semibold tracking-[.15em] text-slate-500">SEAT ALLOWANCE</p><p className="mt-2 text-2xl font-semibold text-foreground">{seatLoading ? "…" : seatLimit === null ? "Plan details" : seatLimit < 0 ? "Unlimited" : `${members.length + pendingInvitations} / ${seatLimit}`}</p><p className="mt-1 text-[10px] text-slate-500">{seatLimit === null ? <Link className="text-electric-bright" to="/app/billing">See plan usage ↗</Link> : `${members.length} active · ${pendingInvitations} pending seat reservations.`}</p></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(290px,.7fr)]">
      <section className={panel} aria-labelledby="members-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-foreground" id="members-title">Workspace members</h3><p className="mt-1 text-[10px] text-slate-500">Member emails are private to account authentication. Names are shown only to people sharing this workspace.</p></div><span className="rounded-full border border-stroke px-2.5 py-1 text-[9px] text-slate-500">{label(role)}</span></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_145px]"><label className="sr-only" htmlFor="team-search">Search members</label><input className={field} id="team-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or member ID" value={query}/><label className="sr-only" htmlFor="team-role-filter">Filter members by role</label><select className={field} id="team-role-filter" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}><option value="all">All roles</option><option value="owner">Owner</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></div>
        {teamStatus === "loading" && <p className="py-10 text-center text-xs text-slate-500" role="status">Loading workspace members…</p>}
        {teamStatus === "error" && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[.05] p-4 text-xs text-rose-200" role="alert">{teamError}<button className="ml-3 underline" onClick={() => void load()} type="button">Retry</button></div>}
        {teamStatus === "ready" && <div className="mt-4 overflow-x-auto"><table className={`w-full min-w-[690px] border-collapse text-left ${density === "compact" ? "team-density-compact" : ""}`}><thead><tr className="border-b border-stroke text-[9px] font-semibold tracking-[.12em] text-slate-600"><th className="px-2 py-3">MEMBER</th><th className="px-2 py-3">ROLE</th><th className="px-2 py-3">JOINED</th><th className="px-2 py-3 text-right">ACTIONS</th></tr></thead><tbody>{filteredMembers.map((member) => {
          const isSelf = member.userId === user?.id;
          const roleEditable = member.role !== "owner" && !isSelf && (role === "owner" || member.role !== "admin");
          const removable = member.role !== "owner" && !isSelf && (role === "owner" || member.role !== "admin");
          const name = member.fullName?.trim() || `Member ${shortId(member.userId)}`;
          return <tr className="border-b border-stroke/60 last:border-0" key={member.id}><td className="px-2 py-3.5"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-stroke bg-surface-muted text-xs font-semibold text-electric-bright">{member.avatarUrl ? <img alt="" className="size-full object-cover" src={member.avatarUrl}/> : name.slice(0,1).toUpperCase()}</span><span className="min-w-0"><span className="block max-w-[220px] truncate text-xs font-medium text-foreground">{name}{isSelf && <span className="ml-1.5 text-[9px] text-slate-500">You</span>}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{member.emailVerified && member.email ? member.email : "Verified email unavailable"}</span><span className="mt-1 block font-mono text-[9px] text-slate-600">{member.userId}</span></span></div></td><td className="px-2 py-3.5"><label className="sr-only" htmlFor={`role-${member.id}`}>Role for {name}</label><select className="min-h-8 rounded-lg border border-stroke bg-input px-2 text-[10px] text-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={!roleEditable || actionBusy === member.userId} id={`role-${member.id}`} onChange={(event) => void changeRole(member, event.target.value as Member["role"])} value={member.role}><option value="owner">Owner</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></td><td className="px-2 py-3.5 text-[10px] text-slate-500">{time(member.joinedAt)}</td><td className="px-2 py-3.5 text-right"><button className="rounded-lg px-2.5 py-2 text-[10px] font-medium text-slate-500 hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={!removable || actionBusy === member.userId} onClick={() => void remove(member)} type="button">{actionBusy === member.userId ? "Saving…" : "Remove"}</button></td></tr>;
        })}</tbody></table>{filteredMembers.length === 0 && <p className="py-10 text-center text-xs text-slate-500">No members match this search.</p>}</div>}
      </section>
      <section className={panel} aria-labelledby="invite-title"><p className="text-[9px] font-semibold tracking-[.16em] text-electric-bright">NEW INVITATION</p><h3 className="mt-2 text-sm font-semibold text-foreground" id="invite-title">Create a team link</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">The recipient must sign in with this email address and verify it before joining. The link expires in seven days.</p>
        <form className="mt-5 space-y-4" onSubmit={(event) => void invite(event)}><label className="block text-[10px] font-medium text-slate-300" htmlFor="invite-email">Work email<input autoComplete="email" className={`${field} mt-2`} id="invite-email" maxLength={320} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required type="email" value={email}/></label><label className="block text-[10px] font-medium text-slate-300" htmlFor="invite-role">Workspace role<select className={`${field} mt-2`} id="invite-role" onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)} value={inviteRole}><option value="editor">Editor · create and review work</option><option value="viewer">Viewer · read permitted workspace data</option>{role === "owner" && <option value="admin">Admin · manage operational settings</option>}</select></label>{inviteError && <p className="text-xs text-rose-200" role="alert">{inviteError}</p>}<button className={`${primaryButton} w-full`} disabled={inviteBusy || !email.trim()} type="submit">{inviteBusy ? "Creating link…" : "Create invitation link"}</button></form>
        {inviteNotice && <div className="mt-4 rounded-xl border border-electric/20 bg-electric/[.06] p-3" role="status"><p className="text-[11px] font-semibold text-electric-bright">Invitation link created — not emailed.</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{inviteNotice}</p>{inviteLink && <><button className={`${quietButton} mt-3 w-full`} onClick={() => void copyLink()} type="button">Copy invitation link</button><label className="mt-3 block text-[9px] text-slate-500" htmlFor="invitation-link">Link for manual sharing<input className={`${field} mt-1 font-mono text-[9px]`} id="invitation-link" onFocus={(event) => event.currentTarget.select()} readOnly value={inviteLink}/></label>{copyNotice && <p className="mt-2 text-[10px] text-slate-300" aria-live="polite">{copyNotice}</p>}</>}</div>}
        <p className="mt-4 border-t border-stroke pt-4 text-[10px] leading-5 text-slate-600">No invitation email is sent. Creating a fresh invitation for the same address revokes its older pending link.</p>
      </section>
    </div>
    <section className={panel} aria-labelledby="invitations-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-foreground" id="invitations-title">Invitation history</h3><p className="mt-1 text-[10px] text-slate-500">Only secure token hashes are stored. Raw links are never returned when the list is refreshed.</p></div><label className="sr-only" htmlFor="invite-filter">Filter invitations</label><select className={`${field} w-auto min-w-[150px]`} id="invite-filter" onChange={(event) => setInviteStatus(event.target.value)} value={inviteStatus}><option value="pending">Pending</option><option value="all">All statuses</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="revoked">Revoked</option><option value="expired">Expired</option></select></div>
      {teamStatus === "ready" && filteredInvitations.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-stroke px-5 py-8 text-center text-xs text-slate-500">No invitations in this view.</p>}
      <div className="mt-4 space-y-2">{filteredInvitations.map((invitation) => {
        const status = label(invitationStatus(invitation));
        return <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stroke/80 bg-surface-muted p-3.5" key={invitation.id}><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{invitation.email}</p><p className="mt-1 text-[10px] text-slate-500">{label(invitation.role)} · {status} · Expires {time(invitation.expiresAt)}{invitation.relationshipId ? " · Agency relationship" : ""}</p></div><div className="flex flex-wrap gap-2">{invitation.status === "pending" && !invitation.relationshipId && (role === "owner" || invitation.role !== "admin") && <button className={quietButton} disabled={inviteBusy} onClick={() => { setEmail(invitation.email); setInviteRole(invitation.role); void createInvitationLink(invitation.email, invitation.role); }} type="button">Create replacement link</button>}{invitation.status === "pending" && <button className={quietButton} disabled={actionBusy === invitation.id} onClick={() => void revoke(invitation)} type="button">{actionBusy === invitation.id ? "Working…" : "Revoke link"}</button>}</div></article>;
      })}</div>
    </section>
    <section className={panel} aria-labelledby="activity-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-foreground" id="activity-title">Recent workspace activity</h3><p className="mt-1 text-[10px] text-slate-500">Membership, invitation and business setting events. Sensitive values and invitation tokens are not included.</p></div><Link className="text-[10px] font-medium text-electric-bright hover:text-foreground" to="/app/settings/security">Security details →</Link></div>{activityNotice && <p className="mt-3 text-[10px] text-slate-500" role="status">{activityNotice}</p>}{activity.length === 0 ? <p className="mt-4 text-xs text-slate-500">No recent membership or settings changes were recorded.</p> : <ul className="mt-4 divide-y divide-stroke/70">{activity.slice(0,8).map((item) => <li className="flex flex-wrap justify-between gap-2 py-3" key={String(item.id)}><span><span className="block text-[11px] font-medium text-slate-300">{String(item.action).replaceAll("_", " ")}</span><span className="mt-1 block text-[9px] text-slate-600">{Array.isArray(item.changedFields) ? item.changedFields.join(" · ") : "Workspace activity"}</span></span><time className="text-[9px] text-slate-600">{typeof item.createdAt === "string" ? time(item.createdAt) : "Date unavailable"}</time></li>)}</ul>}</section>
  </div>;
}
