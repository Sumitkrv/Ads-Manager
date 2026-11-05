import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  INDUSTRIES, INDUSTRY_ONBOARDING_GUIDANCE, IndustryKeySchema, WorkspaceBusinessInputSchema,
  type BrandKitInput, type IndustryKey, type OnboardingPath, type OnboardingSetupData,
} from "@ai-ads/shared";
import { AccountActions } from "../components/AccountActions";
import { BrandMark } from "../components/AuthLayout";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import { useAuth } from "../auth/AuthProvider";
import { getUserOnboarding, getWorkspaceOnboarding, recordActivationEvent, saveUserOnboarding, saveWorkspaceOnboarding } from "../api/onboarding";
import { getBrandKit, saveBrandKit, uploadCreativeAsset } from "../api/creatives";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { getIndustryName } from "../workspace/industryLabels";

type FormValues = {
  name: string; slug: string; industryKey: IndustryKey | ""; industryCustomLabel: string;
  websiteUrl: string; countryCode: string; timezone: string; businessDescription: string;
  primaryRegion: string; mainOffering: string; marketingObjective: string; campaignGoal: NonNullable<OnboardingSetupData["campaignGoal"]>;
  platformFormat: "google_ads" | "meta_ads"; budgetRange: "under_500" | "500_2000" | "2000_5000" | "5000_plus" | "not_sure";
  audience: string; brandTone: "clear" | "warm" | "confident" | "playful" | "premium" | "expert";
  ctaPreference: "direct" | "warm" | "minimal" | "confident" | "custom";
};

const initialForm = (): FormValues => ({
  name: "", slug: "", industryKey: "", industryCustomLabel: "", websiteUrl: "", countryCode: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", businessDescription: "",
  primaryRegion: "", mainOffering: "", marketingObjective: "", campaignGoal: "lead_generation",
  platformFormat: "google_ads", budgetRange: "not_sure", audience: "", brandTone: "clear", ctaPreference: "direct",
});
const stages = ["Path", "Industry", "Business", "Preferences", "Review", "Brand Kit", "Demo mode"];
const inputClass = "min-h-11 w-full rounded-xl border border-stroke bg-input px-3.5 text-sm text-foreground outline-none transition placeholder:text-slate-500 focus:border-electric/60 focus:ring-2 focus:ring-electric/15";
const buttonPrimary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-electric/35 bg-electric/10 px-5 py-3 text-sm font-semibold text-electric-bright transition hover:bg-electric/20 disabled:cursor-not-allowed disabled:opacity-50";
const buttonSecondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-stroke bg-surface-muted px-4 py-3 text-sm font-medium text-foreground transition hover:bg-surface-hover";

function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function slugFromName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
}
function businessInput(form: FormValues) {
  return {
    name: form.name, slug: form.slug, industryKey: form.industryKey,
    industryCustomLabel: form.industryKey === "other" ? form.industryCustomLabel.trim() || null : null,
    websiteUrl: form.websiteUrl.trim() || null, countryCode: form.countryCode.trim() || null, timezone: form.timezone,
  };
}
function setupData(form: FormValues): OnboardingSetupData {
  return {
    businessDescription: form.businessDescription, primaryRegion: form.primaryRegion, mainOffering: form.mainOffering,
    marketingObjective: form.marketingObjective, campaignGoal: form.campaignGoal,
    platformFormat: form.platformFormat, budgetRange: form.budgetRange, audience: form.audience,
    brandTone: form.brandTone, ctaPreference: form.ctaPreference,
  };
}
function defaultBrand(form: FormValues): BrandKitInput {
  return {
    displayName: form.name || "My business", tagline: "", mainMessage: form.mainOffering, description: form.businessDescription,
    primaryColor: "#23304A", secondaryColor: "#8297F5", accentColors: [], backgroundPreferences: ["#101827", "#F6F8FC"],
    savedPalettes: [], headingFont: "Inter", bodyFont: "Inter", tone: form.brandTone,
    ctaStyle: form.ctaPreference, website: form.websiteUrl.trim() ? form.websiteUrl.trim() : null,
    socialHandles: {}, industry: form.industryKey as IndustryKey,
    industryLabel: form.industryKey === "other" ? form.industryCustomLabel.trim() || null : null,
    logoAssetId: null, alternateLogoAssetId: null,
  };
}

