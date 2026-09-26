import Link from "next/link";
import { Ticket } from "lucide-react";
import type { ReactNode } from "react";

export const actionClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300";
export const panelClass = "rounded-3xl border border-white/10 bg-[#10232a] p-6 sm:p-8";

export function PlansShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#09171b] text-slate-100">
    <header className="border-b border-white/10 bg-[#0d2026]">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="flex items-center gap-2 font-bold"><Ticket aria-hidden="true" className="text-teal-300" />Philly GamePlan</Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/plans" className="rounded-xl bg-teal-300/10 px-4 py-2 text-teal-200">My Plans</Link>
          <Link href="/auth/login" className="rounded-xl border border-white/20 px-4 py-2">Account</Link>
        </div>
      </nav>
    </header>
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">{children}</main>
  </div>;
}

export function PlansLoading() {
  return <div role="status" className={panelClass}>
    <p>Loading your plans…</p>
    <div aria-hidden="true" className="mt-5 h-48 rounded-2xl bg-white/5 motion-safe:animate-pulse" />
  </div>;
}

export function PlansError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className={panelClass}>
    <h2 className="text-xl font-semibold text-amber-200">We couldn’t load your plans</h2>
    <p className="mt-3 text-slate-300">{message}</p>
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <button onClick={retry} className={actionClass}>Try again</button>
      <Link href="/auth/login" className="underline">Sign in</Link>
    </div>
  </div>;
}
