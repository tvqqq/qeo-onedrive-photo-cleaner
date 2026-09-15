import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-sky-300 text-slate-950 hover:bg-sky-200",
  secondary: "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
  danger: "bg-red-500 text-white hover:bg-red-400",
  ghost: "text-zinc-300 hover:bg-zinc-900",
};

export function buttonClass(variant: ButtonVariant = "secondary", className = "") {
  return `inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`;
}

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
