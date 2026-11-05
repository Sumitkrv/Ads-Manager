import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ForgotPasswordInputSchema, LoginInputSchema } from "@ai-ads/shared";
import { useAuth } from "../auth/AuthProvider";
import { supabaseConfiguration } from "../auth/supabase";
import { authErrorCode, authErrorStatus, authErrorText, errorsByField } from "../auth/formErrors";
import { AuthFormField, AuthLayout, SubmitButton } from "../components/AuthLayout";
import { safeAppDestination } from "../auth/RouteGuards";

export function LoginPage() {
  const { recoverableError, resendSignupConfirmation, retrySessionRestore, sessionExpired, signIn, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeNotice = (location.state as { notice?: unknown } | null)?.notice;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice] = useState(typeof routeNotice === "string" ? routeNotice : "");
  const [busy, setBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  async function resendConfirmation() {
    setResendMessage("");
    setResendError("");
    const result = ForgotPasswordInputSchema.safeParse({ email });
    if (!result.success) {
      setResendError("Enter a valid email address first.");
      return;
    }
    setResendBusy(true);
    try {
      await resendSignupConfirmation(result.data.email);
      setResendMessage(supabaseConfiguration.isLocal
        ? "If this account needs confirmation, open Mailpit at 127.0.0.1:54324 to find the local email."
        : "If this account needs confirmation, a new email is on the way. Check your inbox and spam folder.");
    } catch (error) {
      const code = authErrorCode(error);
      if (authErrorStatus(error) === 429 || code === "over_email_send_rate_limit") {
        setResendError("Supabase has reached its email limit. Wait before trying again.");
      } else if (code === "email_address_not_authorized" || authErrorText(error).includes("email address not authorized")) {
        setResendError("Supabase is not allowed to email this address with its default sender. Configure custom SMTP for the project, then resend.");
      } else {
        setResendError("The confirmation email could not be sent. Check the Supabase email settings and try again.");
      }
    } finally {
      setResendBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const result = LoginInputSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(errorsByField(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(result.data.email, result.data.password);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(safeAppDestination(from), { replace: true });
    } catch (error) {
      const code = authErrorCode(error);
      const message = authErrorText(error);
      if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
        setFormError("Confirm your email before signing in. Use the resend option below if the message did not arrive.");
      } else if (authErrorStatus(error) === 429) {
        setFormError("Too many sign-in attempts. Wait a bit before trying again.");
      } else {
        setFormError("We couldn’t verify those details. Check your email and password, then try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryRestore() {
    setRestoreBusy(true);
    try {
      await retrySessionRestore();
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Sign in to Tandem Ads"
      description="Use your email to continue to your business workspaces."
      footer={
        <p>
          New to Tandem Ads?{" "}
          <Link className="font-medium text-electric-bright hover:text-foreground" to="/signup">Create an account</Link>
        </p>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        {(sessionExpired || notice) && <p className="auth-message auth-message-error" role="status">Your session expired. Sign in again to continue.</p>}
        {status === "recoverable_error" && !sessionExpired && (
          <div className="auth-message auth-message-info" role="status">
            <p>{recoverableError ?? "Authentication could not be checked right now."}</p>
            <button className="mt-2 text-sm font-medium text-electric-bright hover:text-foreground disabled:opacity-60" disabled={restoreBusy} onClick={() => void retryRestore()} type="button">
              {restoreBusy ? "Checking…" : "Try again"}
            </button>
          </div>
        )}
        {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}
        <AuthFormField
          autoComplete="email"
          error={errors.email}
          label="Work email"
          name="email"
          onChange={(value) => {
            setEmail(value);
            setResendError("");
            setResendMessage("");
          }}
          type="email"
          value={email}
        />
        <div>
          <AuthFormField
            autoComplete="current-password"
            error={errors.password}
            label="Password"
            name="password"
            onChange={setPassword}
            type="password"
            value={password}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Link className="text-xs text-electric-bright hover:text-foreground" to="/forgot-password">Forgot password?</Link>
            <button className="text-xs text-electric-bright hover:text-foreground disabled:cursor-wait disabled:opacity-60" disabled={resendBusy} onClick={() => void resendConfirmation()} type="button">
              {resendBusy ? "Sending…" : "Resend confirmation"}
            </button>
          </div>
        </div>
        {resendError && <p className="auth-message auth-message-error" role="alert">{resendError}</p>}
        {resendMessage && <p className="auth-message auth-message-info" role="status">{resendMessage}</p>}
        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>
    </AuthLayout>
  );
}
