import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ForgotPasswordInputSchema } from "@ai-ads/shared";
import { useAuth } from "../auth/AuthProvider";
import { authErrorStatus, errorsByField } from "../auth/formErrors";
import { AuthFormField, AuthLayout, SubmitButton } from "../components/AuthLayout";

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");
    const result = ForgotPasswordInputSchema.safeParse({ email });
    if (!result.success) {
      setError(errorsByField(result.error).email ?? "Enter a valid email address.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await requestPasswordReset(result.data.email, window.location.origin + "/reset-password");
      setNotice("If an account exists for this address, password reset instructions will arrive by email.");
    } catch (caught) {
      setFormError(authErrorStatus(caught) === 429
        ? "Password reset is temporarily rate-limited. Use the latest reset email you received, or wait before requesting another."
        : "We couldn’t send the reset request. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password"
      description="Enter the email address associated with your account."
      footer={<Link className="font-medium text-electric-bright hover:text-foreground" to="/login">Return to sign in</Link>}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}
        {notice && <p className="auth-message auth-message-info" role="status">{notice}</p>}
        <AuthFormField
          autoComplete="email"
          error={error}
          label="Work email"
          name="email"
          onChange={setEmail}
          type="email"
          value={email}
        />
        <SubmitButton busy={busy}>Send reset instructions</SubmitButton>
      </form>
    </AuthLayout>
  );
}
