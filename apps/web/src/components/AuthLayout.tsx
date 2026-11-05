import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";

export function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 place-items-center rounded-xl border border-electric/40 bg-electric/10"
    >
      <span className="font-display text-sm font-bold tracking-tight text-electric-bright">TA</span>
    </span>
  );
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="auth-shell min-h-screen bg-midnight text-slate-100">
      <section className="auth-visual relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-stroke px-10 py-9 lg:flex xl:px-16">
        <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-foreground">Tandem Ads</p>
            <p className="mt-0.5 text-[10px] tracking-[0.2em] text-slate-500">AI ADS MANAGER</p>
          </div>
          </div>
          <ThemeSwitcher />
        </div>

        <div className="relative z-10 max-w-xl pb-8">
          <div className="mb-7 flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-electric-bright">
            <span className="size-1.5 rounded-full bg-electric-bright" />
            BUILT FOR A MORE CONSIDERED WORKFLOW
          </div>
          <h1 className="max-w-lg font-display text-4xl font-medium leading-[1.12] tracking-[-0.04em] text-foreground xl:text-[54px]">
            A focused workspace for your next move.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-slate-400">
            Keep the work grounded in your business, your people, and the decisions that deserve a human review.
          </p>
          <div className="mt-12 flex items-center gap-3 border-t border-stroke pt-5 text-xs text-slate-500">
            <span className="grid size-8 place-items-center rounded-lg border border-stroke bg-surface-muted text-electric-bright">
              <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
                <path d="M3.5 9.25 10 3.75l6.5 5.5v6.5a.75.75 0 0 1-.75.75h-4.5v-4.75h-2.5v4.75h-4.5a.75.75 0 0 1-.75-.75v-6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Independent business workspaces</span>
          </div>
        </div>

        <svg className="auth-blueprint pointer-events-none absolute bottom-24 right-[-20px] w-[min(58vw,650px)] opacity-70" viewBox="0 0 640 500" fill="none" aria-hidden="true">
          <path d="M62 420 320 188l258 232" stroke="currentColor" strokeWidth="1" />
          <path d="M111 420V282l209-188 209 188v138" stroke="currentColor" strokeWidth="1" />
          <path d="M185 420V315h92v105m61 0V315h92v105" stroke="currentColor" strokeWidth="1" />
          <path d="M145 259h87v-69m263 69h-87v-69M320 94v-52m0 52 20-18m-20 18-20-18" stroke="currentColor" strokeWidth="1" />
          <path d="M62 444h516M90 465h460" stroke="currentColor" strokeWidth="1" />
          <circle cx="320" cy="188" r="162" stroke="currentColor" strokeWidth=".6" strokeDasharray="3 8" />
        </svg>
        <p className="relative z-10 text-[11px] tracking-wide text-slate-600">Tandem Ads · Account access</p>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark />
            <span className="font-display text-sm font-semibold text-foreground">Tandem Ads</span>
          </Link>
          <div className="flex items-center gap-3"><ThemeSwitcher /><span className="text-[10px] tracking-[0.15em] text-slate-500">SECURE ACCESS</span></div>
        </header>
        <div className="my-auto w-full py-10">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-8 hidden items-center gap-3 lg:flex">
              <BrandMark />
              <span className="font-display text-sm font-semibold text-foreground">Tandem Ads</span>
            </div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-electric-bright">{eyebrow}</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-[34px]">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-7 text-sm text-slate-400">{footer}</div>
          </div>
        </div>
        <footer className="mx-auto flex w-full max-w-[430px] items-center justify-between text-[10px] tracking-wide text-slate-600">
          <span>© {new Date().getFullYear()} Tandem Ads</span>
          <span>Protected account access</span>
        </footer>
      </section>
    </main>
  );
}

export function AuthFormField({
  name,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  autoComplete?: string | undefined;
  required?: boolean;
}) {
  const passwordField = type === "password";
  const [visible, setVisible] = useState(false);
  const inputType = passwordField && visible ? "text" : type;
  const errorId = name + "-error";

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-300" htmlFor={name}>{label}</label>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className={
            "auth-input w-full rounded-xl border bg-input px-3.5 py-3 text-sm text-foreground placeholder:text-slate-600 " +
            (passwordField ? "pr-[76px] " : "") +
            (error ? "border-rose-400/60 " : "border-stroke hover:border-slate-600 ")
          }
          id={name}
          name={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          type={inputType}
          value={value}
        />
        {passwordField && (
          <button
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-md px-2 text-[11px] font-medium text-slate-400 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setVisible((current) => !current)}
            type="button"
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <p className="text-xs leading-5 text-rose-300" id={errorId} role="alert">{error}</p>}
    </div>
  );
}

export function SubmitButton({ children, busy }: { children: ReactNode; busy: boolean }) {
  return (
    <button
      aria-busy={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-electric-bright px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
      disabled={busy}
      type="submit"
    >
      {busy && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />}
      {busy ? "Please wait…" : children}
    </button>
  );
}

