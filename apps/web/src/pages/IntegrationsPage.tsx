import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { AdvertisingProvider, AdvertisingProviderState } from "@ai-ads/shared";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { WorkspaceRequiredRoute } from "../workspace/WorkspaceRouteGuard";
import {
  disconnectAdvertisingConnection,
  getAdvertisingIntegrations,
  IntegrationApiError,
  selectAdvertisingAccounts,
  startAdvertisingConnection,
  verifyAdvertisingConnection,
} from "../api/integrations";
import type { AdvertisingIntegrationsResponse } from "@ai-ads/shared";

const providerCopy: Record<AdvertisingProvider, { eyebrow: string; description: string; scope: string; mark: string }> = {
  google_ads: {
    eyebrow: "GOOGLE MARKETING PLATFORM",
    description: "Connect Google Ads accounts and manager hierarchies your authorized login can access.",
    scope: "Google Ads API access",
    mark: "G",
  },
  meta_ads: {
    eyebrow: "META BUSINESS TOOLS",
    description: "Discover Meta ad accounts available to the authorized Facebook business login.",
    scope: "Read advertising account access",
    mark: "∞",
  },
};

const persistedStatus: Record<string, { label: string; tone: string }> = {
  accounts_available: { label: "Accounts ready to select", tone: "blue" },
  connected: { label: "Connected and verified", tone: "green" },
  no_accounts: { label: "No accessible ad accounts", tone: "slate" },
  reauthorization_required: { label: "Reauthorization required", tone: "amber" },
  connection_error: { label: "Connection needs attention", tone: "red" },
};

function StatusPill({ label, tone }: { label: string; tone: string }) {
  const colors: Record<string, string> = {
    green: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    blue: "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    amber: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
    red: "border-rose-400/20 bg-rose-400/[0.08] text-rose-200",
    slate: "border-slate-500/20 bg-slate-500/[0.08] text-slate-300",
  };
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold ${colors[tone] ?? colors.slate}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${tone === "green" ? "bg-emerald-300" : tone === "red" ? "bg-rose-300" : tone === "amber" ? "bg-amber-200" : tone === "blue" ? "bg-sky-300" : "bg-slate-400"}`} />{label}</span>;
}

function dateLabel(value: string | null): string {
  if (!value) return "Not yet verified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet verified" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorMessage(error: unknown): string {
  return error instanceof IntegrationApiError ? error.message : "The integration request could not be completed. Try again.";
}

function CallbackNotice({ result, provider }: { result: string | null; provider: string | null }) {
  if (!result) return null;
  const providerName = provider === "meta_ads" ? "Meta Ads" : provider === "google_ads" ? "Google Ads" : "provider";
  const message = result === "accounts_available"
    ? `${providerName} authorization was verified. Review the accounts discovered below.`
    : result === "no_accounts"
      ? `${providerName} authorization was verified, but this login has no accessible ad accounts.`
      : result === "denied"
        ? `Authorization was cancelled. No ${providerName} connection was created.`
        : result === "permission_required"
          ? `${providerName} did not grant the required advertising permission. Reconnect after updating the consent.`
          : result === "reauthorization_required"
            ? `${providerName} authorization must be renewed. Try connecting again.`
            : result === "setup_required"
              ? `${providerName} setup is incomplete on the Tandem Ads server.`
              : "The provider could not complete authorization. Review setup and retry.";
  const good = result === "accounts_available" || result === "no_accounts";
  return <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${good ? "border-sky-400/20 bg-sky-400/[0.06] text-sky-100" : "border-amber-400/20 bg-amber-400/[0.06] text-amber-100"}`} role="status">{message}</div>;
}

