"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Logo } from "@/components/gp/app-shell";
import { Stadium3D } from "@/components/gp/stadium-3d";

const PERKS = [
  { emoji: "🚇", text: "Know exactly when to leave, by SEPTA or car" },
  { emoji: "🍻", text: "Find tailgates, bars, and food near the stadium" },
  { emoji: "🙌", text: "Share one plan with your whole crew" },
];

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return <div className="gp-sky grid min-h-svh lg:grid-cols-2">
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] p-10 lg:flex">
      <Logo />
      <div>
        <Stadium3D compact className="-mx-10" />
        <h2 className="mt-2 font-display text-4xl font-extrabold leading-tight text-white">Great game.<br /><span className="gp-gradient-text">Even better day.</span></h2>
        <ul className="mt-6 space-y-3">
          {PERKS.map((perk, index) => <motion.li
            key={perk.text}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="flex items-center gap-3 text-slate-300"
          ><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-lg" aria-hidden="true">{perk.emoji}</span>{perk.text}</motion.li>)}
        </ul>
      </div>
      <p className="text-sm text-slate-500">Eagles · Phillies · Sixers · Temple</p>
    </aside>

    <main className="flex flex-col px-4 py-8 sm:px-8">
      <div className="lg:hidden"><Logo /></div>
      <div className="m-auto w-full max-w-md py-10">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className="gp-panel p-7 sm:p-9"
        >
          <h1 className="font-display text-3xl font-extrabold text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-400">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </motion.div>
        {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
      </div>
    </main>
  </div>;
}
