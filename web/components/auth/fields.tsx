"use client";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

export function Field({ id, label, icon, hint, action, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return <div>
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="gp-label">{label}</label>
      {action}
    </div>
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
      <input id={id} className={`gp-input ${icon ? "pl-11" : ""}`} {...props} />
    </div>
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>;
}

export function PasswordField({ id, label, icon, action, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon?: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return <div>
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="gp-label">{label}</label>
      {action}
    </div>
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
      <input id={id} type={visible ? "text" : "password"} className={`gp-input pr-12 ${icon ? "pl-11" : ""}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible(value => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >{visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
    </div>
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>;
}

// Only same-site paths are allowed, so a link can't redirect people elsewhere.
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