function AccountRow({
  account,
  checked,
  disabled,
  onChange,
}: {
  account: AdvertisingProviderState["accounts"][number];
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${checked ? "border-electric/35 bg-electric/[0.07]" : "border-stroke/80 bg-midnight/40 hover:border-slate-600"} ${disabled ? "cursor-default opacity-75" : ""}`}>
      <input aria-label={`Select ${account.name}`} checked={checked} disabled={disabled} onChange={onChange} type="checkbox" className="mt-1 size-4 accent-electric" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-100">{account.name}</span><span className="rounded-md border border-stroke px-2 py-1 text-[9px] font-medium text-slate-400">{account.accountStatus ?? "Provider status unavailable"}</span></span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-slate-500">
          <span>ID {account.externalAccountId}</span>
          {account.currency && <span>{account.currency}</span>}
          {account.timezone && <span>{account.timezone}</span>}
        </span>
        {(account.managerReference || account.businessContext || account.isManager !== null) && <span className="mt-2 block text-[9px] text-slate-500">{account.isManager ? "Manager account" : account.managerReference ? `Manager ${account.managerReference}` : account.businessContext ?? "Provider account"}</span>}
      </span>
    </label>
  );
}

function ProviderCard({
  state,
  canManage,
  selectedAccountIds,
  setSelectedAccountIds,
  onRefresh,
}: {
  state: AdvertisingProviderState;
  canManage: boolean;
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  onRefresh: () => Promise<void>;
}) {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [busy, setBusy] = useState<"connect" | "verify" | "save" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = providerCopy[state.provider];
  const connection = state.connection;
  const persisted = connection ? persistedStatus[connection.status] : null;
  const canConnect = state.configured && canManage && Boolean(session?.access_token && activeWorkspace?.id);

  async function connect() {
    if (!session?.access_token || !activeWorkspace || !canConnect) return;
    setBusy("connect"); setError(null);
    try {
      const result = await startAdvertisingConnection(session.access_token, activeWorkspace.id, state.provider);
      const url = new URL(result.authorizationUrl);
      const expectedHost = state.provider === "google_ads" ? "accounts.google.com" : "www.facebook.com";
      if (url.protocol !== "https:" || url.hostname !== expectedHost) throw new Error("The provider authorization URL was invalid.");
      window.location.assign(url.toString());
    } catch (caught) {
      setError(errorMessage(caught)); setBusy(null);
    }
  }

  async function verify() {
    if (!session?.access_token || !activeWorkspace || !connection || !canManage) return;
    setBusy("verify"); setError(null);
    try {
      await verifyAdvertisingConnection(session.access_token, activeWorkspace.id, connection.id);
      await onRefresh();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  async function saveSelection() {
    if (!session?.access_token || !activeWorkspace || !connection || !canManage) return;
    setBusy("save"); setError(null);
    try {
      await selectAdvertisingAccounts(session.access_token, activeWorkspace.id, connection.id, selectedAccountIds);
      await onRefresh();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  async function disconnect() {
    if (!session?.access_token || !activeWorkspace || !connection || !canManage) return;
    if (!window.confirm(`Remove the ${copy.eyebrow} connection from ${activeWorkspace.name}? This does not revoke access at the provider.`)) return;
    setBusy("disconnect"); setError(null);
    try {
      await disconnectAdvertisingConnection(session.access_token, activeWorkspace.id, connection.id);
      setSelectedAccountIds([]);
      await onRefresh();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(null); }
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds(selectedAccountIds.includes(id)
      ? selectedAccountIds.filter((current) => current !== id)
      : [...selectedAccountIds, id]);
  }

  const selectedCount = useMemo(() => state.accounts.filter((account) => selectedAccountIds.includes(account.id)).length, [selectedAccountIds, state.accounts]);
  const status = persisted ?? (state.configured ? { label: "Ready to connect", tone: "blue" } : { label: "Setup required", tone: "amber" });
  const isBusy = busy !== null;

  return (
    <article className="overflow-hidden rounded-2xl border border-stroke bg-panel shadow-card">
      <div className="border-b border-stroke/80 bg-gradient-to-br from-white/[0.035] to-transparent p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-2xl border text-xl font-bold ${state.provider === "google_ads" ? "border-blue-400/20 bg-blue-400/[0.08] text-blue-300" : "border-indigo-400/20 bg-indigo-400/[0.08] text-indigo-300"}`}>{copy.mark}</div>
            <div className="min-w-0"><p className="text-[9px] font-semibold tracking-[0.2em] text-slate-500">{copy.eyebrow}</p><h2 className="mt-1 font-display text-lg font-semibold text-foreground">{state.displayName}</h2><p className="mt-1.5 max-w-lg text-xs leading-5 text-slate-400">{copy.description}</p></div>
          </div>
          <StatusPill label={status.label} tone={status.tone} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stroke/70 pt-4 text-[10px] text-slate-500">
          <span><span className="text-slate-300">{state.accounts.length}</span> discovered {state.accounts.length === 1 ? "account" : "accounts"}</span>
          {connection && <span><span className="text-slate-300">{selectedCount}</span> selected for this workspace</span>}
          <span>Permission: <span className="text-slate-300">{copy.scope}</span></span>
          {connection && <span>Last verified: <span className="text-slate-300">{dateLabel(connection.verifiedAt)}</span></span>}
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {!state.configured && <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
          <p className="text-xs font-semibold text-amber-100">Server setup required</p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-400">OAuth is unavailable until the server has the approved provider app, callback, developer access and encrypted credential storage configured.</p>
          {state.setupRequirements.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{state.setupRequirements.map((item) => <li key={item} className="rounded-md border border-stroke bg-midnight/60 px-2 py-1 font-mono text-[9px] text-slate-400">{item}</li>)}</ul>}
        </div>}

        {connection?.status === "no_accounts" && <div className="rounded-xl border border-stroke bg-midnight/45 p-4 text-xs leading-5 text-slate-400">Authorization is verified, but this provider returned no accessible advertising accounts for the authorized login.</div>}
        {connection?.status === "reauthorization_required" && <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-xs leading-5 text-amber-100">Access expired or was revoked. Reauthorize to restore account discovery and verification.</div>}
        {connection?.status === "connection_error" && <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.045] p-4 text-xs leading-5 text-rose-100">Verification needs attention{connection.lastErrorCode ? ` (${connection.lastErrorCode})` : ""}. Review provider access or try again.</div>}
        {error && <p className="rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-3.5 py-3 text-xs leading-5 text-rose-100" role="alert">{error}</p>}

        {state.accounts.length > 0 && <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-xs font-semibold text-slate-100">Accessible advertising accounts</h3><p className="mt-1 text-[10px] text-slate-500">Choose which verified accounts belong to this workspace.</p></div>{!canManage && <span className="text-[9px] text-slate-500">View only</span>}</div>
          <div className="space-y-2">{state.accounts.map((account) => <AccountRow key={account.id} account={account} checked={selectedAccountIds.includes(account.id)} disabled={!canManage || isBusy} onChange={() => toggleAccount(account.id)} />)}</div>
          {canManage && <div className="mt-3 flex justify-end"><button className="button-secondary text-[10px]" disabled={isBusy || selectedAccountIds.slice().sort().join(",") === state.accounts.filter((account) => account.selected).map((account) => account.id).sort().join(",")} onClick={() => void saveSelection()} type="button">{busy === "save" ? "Saving selection…" : "Save account selection"}</button></div>}
        </div>}

        <div className="flex flex-wrap gap-2 border-t border-stroke/70 pt-4">
          {state.configured && canManage && <button className="button-primary text-[11px]" disabled={!canConnect || isBusy} onClick={() => void connect()} type="button">{busy === "connect" ? "Starting authorization…" : connection ? "Reconnect provider" : "Connect provider"}</button>}
          {connection && canManage && <button className="button-secondary text-[11px]" disabled={isBusy} onClick={() => void verify()} type="button">{busy === "verify" ? "Verifying access…" : "Refresh account access"}</button>}
          {connection && canManage && <button className="ml-auto rounded-lg border border-rose-300/15 px-3.5 py-2.5 text-[10px] font-semibold text-rose-200 transition hover:border-rose-300/35 hover:bg-rose-300/[0.04] disabled:opacity-50" disabled={isBusy} onClick={() => void disconnect()} type="button">{busy === "disconnect" ? "Removing…" : "Disconnect workspace"}</button>}
          {!canManage && connection && <span className="self-center text-[10px] text-slate-500">Only workspace owners and admins can manage connections.</span>}
        </div>
      </div>
    </article>
  );
}

