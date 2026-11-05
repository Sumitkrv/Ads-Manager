import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ResetPasswordInputSchema } from "@ai-ads/shared";
import { errorsByField } from "../auth/formErrors";
import { useAuth } from "../auth/AuthProvider";
import { SessionLoading } from "../auth/RouteGuards";
import { AuthFormField, AuthLayout, SubmitButton } from "../components/AuthLayout";

export function ResetPasswordPage() {
  const { loading, passwordRecovery, session, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function setField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const result = ResetPasswordInputSchema.safeParse(form);
    if (!result.success) {
      setErrors(errorsByField(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await updatePassword(result.data.password);
      navigate("/app", { replace: true });
    } catch {
      setFormError("The password could not be updated. The reset link may have expired; request a new one.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SessionLoading />;

  if (!session || !passwordRecovery) {
    return (
      <AuthLayout
        eyebrow="RESET LINK REQUIRED"
        title="Open your reset email"
        description="For your security, a valid Supabase password recovery session is required before choosing a new password."
        footer={<Link className="font-medium text-electric-bright hover:text-foreground" to="/forgot-password">Request a new reset link</Link>}
      >
        <p className="auth-message auth-message-info">Reset links are single use and may expire. Return here from the link in your email.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="CHOOSE A NEW PASSWORD"
      title="Secure your account"
      description="Use at least 8 characters for your new password."
      footer={<Link className="font-medium text-electric-bright hover:text-foreground" to="/login">Back to sign in</Link>}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}
        <AuthFormField
          autoComplete="new-password"
          error={errors.password}
          label="New password"
          name="password"
          onChange={(value) => setField("password", value)}
          type="password"
          value={form.password}
        />
        <AuthFormField
          autoComplete="new-password"
          error={errors.confirmPassword}
          label="Confirm new password"
          name="confirmPassword"
          onChange={(value) => setField("confirmPassword", value)}
          type="password"
          value={form.confirmPassword}
        />
        <SubmitButton busy={busy}>Update password</SubmitButton>
      </form>
    </AuthLayout>
  );
}
