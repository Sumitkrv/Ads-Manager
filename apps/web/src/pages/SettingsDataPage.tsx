import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { SettingsApiError, downloadSettingsExport, getClosureRequests, requestAccountClosure, requestWorkspaceClosure } from "../api/settings";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Row = Record<string, unknown>;
const panel = "rounded-2xl border border-stroke bg-panel p-5 sm:p-6";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg border border-electric/35 bg-electric/15 px-4 py-2 text-xs font-semibold text-electric-bright hover:bg-electric/25 disabled:cursor-wait disabled:opacity-50";
function rows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object") : []; }
function date(value: unknown) { if (typeof value !== "string") return "Date unavailable"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed); }

export function SettingsDataPage() {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const token = session?.access_token;
  const workspaceId = activeWorkspace?.id;
  const role = activeWorkspace?.role ?? "viewer";
  const canRequestWorkspaceClosure = role === "owner";
  const canViewWorkspaceRequests = role === "owner" || role === "admin";
  const [accountRequests, setAccountRequests] = useState<Row[]>([]);
  const [workspaceRequests, setWorkspaceRequests] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true); setError("");
    const tasks: Promise<unknown>[] = [getClosureRequests(token)];
    if (workspaceId && canViewWorkspaceRequests) tasks.push(getClosureRequests(token, workspaceId));
    void Promise.all(tasks).then(([account, workspace]) => {
      if (!active) return;
      setAccountRequests(rows((account as Row).requests));
      setWorkspaceRequests(rows((workspace as Row | undefined)?.requests));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof SettingsApiError ? cause.message : "Closure request history could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canViewWorkspaceRequests, token, workspaceId]);

  async function exportData(scope: "account" | "workspace") {
    if (!token || (scope === "workspace" && !workspaceId)) return;
    setBusy(`export-${scope}`); setError(""); setNotice("");
    try {
      const blob = await downloadSettingsExport(token, scope, workspaceId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = scope === "account" ? "tandem-account-export.json" : "tandem-workspace-metadata.json";
      document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setNotice(scope === "account" ? "Your account profile and preferences export was downloaded." : "Authorized workspace metadata was downloaded. Campaign, creative and report exports are available in their existing modules.");
    } catch (cause) { setError(cause instanceof SettingsApiError ? cause.message : "The export could not be downloaded."); }
    finally { setBusy(""); }
  }

  async function closureRequest(scope: "account" | "workspace") {
    if (!token || (scope === "workspace" && (!workspaceId || !canRequestWorkspaceClosure))) return;
    const label = scope === "account" ? "account" : "workspace";
    if (!window.confirm(`Submit a ${label} closure request for administrative review? This will not delete any data or end access automatically.`)) return;
    setBusy(`closure-${scope}`); setError(""); setNotice("");
    try {
      const response = scope === "account" ? await requestAccountClosure(token) : await requestWorkspaceClosure(token, workspaceId!);
      const request = response.request as Row;
      setNotice(`${label === "account" ? "Account" : "Workspace"} closure request recorded for administrative review. No data was deleted.`);
      if (scope === "account") setAccountRequests((current) => [request, ...current]); else setWorkspaceRequests((current) => [request, ...current]);
    } catch (cause) { setError(cause instanceof SettingsApiError ? cause.message : "The closure request could not be submitted."); }
    finally { setBusy(""); }
  }

  function requestList(title: string, items: Row[]) {
    return <div className="mt-4"><h4 className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{title}</h4>{items.length ? <ul className="mt-2 divide-y divide-stroke/70">{items.map((item) => <li className="flex flex-wrap items-center justify-between gap-2 py-2.5" key={String(item.id)}><span className="font-mono text-[9px] text-slate-600">{String(item.id).slice(0, 8)}</span><span className="rounded-full border border-warning/25 bg-warning/[.05] px-2 py-1 text-[9px] text-warning">{String(item.status ?? "pending_review").replaceAll("_", " ")}</span><time className="text-[9px] text-slate-600">{date(item.created_at ?? item.createdAt)}</time></li>)}</ul> : <p className="mt-2 text-[10px] text-slate-500">No closure requests recorded.</p>}</div>;
  }

  return <div className="space-y-5">
    <header className="border-b border-stroke pb-5"><p className="text-[10px] font-semibold tracking-[.19em] text-electric-bright">DATA & PRIVACY</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.03em] text-foreground">Your data and requests</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Exports are limited to information your account or role can access. Closure requests enter administrative review; they do not delete data or close an account.</p></header>
    {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[.06] px-4 py-3 text-xs text-rose-200" role="alert">{error}</p>}
    {notice && <p className="rounded-xl border border-electric/25 bg-electric/[.06] px-4 py-3 text-xs text-electric-bright" role="status">{notice}</p>}
    <section className={panel} aria-labelledby="data-scope-title"><h3 className="text-sm font-semibold text-foreground" id="data-scope-title">Available data categories</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><article className="rounded-xl border border-stroke bg-surface-muted p-4"><p className="text-xs font-medium text-foreground">Account data</p><p className="mt-1.5 text-[10px] leading-5 text-slate-500">Profile identity fields and saved personal preferences.</p><button className={`${button} mt-4`} disabled={busy !== ""} onClick={() => void exportData("account")} type="button">{busy === "export-account" ? "Preparing…" : "Export my profile data"}</button></article><article className="rounded-xl border border-stroke bg-surface-muted p-4"><p className="text-xs font-medium text-foreground">{activeWorkspace?.name ?? "Workspace"} metadata</p><p className="mt-1.5 text-[10px] leading-5 text-slate-500">Workspace identity and defaults. Team members can export authorized workspace metadata.</p><button className={`${button} mt-4`} disabled={!workspaceId || busy !== ""} onClick={() => void exportData("workspace")} type="button">{busy === "export-workspace" ? "Preparing…" : "Export workspace metadata"}</button></article></div><div className="mt-5 border-t border-stroke pt-4"><p className="text-[10px] leading-5 text-slate-500">Campaign CSVs: <Link className="text-electric-bright hover:underline" to="/app/analytics">Analytics</Link> · Saved report exports: <Link className="text-electric-bright hover:underline" to="/app/reports">Reports</Link> · Account and workspace export links are scoped to the signed-in identity and current membership.</p></div></section>
    <section className={panel} aria-labelledby="closure-title"><h3 className="text-sm font-semibold text-foreground" id="closure-title">Closure requests</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">Requests remain pending until an authorized administrator reviews them. Submitting one does not remove membership, terminate billing, or delete records.</p><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-lg border border-warning/25 px-4 py-2.5 text-xs font-medium text-warning hover:bg-warning/[.06] disabled:opacity-50" disabled={busy !== ""} onClick={() => void closureRequest("account")} type="button">{busy === "closure-account" ? "Submitting…" : "Request account closure"}</button>{canRequestWorkspaceClosure && <button className="rounded-lg border border-warning/25 px-4 py-2.5 text-xs font-medium text-warning hover:bg-warning/[.06] disabled:opacity-50" disabled={busy !== "" || !workspaceId} onClick={() => void closureRequest("workspace")} type="button">{busy === "closure-workspace" ? "Submitting…" : "Request workspace closure"}</button>}</div>{loading ? <p className="mt-4 text-xs text-slate-500" role="status">Loading request history…</p> : <div className="grid gap-4 md:grid-cols-2">{requestList("Account requests", accountRequests)}{canViewWorkspaceRequests && requestList("Workspace requests", workspaceRequests)}</div>}{!canRequestWorkspaceClosure && <p className="mt-4 text-[10px] text-slate-600">Only the workspace owner can submit a workspace closure request.</p>}</section>
  </div>;
}
