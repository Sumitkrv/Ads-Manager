import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { SignupInputSchema } from "@ai-ads/shared";
import { useAuth } from "../auth/AuthProvider";
import { supabaseConfiguration } from "../auth/supabase";
import { errorsByField } from "../auth/formErrors";
import { AuthFormField, AuthLayout, SubmitButton } from "../components/AuthLayout";

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", termsAccepted: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function setField(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");
    const result = SignupInputSchema.safeParse(form);
    if (!result.success) {
      setErrors(errorsByField(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const session = await signUp(
        result.data.fullName,
        result.data.email,
        result.data.password,
        window.location.origin + "/login",
      );
      if (session) {
        navigate("/app", { replace: true });
      } else {
        setNotice("Your account request is ready. Check your email and follow Supabase’s confirmation instructions before signing in.");
      }
    } catch {
      setFormError("We couldn’t create the account. Review your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="CREATE YOUR ACCOUNT"
      title="Start with a secure account"
      description="Create secure personal access, then set up an independent workspace for your business."
      footer={
        <p>
          Already have an account?{" "}
          <Link className="font-medium text-electric-bright hover:text-foreground" to="/login">Sign in</Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}
        {notice && (
          <p className="auth-message auth-message-info" role="status">
            {supabaseConfiguration.isLocal ? (
              <>Local account ready. Open <a className="font-medium underline" href="http://127.0.0.1:54324">Mailpit</a> to confirm the email, then sign in. Hosted accounts are separate from local development.</>
            ) : notice}
          </p>
        )}
        <AuthFormField
          autoComplete="name"
          error={errors.fullName}
          label="Full name"
          name="fullName"
          onChange={(value) => setField("fullName", value)}
          value={form.fullName}
        />
        <AuthFormField
          autoComplete="email"
          error={errors.email}
          label="Work email"
          name="email"
          onChange={(value) => setField("email", value)}
          type="email"
          value={form.email}
        />
        <AuthFormField
          autoComplete="new-password"
          error={errors.password}
          label="Password"
          name="password"
          onChange={(value) => setField("password", value)}
          type="password"
          value={form.password}
        />
        <AuthFormField
          autoComplete="new-password"
          error={errors.confirmPassword}
          label="Confirm password"
          name="confirmPassword"
          onChange={(value) => setField("confirmPassword", value)}
          type="password"
          value={form.confirmPassword}
        />
        <div className="space-y-2 pt-1">
          <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-400" htmlFor="termsAccepted">
            <input
              checked={form.termsAccepted}
              className="mt-1 size-4 accent-electric-bright"
              id="termsAccepted"
              onChange={(event) => setField("termsAccepted", event.currentTarget.checked)}
              type="checkbox"
            />
            <span>I accept the Terms of Service and acknowledge the Privacy Notice.</span>
          </label>
          {errors.termsAccepted && <p className="pl-7 text-xs text-rose-300" role="alert">{errors.termsAccepted}</p>}
        </div>
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
    </AuthLayout>
  );
}
