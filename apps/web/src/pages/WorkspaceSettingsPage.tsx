import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  INDUSTRIES,
  WorkspaceBusinessInputSchema,
  hasWorkspacePermission,
  type Workspace,
  type WorkspaceRole,
} from "@ai-ads/shared";
import { WorkspaceApiError, getWorkspace, updateWorkspace } from "../api/workspaces";
import { errorsByField } from "../auth/formErrors";
import { useAuth } from "../auth/AuthProvider";
import { Field } from "../components/WorkspaceFields";
import { WorkspaceAppLayout } from "../components/WorkspaceAppLayout";
import { useWorkspace } from "../workspace/WorkspaceContext";

type SettingsForm = {
  name: string;
  industryKey: string;
  industryCustomLabel: string;
  websiteUrl: string;
  countryCode: string;
  timezone: string;
};

function workspaceToForm(workspace: Workspace): SettingsForm {
  return {
    name: workspace.name,
    industryKey: workspace.industryKey,
    industryCustomLabel: workspace.industryCustomLabel ?? "",
    websiteUrl: workspace.websiteUrl ?? "",
    countryCode: workspace.countryCode ?? "",
    timezone: workspace.timezone,
  };
}

export function WorkspaceSettingsPage() {
  const { session, user } = useAuth();
  const { activeWorkspace, refresh } = useWorkspace();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    const accessToken = session?.access_token;
    const userId = user?.id;
    if (!workspaceId || !accessToken || !userId) return;
    const sequence = ++requestSequence.current;
    const identity = userId + ":" + workspaceId;
    setLoadedIdentity(identity);
    setStatus("loading");
    setWorkspace(null);
    setForm(null);
    setErrorMessage("");
    void getWorkspace(accessToken, workspaceId)
      .then((response) => {
        if (requestSequence.current !== sequence) return;
        setWorkspace(response.workspace);
        setRole(response.role);
        setForm(workspaceToForm(response.workspace));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (requestSequence.current !== sequence) return;
        setStatus("error");
        setErrorMessage(error instanceof WorkspaceApiError ? error.message : "Business settings could not be loaded.");
        if (error instanceof WorkspaceApiError && (error.status === 401 || error.status === 404)) void refresh();
      });
    return () => {
      requestSequence.current += 1;
    };
  }, [activeWorkspace?.id, refresh, session?.access_token, user?.id]);

  const currentSettingsLoaded = Boolean(activeWorkspace && loadedIdentity === user?.id + ":" + activeWorkspace.id);
  const canEdit = currentSettingsLoaded && role ? hasWorkspacePermission(role, "workspace.updateSettings") : false;

  function changeField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setErrors((current) => ({ ...current, [key]: "" }));
    setSaveError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !workspace || !session?.access_token || !canEdit) return;
    setSaveError("");
    setSuccess("");
    const parsed = WorkspaceBusinessInputSchema.safeParse({
      ...form,
      slug: workspace.slug,
      industryCustomLabel: form.industryCustomLabel.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      countryCode: form.countryCode.trim() || null,
    });
    if (!parsed.success) {
      setErrors(errorsByField(parsed.error));
      return;
    }
    if (parsed.data.industryKey !== workspace.industryKey) {
      const currentIndustry = INDUSTRIES.find((industry) => industry.key === workspace.industryKey)?.name ?? workspace.industryKey;
      const nextIndustry = INDUSTRIES.find((industry) => industry.key === parsed.data.industryKey)?.name ?? parsed.data.industryKey;
      const accepted = window.confirm(`Change this workspace from ${currentIndustry} to ${nextIndustry}? Existing campaigns, creative projects, Brand Kit assets and reports will be preserved. The new industry only changes future defaults and guidance.`);
      if (!accepted) return;
    }
    setErrors({});
    setSaving(true);
    try {
      const response = await updateWorkspace(session.access_token, workspace.id, {
        name: parsed.data.name,
        industryKey: parsed.data.industryKey,
        industryCustomLabel: parsed.data.industryCustomLabel,
        websiteUrl: parsed.data.websiteUrl,
        countryCode: parsed.data.countryCode,
        timezone: parsed.data.timezone,
      });
      setWorkspace(response.workspace);
      setRole(response.role);
      setForm(workspaceToForm(response.workspace));
      await refresh();
      setSuccess("Business settings saved.");
    } catch (error) {
      setSaveError(error instanceof WorkspaceApiError ? error.message : "Business settings could not be saved. Try again.");
      if (error instanceof WorkspaceApiError && (error.status === 401 || error.status === 404)) void refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceAppLayout title="Business settings">
      <div className="mx-auto max-w-[1050px] px-4 py-8 sm:px-7 sm:py-11 lg:px-10">
        <div className="border-b border-stroke pb-6">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-electric-bright">WORKSPACE SETTINGS</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-foreground">Business identity</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Keep this workspace’s saved business details current. These fields are scoped to its workspace ID.</p>
        </div>

        {(status === "loading" || !currentSettingsLoaded) && <p className="mt-8 text-sm text-slate-400" role="status">Loading authorized workspace settings…</p>}
        {currentSettingsLoaded && status === "error" && <div className="auth-message auth-message-error mt-8" role="alert">{errorMessage}<button className="ml-3 font-medium text-foreground underline" onClick={() => void refresh()} type="button">Retry access check</button></div>}

        {currentSettingsLoaded && status === "ready" && workspace && form && (
          <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
            <section className="rounded-2xl border border-stroke bg-panel p-5 sm:p-7" aria-labelledby="business-form-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-lg font-semibold text-foreground" id="business-form-heading">Business information</h2><p className="mt-1.5 text-xs text-slate-500">Changes save to this workspace only.</p></div>
                <span className="rounded-full border border-stroke px-3 py-1.5 text-[10px] text-slate-400">{role ? role.charAt(0).toUpperCase() + role.slice(1) : "Role unavailable"}</span>
              </div>

              {!canEdit && <p className="auth-message auth-message-info mt-5">Your {role ?? "current"} role can view this business profile but cannot edit restricted settings.</p>}
              <form className="mt-6 grid gap-5 sm:grid-cols-2" noValidate onSubmit={(event) => void handleSubmit(event)}>
                {saveError && <p className="auth-message auth-message-error sm:col-span-2" role="alert">{saveError}</p>}
                {success && <p className="auth-message auth-message-success sm:col-span-2" role="status">{success}</p>}
                <div className="sm:col-span-2"><Field disabled={!canEdit} error={errors.name} id="settings-name" label="Business name" maxLength={120} onChange={(value) => changeField("name", value)} required value={form.name} /></div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="settings-industry">Industry</label>
                  <select aria-invalid={Boolean(errors.industryKey)} className="auth-input w-full rounded-xl border border-stroke bg-input px-3.5 py-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60" disabled={!canEdit} id="settings-industry" onChange={(event) => changeField("industryKey", event.currentTarget.value)} value={form.industryKey}>
                    {INDUSTRIES.map((industry) => <option key={industry.key} value={industry.key}>{industry.name}</option>)}
                  </select>
                  {errors.industryKey && <p className="text-xs text-rose-300" role="alert">{errors.industryKey}</p>}
                  {form.industryKey !== workspace.industryKey && <p className="rounded-lg border border-warning/20 bg-warning/[.05] px-3 py-2 text-[10px] leading-5 text-amber-100" role="status">Industry change preview: future defaults and guidance will use {INDUSTRIES.find((industry) => industry.key === form.industryKey)?.name ?? form.industryKey}. Existing campaigns, creatives, Brand Kit data and historical reporting remain intact.</p>}
                </div>
                {form.industryKey === "other" && <div className="sm:col-span-2"><Field disabled={!canEdit} error={errors.industryCustomLabel} id="settings-custom-industry" label="Custom industry" maxLength={100} onChange={(value) => changeField("industryCustomLabel", value)} required value={form.industryCustomLabel} /></div>}
                <div className="sm:col-span-2"><Field disabled={!canEdit} error={errors.websiteUrl} id="settings-website" label="Website (optional)" onChange={(value) => changeField("websiteUrl", value)} placeholder="https://example.com" type="url" value={form.websiteUrl} /></div>
                <Field disabled={!canEdit} error={errors.countryCode} id="settings-country" label="Country code (optional)" maxLength={2} onChange={(value) => changeField("countryCode", value.toUpperCase())} placeholder="US, GB, IN" value={form.countryCode} />
                <Field disabled={!canEdit} error={errors.timezone} id="settings-timezone" label="Business time zone" onChange={(value) => changeField("timezone", value)} value={form.timezone} />
                <div className="sm:col-span-2 border-t border-stroke pt-5">
                  <button className="rounded-lg bg-electric-bright px-4 py-3 text-xs font-semibold text-slate-950 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50" disabled={!canEdit || saving} type="submit">{saving ? "Saving settings…" : "Save business settings"}</button>
                </div>
              </form>
            </section>

            <aside className="h-fit rounded-2xl border border-stroke bg-panel/65 p-5">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">WORKSPACE BOUNDARY</p>
              <h2 className="mt-2 font-display text-base font-semibold text-foreground">{workspace.name}</h2>
              <dl className="mt-5 space-y-4 text-xs">
                <div><dt className="text-slate-500">Workspace ID</dt><dd className="mt-1 break-all font-mono text-[10px] text-slate-300">{workspace.id}</dd></div>
                <div><dt className="text-slate-500">URL slug</dt><dd className="mt-1 text-slate-300">{workspace.slug}</dd></div>
                <div><dt className="text-slate-500">Created</dt><dd className="mt-1 text-slate-300">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(workspace.createdAt))}</dd></div>
              </dl>
              <p className="mt-5 border-t border-stroke pt-4 text-[10px] leading-5 text-slate-600">The workspace ID—not this display name or URL slug—is the tenant scope for business data.</p>
            </aside>
          </div>
        )}
      </div>
    </WorkspaceAppLayout>
  );
}
