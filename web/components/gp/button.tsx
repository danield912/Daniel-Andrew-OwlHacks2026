"use client";
import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline-danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex shrink-0 select-none items-center whitespace-nowrap justify-center gap-2 overflow-hidden rounded-2xl font-semibold " +
  "transition-[background,box-shadow,color,border-color] duration-200 " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mint-300/40 " +
  "disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-mint-300 via-mint-400 to-glow-cyan text-night-950 shadow-glow-sm hover:shadow-glow " +
    "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent " +
    "hover:before:translate-x-full before:transition-transform before:duration-700",
  secondary: "gp-glass text-white hover:border-white/20 hover:bg-white/[0.08]",
  ghost: "text-slate-300 hover:bg-white/[0.07] hover:text-white",
  danger: "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.7)]",
  "outline-danger": "border border-rose-400/40 text-rose-200 hover:bg-rose-500/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

const press = { whileHover: { y: -2, scale: 1.02 }, whileTap: { y: 0, scale: 0.97 } };

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; iconRight?: ReactNode };

export type ButtonProps = Common & Omit<HTMLMotionProps<"button">, "children"> & {
  loading?: boolean;
  loadingText?: string;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconRight, loading, loadingText, className, children, disabled, type = "button", ...props },
  ref,
) {
  const isDisabled = disabled || loading;
  return <motion.button
    ref={ref}
    type={type}
    disabled={isDisabled}
    aria-busy={loading || undefined}
    {...(isDisabled ? {} : press)}
    transition={{ type: "spring", stiffness: 500, damping: 26 }}
    className={cn(base, variants[variant], sizes[size], loading && "cursor-wait", className)}
    {...props}
  >
    {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : icon}
    <span className="relative">{loading && loadingText ? loadingText : children}</span>
    {!loading && iconRight}
  </motion.button>;
});

// Links get the same lift-and-press feel through CSS transitions.
export function ButtonLink({ variant = "primary", size = "md", icon, iconRight, className, children, ...props }:
  Common & ComponentProps<typeof Link> & { children?: ReactNode }) {
  return <Link
    className={cn(base, variants[variant], sizes[size], "transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.97]", className)}
    {...props}
  >
    {icon}
    <span className="relative">{children}</span>
    {iconRight}
  </Link>;
}

export function IconButton({ label, className, children, ...props }: HTMLMotionProps<"button"> & { label: string; children: ReactNode }) {
  return <motion.button
    type="button"
    aria-label={label}
    title={label}
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.92 }}
    className={cn("grid h-10 w-10 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white", className)}
    {...props}
  >{children}</motion.button>;
}
