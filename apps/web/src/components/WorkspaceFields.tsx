export function Field({
  id, label, value, onChange, error, type = "text", placeholder, required = false, maxLength, disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-300" htmlFor={id}>{label}{required && <span className="text-electric-bright"> *</span>}</label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="off"
        className={`auth-input w-full rounded-xl border bg-input px-3.5 py-3 text-sm text-foreground placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-rose-400/60" : "border-stroke hover:border-slate-600"}`}
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      {error && <p className="text-xs text-rose-300" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
