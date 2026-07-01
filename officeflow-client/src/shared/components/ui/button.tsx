import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-teal-700 bg-teal-700 text-white shadow-[0_10px_24px_rgba(15,118,110,0.18)] hover:border-teal-800 hover:bg-teal-800 disabled:border-teal-700/40 disabled:bg-teal-700/50",
  secondary:
    "border-zinc-300 bg-white text-zinc-900 shadow-sm shadow-zinc-950/5 hover:border-zinc-400 hover:bg-zinc-50 disabled:text-zinc-400",
  danger:
    "border-red-600 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.14)] hover:border-red-700 hover:bg-red-700 disabled:border-red-600/40 disabled:bg-red-600/50",
  ghost:
    "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 disabled:text-zinc-400",
};

export function Button({
  children,
  className = "",
  icon,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 py-2 text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:ring-offset-2 focus:ring-offset-white disabled:translate-y-0 disabled:opacity-70 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:-translate-y-0.5 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