function IntegrationsContent() {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<AdvertisingIntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [providersDisabled, setProvidersDisabled] = useState(false);
  const [selectedByConnection, setSelectedByConnection] = useState<Record<string, string[]>>({});
  const refreshSequence = useRef(0);
  const callbackResult = searchParams.get("result");
  const callbackProvider = searchParams.get("provider");

  const accessToken = session?.access_token ?? null;
  const workspaceId = activeWorkspace?.id ?? null;

  const refresh = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    const sequence = ++refreshSequence.current;
    setPageError(null);
    setProvidersDisabled(false);
    try {
      const next = await getAdvertisingIntegrations(accessToken, workspaceId);
      if (sequence !== refreshSequence.current) return;
      setPayload(next);
      setSelectedByConnection(Object.fromEntries(next.providers.flatMap((provider) => provider.connection
        ? [[provider.connection.id, provider.accounts.filter((account) => account.selected).map((account) => account.id)]]
        : [])));
    } catch (error) {
      if (sequence === refreshSequence.current) {
        if (error instanceof IntegrationApiError && error.status === 409) setProvidersDisabled(true);
        else setPageError(errorMessage(error));
      }
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [accessToken, workspaceId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return () => { refreshSequence.current += 1; };
  }, [refresh]);

  useEffect(() => {
    if (!callbackResult) return;
    const next = new URLSearchParams(searchParams);
    next.delete("result"); next.delete("provider");
    navigate({ pathname: "/app/integrations", search: next.toString() ? `?${next.toString()}` : "" }, { replace: true });
  }, [callbackResult, navigate, searchParams]);

  const reload = useCallback(async (): Promise<void> => refresh(), [refresh]);

  if (!activeWorkspace) return null;
  const currentPayload = payload?.workspaceId === activeWorkspace.id ? payload : null;
  const canManage = currentPayload?.canManage ?? (activeWorkspace.role === "owner" || activeWorkspace.role === "admin");

  return (
    <WorkspaceAppLayout title="Integrations">
      <div className="mx-auto max-w-[1180px] px-4 pb-14 pt-8 sm:px-7 sm:pt-11 lg:px-10 lg:pt-14">
        <section className="relative overflow-hidden rounded-2xl border border-stroke bg-gradient-to-br from-surface-muted via-panel to-panel p-5 sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-28 size-72 rounded-full bg-electric/[0.09] blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl"><div className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.2em] text-electric-bright"><span>WORKSPACE CONNECTIONS</span><span className="text-slate-600">/</span><span className="text-slate-500">{activeWorkspace.industryKey.replaceAll("_", " ").toUpperCase()}</span></div><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">Advertising integrations</h1><p className="mt-3 max-w-xl text-xs leading-6 text-slate-400 sm:text-sm">Authorize platforms, discover the ad accounts you can access, and choose which belong to <span className="font-medium text-slate-200">{activeWorkspace.name}</span>.</p></div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-midnight/45 px-3.5 py-3"><span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-electric/10 text-electric-bright">⌘</span><div><p className="text-[9px] tracking-wide text-slate-500">ACTIVE WORKSPACE</p><p className="mt-1 max-w-48 truncate text-xs font-medium text-slate-200">{activeWorkspace.name}</p></div></div>
          </div>
        </section>

        <div className="mt-5 space-y-3">
          <CallbackNotice result={callbackResult} provider={callbackProvider} />
          {pageError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-100" role="alert"><span>{pageError}</span><button className="button-secondary text-[10px]" onClick={() => void reload()} type="button">Try again</button></div>}
        </div>

        <section aria-labelledby="providers-heading" className="mt-9">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-semibold tracking-[0.2em] text-slate-500">PROVIDER ACCESS</p><h2 id="providers-heading" className="mt-1.5 font-display text-xl font-semibold text-foreground">Connect an advertising platform</h2></div><p className="text-[10px] text-slate-500">Account discovery only · no campaigns or spend changes</p></div>
          {loading && !currentPayload ? <div className="grid gap-4 xl:grid-cols-2"><div className="h-72 animate-pulse rounded-2xl border border-stroke bg-panel/70" /><div className="h-72 animate-pulse rounded-2xl border border-stroke bg-panel/70" /></div>
            : providersDisabled ? <div className="rounded-2xl border border-electric/15 bg-electric/[.035] p-6 sm:p-8"><p className="text-[9px] font-semibold tracking-[.18em] text-electric-bright">DEMO MODE · PROVIDER ACCESS DISABLED</p><h3 className="mt-3 font-display text-lg font-semibold text-foreground">No advertising account connections are active.</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Google Ads and Meta authorization, account discovery, and provider verification are disabled in this milestone. No account status is being simulated here. Use Campaign Studio to create and review local campaign drafts.</p><Link to="/app/campaigns" className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-electric/25 bg-electric/[.07] px-4 text-xs font-semibold text-electric-bright">Open Campaign Studio <span className="ml-2">→</span></Link></div>
              : currentPayload ? <div className="grid items-start gap-4 xl:grid-cols-2">{currentPayload.providers.map((provider) => <ProviderCard key={provider.provider} state={provider} canManage={canManage} selectedAccountIds={provider.connection ? selectedByConnection[provider.connection.id] ?? [] : []} setSelectedAccountIds={(ids) => { if (provider.connection) setSelectedByConnection((current) => ({ ...current, [provider.connection!.id]: ids })); }} onRefresh={reload} />)}</div>
              : !loading && <div className="rounded-2xl border border-stroke bg-panel p-6 text-sm text-slate-400">Integrations could not be loaded. Verify your workspace access and retry.</div>}
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-xl border border-stroke/80 bg-panel/45 p-4 sm:flex-row sm:items-start">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-500/20 bg-slate-500/[0.07] text-xs text-slate-300">i</span>
          <p className="text-[10px] leading-5 text-slate-500">Each connection is scoped to this workspace. Switching workspaces shows that workspace’s own verified connections. Removing a connection deletes Tandem Ads’ workspace credential and account association; it does not revoke the provider’s authorization.</p>
        </section>

        <div className="mt-6"><Link className="text-[10px] font-medium text-slate-500 transition hover:text-slate-300" to="/app">← Back to overview</Link></div>
      </div>
    </WorkspaceAppLayout>
  );
}

export function IntegrationsPage() {
  return <WorkspaceRequiredRoute><IntegrationsContent /></WorkspaceRequiredRoute>;
}
