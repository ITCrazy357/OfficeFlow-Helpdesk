import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldShellProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

function FieldShell({ label, error, children }: FieldShellProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-800">
      <span className="text-sm font-semibold text-zinc-800">{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-red-600">{error}</span>
      ) : null}
    </label>
  );
}

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function InputField({ label, error, className = "", ...props }: InputFieldProps) {
  return (
    <FieldShell label={label} error={error}>
      <input
        className={`min-h-11 rounded-[10px] border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-inner shadow-zinc-950/[0.02] outline-none transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:bg-zinc-100 disabled:text-zinc-500 ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function TextareaField({
  label,
  error,
  className = "",
  ...props
}: TextareaFieldProps) {
  return (
    <FieldShell label={label} error={error}>
      <textarea
        className={`min-h-36 resize-y rounded-[10px] border border-zinc-300 bg-white px-3.5 py-3 text-sm leading-6 text-zinc-950 shadow-inner shadow-zinc-950/[0.02] outline-none transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:bg-zinc-100 disabled:text-zinc-500 ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  error,
  children,
  className = "",
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error}>
      <select
        className={`min-h-11 rounded-[10px] border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-inner shadow-zinc-950/[0.02] outline-none transition hover:border-zinc-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:bg-zinc-100 disabled:text-zinc-500 ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
