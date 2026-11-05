import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { ProfileUpdateInputSchema } from "@ai-ads/shared";
import { useAuth } from "../auth/AuthProvider";
import { errorsByField } from "../auth/formErrors";
import { AccountActions } from "../components/AccountActions";
import { BrandMark } from "../components/AuthLayout";
import { ThemePreferenceSelect, ThemeSwitcher } from "../theme/ThemeSwitcher";
import { useProfile } from "../profile/useProfile";
import { getProfileAvatarUrl, removeProfileAvatar, uploadProfileAvatar } from "../profile/useProfile";

function formatDate(value: string | undefined): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}

export function ProfilePage() {
  const { user } = useAuth();
  const { status, profile, message, saving, updateFullName, updateAvatarPath } = useProfile(user?.id);
  const avatarPath = profile?.avatar_url ?? null;
  const [fullName, setFullName] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    if (status === "ready") setFullName(profile.full_name ?? "");
  }, [profile, status]);

  useEffect(() => {
    if (status !== "ready" || !avatarPath) { setAvatarUrl(null); return; }
    let active = true;
    void getProfileAvatarUrl(avatarPath).then((value) => { if (active) setAvatarUrl(value); }).catch(() => { if (active) { setAvatarUrl(null); setAvatarError("The profile image preview could not be loaded."); } });
    return () => { active = false; };
  }, [avatarPath, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    setFormError("");
    setSuccess("");
    const result = ProfileUpdateInputSchema.safeParse({ fullName });
    if (!result.success) {
      setFieldError(errorsByField(result.error).fullName ?? "Enter your full name.");
      return;
    }
    try {
      await updateFullName(result.data.fullName);
      setFullName(result.data.fullName);
      setSuccess("Your profile was updated.");
    } catch {
      setFormError("Your profile could not be saved. Try again.");
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !user?.id || !profile) return;
    setAvatarBusy(true); setAvatarError(""); setAvatarMessage("");
    let uploadedPath: string | null = null;
    let profileUpdated = false;
    try {
      uploadedPath = await uploadProfileAvatar(user.id, file);
      await updateAvatarPath(uploadedPath);
      profileUpdated = true;
      setAvatarUrl(await getProfileAvatarUrl(uploadedPath));
      let cleanupFailed = false;
      try { await removeProfileAvatar(user.id, profile.avatar_url); } catch { cleanupFailed = true; }
      setAvatarMessage(cleanupFailed ? "Profile image updated. The previous image could not be cleaned up and remains private to your account." : "Profile image updated.");
    } catch (cause) {
      if (uploadedPath && !profileUpdated) await removeProfileAvatar(user.id, uploadedPath).catch(() => undefined);
      setAvatarError(cause instanceof Error ? cause.message : "The profile image could not be updated.");
    } finally { setAvatarBusy(false); input.value = ""; }
  }

  const verificationStatus =
    user?.email_confirmed_at === undefined
      ? "Status unavailable"
      : user.email_confirmed_at
        ? "Verified"
        : "Not verified";

  return (
    <main className="min-h-screen bg-midnight text-slate-100">
      <header className="flex min-h-[76px] items-center justify-between gap-3 border-b border-stroke/80 px-4 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Link aria-label="Tandem Ads home" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/app"><BrandMark /></Link>
          <span className="hidden font-display text-sm font-semibold text-foreground sm:inline">Tandem Ads</span>
          <span aria-hidden="true" className="hidden text-slate-600 sm:inline">/</span>
          <span className="truncate text-xs text-slate-400">Profile</span>
        </div>
        <div className="flex items-center gap-2"><ThemeSwitcher /><AccountActions /></div>
      </header>

      <div className="mx-auto max-w-[1000px] px-5 py-9 sm:px-8 sm:py-12">
        <Link className="text-xs font-medium text-slate-400 hover:text-foreground" to="/app">← Back to workspace</Link>
        <div className="mt-7 flex flex-col justify-between gap-5 border-b border-stroke pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-electric-bright">PERSONAL SETTINGS</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.035em] text-foreground">Your profile</h1>
            <p className="mt-2 text-sm text-slate-400">Manage the personal information attached to your account.</p>
          </div>
          <span className="rounded-full border border-stroke px-3 py-1.5 text-[10px] tracking-wide text-slate-400">PRIVATE TO YOUR ACCOUNT</span>
        </div>

        {status === "loading" && <p className="mt-8 text-sm text-slate-400" role="status">Loading your profile…</p>}
        {(status === "error" || status === "missing") && (
          <div className="auth-message auth-message-error mt-8" role="alert">{message}</div>
        )}

        {status === "ready" && profile && (
          <>
          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
            <section className="rounded-2xl border border-stroke bg-panel p-5 sm:p-7" aria-labelledby="profile-info-heading">
              <div className="flex items-center gap-4 border-b border-stroke pb-6">
                {avatarUrl ? (
                  <img className="size-14 rounded-full border border-stroke object-cover" src={avatarUrl} alt="" />
                ) : (
                  <span aria-hidden="true" className="grid size-14 place-items-center rounded-full border border-electric/30 bg-electric/10 text-xl font-medium text-electric-bright">
                    {profile.full_name?.trim().charAt(0).toUpperCase() || "—"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{profile.full_name?.trim() || "Name not set"}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{user?.email ?? "Email unavailable"}</p>
                </div>
                <label className={`ml-auto inline-flex min-h-9 items-center rounded-lg border border-stroke px-3 py-2 text-[10px] font-medium text-slate-300 hover:border-electric/35 hover:text-foreground ${avatarBusy ? "cursor-wait opacity-50" : "cursor-pointer"}`}>{avatarBusy ? "Uploading…" : profile.avatar_url ? "Change photo" : "Add photo"}<input accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={avatarBusy} onChange={(event) => void handleAvatarUpload(event)} type="file" /></label>
              </div>
              {avatarError && <p className="mt-4 text-xs text-rose-200" role="alert">{avatarError}</p>}
              {avatarMessage && <p className="mt-4 text-xs text-electric-bright" role="status">{avatarMessage}</p>}

              <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
                {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}
                {success && <p className="auth-message auth-message-success" role="status">{success}</p>}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="profile-full-name">Full name</label>
                  <input
                    aria-describedby={fieldError ? "profile-name-error" : undefined}
                    aria-invalid={Boolean(fieldError)}
                    autoComplete="name"
                    className={"auth-input w-full rounded-xl border bg-input px-3.5 py-3 text-sm text-foreground placeholder:text-slate-600 " + (fieldError ? "border-rose-400/60" : "border-stroke hover:border-slate-600")}
                    id="profile-full-name"
                    maxLength={120}
                    onChange={(event) => setFullName(event.currentTarget.value)}
                    value={fullName}
                  />
                  {fieldError && <p className="text-xs text-rose-300" id="profile-name-error" role="alert">{fieldError}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="profile-email">Email</label>
                  <input className="auth-input w-full cursor-not-allowed rounded-xl border border-stroke bg-surface-muted px-3.5 py-3 text-sm text-slate-500" id="profile-email" readOnly value={user?.email ?? ""} />
                </div>
                <button className="rounded-xl bg-electric-bright px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </form>
            </section>

            <aside className="h-fit rounded-2xl border border-stroke bg-panel/70 p-5 sm:p-6" aria-labelledby="account-details-heading">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">ACCOUNT DETAILS</p>
              <h2 className="mt-2 font-display text-lg font-semibold text-foreground" id="account-details-heading">Access information</h2>
              <dl className="mt-6 space-y-5">
                <div>
                  <dt className="text-[10px] tracking-wide text-slate-500">EMAIL VERIFICATION</dt>
                  <dd className="mt-1.5 text-sm text-slate-200">{verificationStatus}</dd>
                </div>
                <div>
                  <dt className="text-[10px] tracking-wide text-slate-500">ACCOUNT CREATED</dt>
                  <dd className="mt-1.5 text-sm text-slate-200">{formatDate(user?.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] tracking-wide text-slate-500">COMPANY ACCESS</dt>
                  <dd className="mt-1.5 text-sm text-slate-200">Not granted by personal signup</dd>
                </div>
              </dl>
            </aside>
          </div>
          <section className="mt-5 rounded-2xl border border-stroke bg-panel p-5 sm:p-7" aria-labelledby="appearance-heading">
            <div className="max-w-xl">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">DISPLAY</p>
              <h2 className="mt-2 font-display text-lg font-semibold text-foreground" id="appearance-heading">Appearance</h2>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">Choose how Tandem Ads looks on this browser. Your selection is shared across your workspaces.</p>
              <ThemePreferenceSelect />
            </div>
          </section>
          </>
        )}
      </div>
    </main>
  );
}