function Label({ htmlFor, children, required = false }: { htmlFor: string; children: string; required?: boolean }) {
  return <label className="mb-2 block text-xs font-medium text-foreground" htmlFor={htmlFor}>{children}{required && <span className="ml-1 text-electric-bright">*</span>}</label>;
}
function IndustryIcon({ type }: { type: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v10h13V9M9 19v-6h6v6" /></>,
    bag: <><path d="M4 8h16l-1 12H5L4 8Z" /><path d="M8 8a4 4 0 0 1 8 0" /></>,
    health: <><path d="M12 20s-8-4.8-8-11a4.2 4.2 0 0 1 8-1.8A4.2 4.2 0 0 1 20 9c0 6.2-8 11-8 11Z" /><path d="M8.5 12h2l1-2 1.5 4 1-2h2" /></>,
    education: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5M22 9v6" /></>,
    fitness: <><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></>,
    dining: <><path d="M4 3v7M7 3v7M4 7h3M5.5 10v11M14 3v18M14 3c4 2 5 6 0 8" /></>,
    hospitality: <><path d="M3 20V5h18v15M3 13h18M7 9h3M14 9h3M7 16h3M14 16h3" /></>,
    travel: <><path d="m3 12 18-8-7 17-3-7-8-2Z" /><path d="m11 14 5-5" /></>,
    auto: <><path d="m4 14 2-6h12l2 6v5h-2v-2H6v2H4v-5Z" /><path d="M6 14h12M7 17h.01M17 17h.01" /></>,
    beauty: <><path d="M12 3v18M5 7h14M7 7v4a5 5 0 0 0 10 0V7" /><path d="M9 3h6" /></>,
    services: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 5V3h8v2M3 10h18M10 10v2h4v-2" /></>,
    agency: <><path d="M4 17V7l8-4 8 4v10l-8 4-8-4Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>,
    tools: <><path d="m14 6 4-3 3 3-3 4M13 7 5 15a3 3 0 0 0 4 4l8-8" /><path d="m5 19-2 2" /></>,
    finance: <><path d="M3 9h18L12 4 3 9ZM5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></>,
    events: <><path d="M4 5h16v15H4zM8 3v4M16 3v4M4 9h16" /><path d="m9 14 2 2 4-4" /></>,
    other: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  };
  return <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" {...common}>{paths[type] ?? paths.other}</svg>;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { createWorkspace: createWorkspaceRequest, activeWorkspace, selectWorkspace, status: workspaceStatus, workspaces } = useWorkspace();
  const token = session?.access_token;
  const [path, setPath] = useState<OnboardingPath>("business");
  const [form, setForm] = useState<FormValues>(initialForm);
  const [step, setStep] = useState(0);
  const [industrySearch, setIndustrySearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [allowAnotherWorkspace, setAllowAnotherWorkspace] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandKitInput | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const loadedUser = useRef<string | null>(null);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const workspacesRef = useRef(workspaces);
  const selectWorkspaceRef = useRef(selectWorkspace);
  workspacesRef.current = workspaces;
  selectWorkspaceRef.current = selectWorkspace;
  const filteredIndustries = useMemo(() => {
    const term = industrySearch.trim().toLocaleLowerCase();
    return term ? INDUSTRIES.filter((item) => (item.name + " " + item.description).toLocaleLowerCase().includes(term)) : INDUSTRIES;
  }, [industrySearch]);
  const guidance = form.industryKey ? INDUSTRY_ONBOARDING_GUIDANCE[form.industryKey] : null;
  const existingWorkspace = activeWorkspace ?? workspaces[0] ?? null;

  useEffect(() => {
    if (!token || !session?.user.id || workspaceStatus !== "ready" || loadedUser.current === session.user.id) return;
    loadedUser.current = session.user.id;
    void (async () => {
      try {
        const preferences = await getUserOnboarding(token);
        if (!mounted.current) return;
        if (preferences) {
          const draft = preferences.draft;
          setPath(preferences.setupPath);
          setRequestId(draft.requestId ?? newRequestId());
          setForm((value) => ({
            ...value, name: draft.businessName ?? value.name, slug: draft.businessName ? slugFromName(draft.businessName) : value.slug,
            industryKey: IndustryKeySchema.safeParse(draft.industryKey).success ? draft.industryKey as IndustryKey : value.industryKey,
            industryCustomLabel: draft.industryCustomLabel ?? value.industryCustomLabel, websiteUrl: draft.websiteUrl ?? value.websiteUrl,
            countryCode: draft.countryCode ?? value.countryCode, timezone: draft.timezone ?? value.timezone,
            businessDescription: draft.businessDescription ?? value.businessDescription, primaryRegion: draft.primaryRegion ?? value.primaryRegion,
            mainOffering: draft.mainOffering ?? value.mainOffering, marketingObjective: draft.marketingObjective ?? value.marketingObjective,
            campaignGoal: draft.campaignGoal ?? value.campaignGoal, platformFormat: draft.platformFormat ?? value.platformFormat,
            budgetRange: draft.budgetRange ?? value.budgetRange, audience: draft.audience ?? value.audience,
            brandTone: draft.brandTone ?? value.brandTone, ctaPreference: draft.ctaPreference ?? value.ctaPreference,
          }));
          if (typeof draft.currentStep === "number") setStep(Math.min(4, draft.currentStep));
          if (draft.createdWorkspaceId && workspacesRef.current.some((workspace) => workspace.id === draft.createdWorkspaceId)) {
            const workspace = workspacesRef.current.find((item) => item.id === draft.createdWorkspaceId);
            if (workspace) {
              await selectWorkspaceRef.current(workspace.id);
              const progress = await getWorkspaceOnboarding(token, workspace.id);
              if (!mounted.current) return;
              if (progress && !progress.completedAt) {
                setWorkspaceId(workspace.id);
                setForm((value) => ({
                  ...value,
                  businessDescription: progress.setupData.businessDescription ?? value.businessDescription,
                  primaryRegion: progress.setupData.primaryRegion ?? value.primaryRegion,
                  mainOffering: progress.setupData.mainOffering ?? value.mainOffering,
                  marketingObjective: progress.setupData.marketingObjective ?? value.marketingObjective,
                  campaignGoal: progress.setupData.campaignGoal ?? value.campaignGoal,
                  platformFormat: progress.setupData.platformFormat ?? value.platformFormat,
                  budgetRange: progress.setupData.budgetRange ?? value.budgetRange,
                  audience: progress.setupData.audience ?? value.audience,
                  brandTone: progress.setupData.brandTone ?? value.brandTone,
                  ctaPreference: progress.setupData.ctaPreference ?? value.ctaPreference,
                }));
                setStep(Math.max(5, progress.currentStep));
                const storedBrand = await getBrandKit(token, workspace.id).catch(() => null);
                if (mounted.current && storedBrand) {
                  const { workspaceId: _workspaceId, revision: _revision, updatedAt: _updatedAt, ...brandInput } = storedBrand;
                  setBrand(brandInput);
                  setBrandSaved(Boolean(storedBrand.updatedAt));
                }
              }
            }
          }
        }
      } catch {
        if (mounted.current) setFormError("Your saved setup could not be loaded. You can continue, and your changes will retry automatically.");
      } finally {
        if (mounted.current) setPreferencesLoaded(true);
      }
    })();
  }, [token, session?.user.id, workspaceStatus]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const preferenceDraft = useMemo(() => ({
    businessName: form.name, industryKey: form.industryKey || undefined, industryCustomLabel: form.industryCustomLabel,
    websiteUrl: form.websiteUrl, countryCode: form.countryCode, timezone: form.timezone,
    businessDescription: form.businessDescription, primaryRegion: form.primaryRegion, mainOffering: form.mainOffering,
    marketingObjective: form.marketingObjective, campaignGoal: form.campaignGoal, platformFormat: form.platformFormat,
    budgetRange: form.budgetRange, audience: form.audience, brandTone: form.brandTone, ctaPreference: form.ctaPreference,
    currentStep: step, requestId, ...(workspaceId ? { createdWorkspaceId: workspaceId } : {}),
  }), [form, requestId, step, workspaceId]);
  useEffect(() => {
    if (!token || !preferencesLoaded || workspaceId || path === "join") return;
    const timer = window.setTimeout(() => {
      saveChain.current = saveChain.current.then(() => saveUserOnboarding(token, { setupPath: path, draft: preferenceDraft }))
        .then(() => setDraftNotice("Progress saved"))
        .catch(() => setDraftNotice("Working offline — your form is still open"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [token, preferencesLoaded, workspaceId, path, preferenceDraft]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    if (createAttempted && ["name", "slug", "industryKey", "industryCustomLabel", "websiteUrl", "countryCode", "timezone"].includes(key)) {
      setRequestId(newRequestId());
      setCreateAttempted(false);
    }
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugFromName(String(value));
      return next;
    });
    setErrors((current) => ({ ...current, [key]: "" }));
    setFormError("");
  }
  function choosePath(next: OnboardingPath) {
    setPath(next);
    setErrors({});
    if (next === "agency") setField("industryKey", "marketing_agencies");
    if (next === "join") {
      navigate("/app/invitations/accept");
      return;
    }
    setStep(1);
  }
  function nextStep() {
    setFormError("");
    if (step === 1) {
      const parsed = IndustryKeySchema.safeParse(form.industryKey);
      if (!parsed.success || (parsed.data === "other" && !form.industryCustomLabel.trim())) {
        setErrors({ industryKey: "Choose the closest industry, or describe your custom industry." });
        return;
      }
    }
    if (step === 2) {
      const parsed = WorkspaceBusinessInputSchema.safeParse(businessInput(form));
      if (!parsed.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] = issue.message;
        setErrors(nextErrors);
        return;
      }
    }
    setErrors({});
    setStep((current) => Math.min(4, current + 1));
  }
  function back() {
    setFormError("");
    setErrors({});
    setStep((current) => Math.max(0, current - 1));
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const parsed = WorkspaceBusinessInputSchema.safeParse(businessInput(form));
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] = issue.message;
      setErrors(nextErrors);
      setStep(nextErrors.industryKey ? 1 : 2);
      return;
    }
    setBusy(true); setFormError("");
    try {
      await saveUserOnboarding(token, { setupPath: path, draft: preferenceDraft });
      setCreateAttempted(true);
      const created = await createWorkspaceRequest({ ...parsed.data, requestId });
      setWorkspaceId(created.id);
      setAllowAnotherWorkspace(false);
      setStep(5);
      setBrand(defaultBrand(form));
      await saveUserOnboarding(token, { setupPath: path, draft: { ...preferenceDraft, createdWorkspaceId: created.id, currentStep: 5 } });
      await saveWorkspaceOnboarding(token, created.id, { setupData: setupData(form), currentStep: 5, lastCompletedStep: 4 });
      setDraftNotice("Workspace created and saved");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Workspace creation could not be confirmed. Retry safely.");
    } finally { setBusy(false); }
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId || !brand) return;
    setBusy(true); setFormError("");
    try {
      let nextBrand = brand;
      if (logoFile) {
        const asset = await uploadCreativeAsset(token, workspaceId, logoFile, "logo");
        nextBrand = { ...brand, logoAssetId: asset.id };
      }
      const saved = await saveBrandKit(token, workspaceId, nextBrand);
      const { workspaceId: _id, revision: _revision, updatedAt: _updatedAt, ...savedInput } = saved;
      setBrand(savedInput);
      setBrandSaved(true);
      await saveWorkspaceOnboarding(token, workspaceId, { setupData: setupData(form), currentStep: 6, lastCompletedStep: 5 });
      setStep(6);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Brand Kit could not be saved.");
    } finally { setBusy(false); }
  }

  async function skipBrand() {
    if (!token || !workspaceId) return;
    setBusy(true); setFormError("");
    try {
      await saveWorkspaceOnboarding(token, workspaceId, { setupData: setupData(form), currentStep: 6, lastCompletedStep: 5 });
      setStep(6);
    } catch (error) { setFormError(error instanceof Error ? error.message : "Setup progress could not be saved."); }
    finally { setBusy(false); }
  }

  async function finishSetup() {
    if (!token || !workspaceId) return;
    setBusy(true); setFormError("");
    try {
      await recordActivationEvent(token, workspaceId, "demo_mode_reviewed");
      await saveWorkspaceOnboarding(token, workspaceId, { setupData: setupData(form), currentStep: 6, lastCompletedStep: 6 });
      await saveUserOnboarding(token, { setupPath: path, draft: { ...preferenceDraft, createdWorkspaceId: workspaceId, currentStep: 6 } });
      navigate("/app/getting-started", { replace: true });
    } catch (error) { setFormError(error instanceof Error ? error.message : "Setup could not be completed. Try again."); }
    finally { setBusy(false); }
  }

  if (workspaceStatus === "loading" || !preferencesLoaded) {
    return <main className="grid min-h-screen place-items-center bg-midnight text-foreground"><p role="status">Restoring your saved setup…</p></main>;
  }
  if (workspaceStatus === "error") {
    return <main className="grid min-h-screen place-items-center bg-midnight px-5 text-foreground"><section className="max-w-lg rounded-2xl border border-stroke bg-panel p-6"><h1 className="font-display text-2xl font-semibold">Workspace access could not be checked</h1><p className="mt-3 text-sm text-slate-500">Sign in again or retry from your account before creating a workspace.</p><Link className={buttonPrimary + " mt-5"} to="/app/profile">Open profile</Link></section></main>;
  }
  if (existingWorkspace && !allowAnotherWorkspace && !workspaceId) {
    return <main className="min-h-screen bg-midnight text-foreground">
      <header className="flex min-h-[72px] items-center justify-between border-b border-stroke px-4 sm:px-8"><Link aria-label="Tandem Ads home" className="flex items-center gap-3" to="/app"><BrandMark /><span className="font-display text-sm font-semibold">Tandem Ads</span></Link><div className="flex items-center gap-3"><ThemeSwitcher /><AccountActions /></div></header>
      <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24"><p className="text-[10px] font-semibold tracking-[.2em] text-electric-bright">YOUR WORKSPACES</p><h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back to Tandem Ads.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">Your account already has workspace access. Continue there, accept an invitation, or set up a separate business workspace.</p><div className="mt-8 grid gap-3 sm:grid-cols-3"><Link className={buttonPrimary} to="/app">Open {existingWorkspace.name}</Link><Link className={buttonSecondary} to="/app/invitations/accept">Accept invitation</Link><button className={buttonSecondary} onClick={() => { setRequestId(newRequestId()); setCreateAttempted(false); setWorkspaceId(null); setStep(0); setAllowAnotherWorkspace(true); }} type="button">Set up another business</button></div></section>
    </main>;
  }

  const stepTitle = ["Choose a workspace path", "Choose your industry", "Tell us about your business", "Plan your first campaign", "Review your workspace", "Configure Brand Kit", "Demo mode and next steps"][step] ?? "Business setup";
  const percent = Math.round(((step + 1) / stages.length) * 100);
  const industryName = form.industryKey ? getIndustryName(form.industryKey, form.industryCustomLabel || null) : "Choose an industry";

  return <main className="min-h-screen bg-midnight text-foreground">
    <header className="flex min-h-[72px] items-center justify-between border-b border-stroke px-4 sm:px-8">
      <Link aria-label="Tandem Ads home" className="flex items-center gap-3" to="/app"><BrandMark /><span className="font-display text-sm font-semibold">Tandem Ads</span></Link>
      <div className="flex items-center gap-3"><ThemeSwitcher /><span className="hidden text-[10px] tracking-[.15em] text-slate-500 sm:inline">{draftNotice}</span><AccountActions /></div>
    </header>
    <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-7 sm:px-7 sm:py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
      <aside className="lg:sticky lg:top-8 lg:h-fit">
        <p className="text-[10px] font-semibold tracking-[.2em] text-electric-bright">TANDEM ADS ACTIVATION</p>
        <h1 className="mt-3 font-display text-2xl font-semibold leading-tight">A guided start for your business.</h1>
        <p className="mt-3 text-xs leading-6 text-slate-500">A few short steps save your workspace context before you enter the campaign tools.</p>
        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-gradient-to-r from-electric to-indigo-400 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: percent + "%" }} /></div>
        <ol aria-label="Business setup progress" className="mt-5 space-y-1">
          {stages.map((label, index) => <li aria-current={index === step ? "step" : undefined} className={"flex items-center gap-3 rounded-lg px-2 py-2 text-xs " + (index === step ? "text-foreground" : index < step ? "text-electric-bright" : "text-slate-500")} key={label}>
            <span className={"grid size-6 shrink-0 place-items-center rounded-full border text-[9px] " + (index <= step ? "border-electric/50 bg-electric/10" : "border-stroke")}>{index < step ? "✓" : String(index + 1).padStart(2, "0")}</span><span>{label}</span>
          </li>)}
        </ol>
        <div className="mt-7 rounded-xl border border-stroke bg-surface-muted p-4"><p className="text-[10px] font-semibold tracking-[.15em] text-slate-500">PRIVATE BY DESIGN</p><p className="mt-2 text-xs leading-5 text-slate-500">Creating a workspace assigns you owner access. No one else is invited and no advertising account is connected.</p></div>
      </aside>

      <section className="min-w-0 rounded-2xl border border-stroke bg-panel p-5 shadow-card sm:p-8 lg:p-10" aria-labelledby="onboarding-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke pb-5">
          <div><p className="text-[10px] font-semibold tracking-[.2em] text-electric-bright">STEP {step + 1} OF {stages.length}</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight" id="onboarding-title">{stepTitle}</h2></div>
          <span className="rounded-full border border-stroke bg-surface-muted px-3 py-1.5 text-[10px] text-slate-500">{draftNotice || "Your progress saves as you go"}</span>
        </div>
        {formError && <p className="mt-5 rounded-xl border border-danger/30 bg-danger-surface px-4 py-3 text-sm text-danger" role="alert">{formError}</p>}

        {step === 0 && <div className="py-7">
          <p className="max-w-2xl text-sm leading-7 text-slate-500">Start with the workspace you need. Invited team members and clients should use their existing invitation link; they do not need to create another business.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {([
              ["business", "Independent business", "Set up a workspace for your company."],
              ["agency", "Marketing agency", "Create an agency workspace and open the collaboration center."],
              ["join", "Join a workspace", "Accept the secure invitation you received."],
            ] as const).map(([value, title, description]) => <button aria-pressed={path === value} className={"rounded-2xl border p-5 text-left transition " + (path === value ? "border-electric/55 bg-electric/[.07]" : "border-stroke bg-surface-muted hover:border-slate-500")} key={value} onClick={() => choosePath(value)} type="button"><span className="grid size-10 place-items-center rounded-xl border border-electric/30 bg-electric/10 text-electric-bright" aria-hidden="true">{value === "business" ? "◇" : value === "agency" ? "▧" : "↗"}</span><span className="mt-4 block text-sm font-semibold">{title}</span><span className="mt-2 block text-xs leading-5 text-slate-500">{description}</span></button>)}
          </div>
          <Link className="mt-5 inline-flex text-xs font-medium text-electric-bright hover:text-foreground" to="/app/invitations/accept">I have an invitation link →</Link>
        </div>}

        {step === 1 && <div className="py-6">
          <p className="text-sm leading-6 text-slate-500">Choose the closest fit. This is the existing Tandem Ads industry catalogue and helps tailor examples and prompts.</p>
          <input className={inputClass + " mt-5"} aria-label="Search industries" onChange={(event) => setIndustrySearch(event.currentTarget.value)} placeholder="Search industries" value={industrySearch} />
          {errors.industryKey && <p className="mt-3 text-xs text-danger" role="alert">{errors.industryKey}</p>}
          <div aria-label="Select an industry" className="mt-4 grid gap-3 sm:grid-cols-2" role="group">
            {filteredIndustries.map((industry) => <button aria-pressed={form.industryKey === industry.key} className={"rounded-xl border p-4 text-left transition " + (form.industryKey === industry.key ? "border-electric/55 bg-electric/[.07]" : "border-stroke bg-surface-muted hover:border-slate-500")} key={industry.key} onClick={() => setField("industryKey", industry.key)} type="button">
              <span className="grid size-9 place-items-center rounded-xl border border-stroke bg-surface text-electric-bright"><IndustryIcon type={industry.icon} /></span><span className="mt-3 block text-sm font-medium">{industry.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{industry.description}</span>
            </button>)}
          </div>
          {form.industryKey === "other" && <div className="mt-4 max-w-lg"><Label htmlFor="industry-custom" required>Describe your industry</Label><input className={inputClass} id="industry-custom" maxLength={100} onChange={(event) => setField("industryCustomLabel", event.currentTarget.value)} value={form.industryCustomLabel} /></div>}
          {guidance && <aside className="mt-5 rounded-xl border border-electric/20 bg-electric/[.04] p-4"><p className="text-xs font-semibold text-electric-bright">A useful first goal</p><p className="mt-2 text-sm text-foreground">{guidance.goal}</p><p className="mt-1 text-xs text-slate-500">Example: {guidance.example}</p>{guidance.care && <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-200">{guidance.care}</p>}</aside>}
        </div>}

        {step === 2 && <div className="grid gap-5 py-6 sm:grid-cols-2">
          <div><Label htmlFor="business-name" required>Business name</Label><input aria-invalid={Boolean(errors.name)} className={inputClass} id="business-name" maxLength={120} onChange={(event) => setField("name", event.currentTarget.value)} placeholder="The name customers know" value={form.name} />{errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}</div>
          <div><Label htmlFor="workspace-url" required>Workspace URL</Label><input aria-invalid={Boolean(errors.slug)} className={inputClass} id="workspace-url" maxLength={48} onChange={(event) => { setSlugTouched(true); setField("slug", slugFromName(event.currentTarget.value)); }} placeholder="your-business" value={form.slug} />{errors.slug && <p className="mt-1 text-xs text-danger">{errors.slug}</p>}</div>
          <div className="sm:col-span-2"><Label htmlFor="website">Website (optional)</Label><input className={inputClass} id="website" onChange={(event) => setField("websiteUrl", event.currentTarget.value)} placeholder="https://example.com" type="url" value={form.websiteUrl} /></div>
          <div><Label htmlFor="region">Primary location or target region</Label><input className={inputClass} id="region" maxLength={200} onChange={(event) => setField("primaryRegion", event.currentTarget.value)} placeholder="City, region or market" value={form.primaryRegion} /></div>
          <div><Label htmlFor="country">Country code (optional)</Label><input className={inputClass} id="country" maxLength={2} onChange={(event) => setField("countryCode", event.currentTarget.value.toUpperCase())} placeholder="IN" value={form.countryCode} /></div>
          <div className="sm:col-span-2"><Label htmlFor="business-description">Business description</Label><textarea className={inputClass + " min-h-24 py-3"} id="business-description" maxLength={2000} onChange={(event) => setField("businessDescription", event.currentTarget.value)} placeholder="What should someone understand about this business?" value={form.businessDescription} /></div>
          <div><Label htmlFor="offering">Main product or service</Label><input className={inputClass} id="offering" maxLength={240} onChange={(event) => setField("mainOffering", event.currentTarget.value)} placeholder="A service, course or product range" value={form.mainOffering} /></div>
          <div><Label htmlFor="objective">Marketing objective</Label><input className={inputClass} id="objective" maxLength={240} onChange={(event) => setField("marketingObjective", event.currentTarget.value)} placeholder={guidance?.goal ?? "What are you working toward?"} value={form.marketingObjective} /></div>
          <div><Label htmlFor="timezone" required>Business time zone</Label><input className={inputClass} id="timezone" maxLength={100} onChange={(event) => setField("timezone", event.currentTarget.value)} value={form.timezone} /></div>
          <div><Label htmlFor="selected-industry">Selected industry</Label><input className={inputClass} id="selected-industry" readOnly value={industryName} /></div>
        </div>}

        {step === 3 && <div className="grid gap-5 py-6 sm:grid-cols-2">
          <p className="text-sm leading-6 text-slate-500 sm:col-span-2">Planning preferences only. They prefill campaign drafts and never change a live advertising account or spend.</p>
          <div><Label htmlFor="campaign-goal">Primary campaign goal</Label><select className={inputClass} id="campaign-goal" onChange={(event) => setField("campaignGoal", event.currentTarget.value as FormValues["campaignGoal"])} value={form.campaignGoal}><option value="lead_generation">Lead generation</option><option value="website_traffic">Website traffic</option><option value="sales">Sales</option><option value="awareness">Awareness</option><option value="engagement">Engagement</option><option value="app_promotion">App promotion</option></select><p className="mt-2 text-xs text-slate-500">Example: {guidance?.goal ?? "Choose a simple first outcome."}</p></div>
          <div><Label htmlFor="platform">Preferred draft format</Label><select className={inputClass} id="platform" onChange={(event) => setField("platformFormat", event.currentTarget.value as FormValues["platformFormat"])} value={form.platformFormat}><option value="google_ads">Google Ads draft format</option><option value="meta_ads">Meta Ads draft format</option></select></div>
          <div><Label htmlFor="budget-range">Typical budget range</Label><select className={inputClass} id="budget-range" onChange={(event) => setField("budgetRange", event.currentTarget.value as FormValues["budgetRange"])} value={form.budgetRange}><option value="not_sure">Not sure yet</option><option value="under_500">Under 500</option><option value="500_2000">500–2,000</option><option value="2000_5000">2,000–5,000</option><option value="5000_plus">5,000+</option></select><p className="mt-2 text-xs text-slate-500">Planning context only; no budget is sent or applied.</p></div>
          <div><Label htmlFor="brand-tone">Brand voice</Label><select className={inputClass} id="brand-tone" onChange={(event) => setField("brandTone", event.currentTarget.value as FormValues["brandTone"])} value={form.brandTone}>{["clear","warm","confident","playful","premium","expert"].map((item) => <option key={item} value={item}>{item[0]?.toUpperCase() + item.slice(1)}</option>)}</select></div>
          <div className="sm:col-span-2"><Label htmlFor="audience">Intended audience</Label><textarea className={inputClass + " min-h-20 py-3"} id="audience" maxLength={500} onChange={(event) => setField("audience", event.currentTarget.value)} placeholder="A broad audience description, without personal or sensitive data" value={form.audience} /></div>
          <div><Label htmlFor="cta">CTA preference</Label><select className={inputClass} id="cta" onChange={(event) => setField("ctaPreference", event.currentTarget.value as FormValues["ctaPreference"])} value={form.ctaPreference}>{["direct","warm","minimal","confident","custom"].map((item) => <option key={item} value={item}>{item[0]?.toUpperCase() + item.slice(1)}</option>)}</select></div>
        </div>}

        {step === 4 && <form className="py-6" onSubmit={(event) => void createWorkspace(event)}>
          <p className="text-sm leading-6 text-slate-500">Review your setup. Saving creates this workspace and your owner membership in one transaction. It does not add users or connect an ad account.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Business", value: form.name || "Not provided" }, { label: "Industry", value: industryName }, { label: "Website", value: form.websiteUrl || "Not provided" },
              { label: "Region", value: form.primaryRegion || "Not provided" }, { label: "Product or service", value: form.mainOffering || "Not provided" },
              { label: "Primary goal", value: form.campaignGoal.replaceAll("_", " ") }, { label: "Draft format", value: form.platformFormat === "google_ads" ? "Google Ads" : "Meta Ads" },
              { label: "Budget preference", value: form.budgetRange.replaceAll("_", " ") },
            ].map(({ label, value }) => <div className="rounded-xl border border-stroke bg-surface-muted p-4" key={label}><p className="text-[10px] font-semibold tracking-wider text-slate-500">{label.toUpperCase()}</p><p className="mt-2 break-words text-sm">{value}</p></div>)}
          </div>
          <div className="mt-5 rounded-xl border border-electric/20 bg-electric/[.04] p-4"><p className="text-xs font-semibold text-electric-bright">Tandem Ads demo mode</p><p className="mt-2 text-xs leading-5 text-slate-500">Campaign generation is offline rule-based simulation. Campaign drafts, reviews, simulated publishing and demo analytics stay in Tandem Ads; no real Google or Meta advertising activity occurs.</p></div>
          <div className="mt-6 flex flex-wrap justify-between gap-3"><button className={buttonSecondary} disabled={busy} onClick={back} type="button">Back to edit</button><button aria-busy={busy} className={buttonPrimary} disabled={busy} type="submit">{busy ? "Creating workspace…" : "Create workspace"}</button></div>
        </form>}

        {step === 5 && brand && <form className="grid gap-5 py-6 sm:grid-cols-2" onSubmit={(event) => void saveBrand(event)}>
          <p className="text-sm leading-6 text-slate-500 sm:col-span-2">Build a lightweight Brand Kit now or skip it and return later. Logos are stored as private workspace assets.</p>
          <div><Label htmlFor="brand-name" required>Brand display name</Label><input className={inputClass} id="brand-name" maxLength={120} onChange={(event) => setBrand({ ...brand, displayName: event.currentTarget.value })} value={brand.displayName} /></div>
          <div><Label htmlFor="brand-tagline">Tagline (optional)</Label><input className={inputClass} id="brand-tagline" maxLength={180} onChange={(event) => setBrand({ ...brand, tagline: event.currentTarget.value })} placeholder="A short brand line" value={brand.tagline} /></div>
          <div><Label htmlFor="primary-color">Primary color</Label><input className={inputClass + " p-1.5"} id="primary-color" onChange={(event) => setBrand({ ...brand, primaryColor: event.currentTarget.value })} type="color" value={brand.primaryColor} /></div>
          <div><Label htmlFor="secondary-color">Secondary color</Label><input className={inputClass + " p-1.5"} id="secondary-color" onChange={(event) => setBrand({ ...brand, secondaryColor: event.currentTarget.value })} type="color" value={brand.secondaryColor} /></div>
          <div><Label htmlFor="brand-voice">Brand voice</Label><select className={inputClass} id="brand-voice" onChange={(event) => setBrand({ ...brand, tone: event.currentTarget.value as BrandKitInput["tone"] })} value={brand.tone}>{["clear","warm","confident","playful","premium","expert"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div><Label htmlFor="brand-cta">CTA preference</Label><select className={inputClass} id="brand-cta" onChange={(event) => setBrand({ ...brand, ctaStyle: event.currentTarget.value as BrandKitInput["ctaStyle"] })} value={brand.ctaStyle}>{["direct","warm","minimal","confident","custom"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="sm:col-span-2"><Label htmlFor="brand-logo">Logo upload (optional)</Label><input accept="image/png,image/jpeg,image/webp" className={inputClass + " py-2.5"} id="brand-logo" onChange={(event) => setLogoFile(event.currentTarget.files?.[0] ?? null)} type="file" /><p className="mt-2 text-xs text-slate-500">Private Storage enforces image type, file size and workspace ownership.</p></div>
          {brandSaved && <p className="text-xs text-emerald-700 dark:text-emerald-300 sm:col-span-2" role="status">Brand Kit saved to this workspace.</p>}
          <div className="flex flex-wrap justify-between gap-3 border-t border-stroke pt-5 sm:col-span-2"><button className={buttonSecondary} disabled={busy} onClick={() => void skipBrand()} type="button">Skip for now</button><button aria-busy={busy} className={buttonPrimary} disabled={busy} type="submit">{busy ? "Saving Brand Kit…" : "Save and continue"}</button></div>
        </form>}

        {step === 6 && <div className="py-7">
          <p className="text-sm leading-7 text-slate-500">This campaign workspace is a preparation and review environment. Generated content is deterministic, demo publishing records an internal state only, and analytics are labeled simulated.</p>
          <div className="mt-5 rounded-2xl border border-stroke bg-surface-muted p-5" id="demo-mode"><p className="text-[10px] font-semibold tracking-[.17em] text-electric-bright">NO EXTERNAL AD ACTIVITY</p><p className="mt-3 text-sm font-semibold">This campaign exists in Tandem Ads demo mode. It has not been published to Google or Meta.</p><p className="mt-2 text-xs leading-6 text-slate-500">No advertising account, budget or spend is changed. Approval and role checks continue to apply to demo publishing.</p></div>
          <div className="mt-6 flex flex-wrap justify-between gap-3"><button className={buttonSecondary} disabled={busy} onClick={() => setStep(5)} type="button">Back to Brand Kit</button><button aria-busy={busy} className={buttonPrimary} disabled={busy} onClick={() => void finishSetup()} type="button">{busy ? "Saving setup…" : "Finish setup and open Getting Started"}</button></div>
        </div>}

        {step > 0 && step < 4 && <div className="flex flex-col-reverse justify-between gap-3 border-t border-stroke pt-5 sm:flex-row sm:items-center"><button className={buttonSecondary} onClick={back} type="button">Back</button><div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center px-3 text-xs text-slate-500 hover:text-foreground" to="/app/profile">Save and leave</Link>{step === 3 && <button className={buttonSecondary} onClick={() => setStep(4)} type="button">Skip optional preferences</button>}<button className={buttonPrimary} onClick={nextStep} type="button">{step === 3 ? "Continue to review" : "Continue"}</button></div></div>}
        {step === 0 && <div className="border-t border-stroke pt-5"><p className="text-xs text-slate-500">Choosing a path continues immediately; joining always uses the existing invitation flow.</p></div>}
      </section>
    </div>
  </main>;
}
