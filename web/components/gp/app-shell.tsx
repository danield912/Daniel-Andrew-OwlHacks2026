"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarHeart, ChevronDown, Home, LogIn, LogOut, Search, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonLink } from "./button";
import { LogoMark } from "./logo-mark";
import { Portal } from "./portal";
import { useToast } from "./toast";
import { useUser } from "./user";

const NAV = [
  { href: "/", label: "Games", icon: Home, match: (path: string) => path === "/" },
  { href: "/plans", label: "My Plans", icon: CalendarHeart, match: (path: string) => path.startsWith("/plans") },
  { href: "/account", label: "Account", icon: UserRound, match: (path: string) => path.startsWith("/account") },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="group flex items-center gap-2.5 rounded-xl font-display text-lg font-extrabold tracking-tight text-white">
    <motion.span
      whileHover={{ rotate: -10, scale: 1.08 }}
      transition={{ type: "spring", stiffness: 400, damping: 12 }}
      className="block rounded-xl shadow-glow-sm"
    >
      <LogoMark size={40} />
    </motion.span>
    {!compact && <span>Philly <span className="gp-gradient-text">GamePlan</span></span>}
  </Link>;
}

function NavSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return <form
    role="search"
    onSubmit={event => {
      event.preventDefault();
      router.push(`/?q=${encodeURIComponent(query.trim())}#games`);
    }}
    className="relative hidden w-full max-w-xs lg:block"
  >
    <label htmlFor="nav-search" className="sr-only">Search games</label>
    <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
    <input
      id="nav-search"
      type="search"
      value={query}
      onChange={event => setQuery(event.target.value)}
      placeholder="Search teams, opponents, venues"
      className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white placeholder:text-slate-500 transition focus:border-mint-300/50 focus:outline-none focus:ring-4 focus:ring-mint-300/10"
    />
  </form>;
}

function UserMenu() {
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (user.status === "loading") return <div className="h-10 w-28 animate-pulse rounded-xl bg-white/5" aria-hidden="true" />;
  if (user.status === "signed-out") {
    return <div className="flex items-center gap-2">
      <ButtonLink href="/auth/login" variant="ghost" size="sm" icon={<LogIn size={16} aria-hidden="true" />} className="hidden sm:inline-flex">Sign in</ButtonLink>
      <ButtonLink href="/auth/sign-up" size="sm">Join free</ButtonLink>
    </div>;
  }

  return <div ref={wrapper} className="relative">
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(value => !value)}
      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition hover:border-white/20 hover:bg-white/[0.07]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-mint-300 text-sm font-bold text-night-950">{user.initials}</span>
      <span className="hidden max-w-[120px] truncate text-sm font-semibold text-white sm:block">{user.name}</span>
      <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-slate-400"><ChevronDown size={16} aria-hidden="true" /></motion.span>
    </button>
    <AnimatePresence>
      {open && <motion.div
        role="menu"
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 origin-top-right rounded-2xl border border-white/10 bg-night-800/95 p-2 shadow-lift backdrop-blur-xl"
      >
        <div className="px-3 py-2">
          <p className="truncate font-semibold text-white">{user.name}</p>
          <p className="truncate text-sm text-slate-400">{user.email}</p>
        </div>
        <div className="my-1 h-px bg-white/10" />
        {[
          { href: "/plans", label: "My Plans", icon: CalendarHeart },
          { href: "/account", label: "Account & defaults", icon: Settings },
        ].map(item => <Link
          key={item.href}
          href={item.href}
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
        ><item.icon size={17} aria-hidden="true" />{item.label}</Link>)}
        <button
          type="button"
          role="menuitem"
          onClick={async () => {
            setOpen(false);
            await user.signOut();
            toast.info("Signed out. See you on game day 👋");
            router.push("/");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-200 transition hover:bg-rose-500/10"
        ><LogOut size={17} aria-hidden="true" />Sign out</button>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

function MobileTabBar() {
  const pathname = usePathname();
  return <Portal>
    <nav aria-label="Main" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-50 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-3xl border border-white/10 bg-night-800/85 p-1.5 shadow-lift backdrop-blur-2xl">
        {NAV.map(item => {
          const active = item.match(pathname);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold">
            {active && <motion.span layoutId="mobile-tab" className="absolute inset-0 rounded-2xl bg-mint-300/15" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <item.icon size={21} className={cn("relative transition-colors", active ? "text-mint-300" : "text-slate-400")} aria-hidden="true" />
            <span className={cn("relative", active ? "text-mint-200" : "text-slate-400")}>{item.label}</span>
          </Link>;
        })}
      </div>
    </nav>
  </Portal>;
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  return <div className="gp-sky relative min-h-screen overflow-x-clip">
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-night-900/70 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.slice(0, 2).map(item => {
            const active = item.match(pathname);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("relative rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors", active ? "text-white" : "text-slate-400 hover:text-white")}>
              {active && <motion.span layoutId="desktop-nav" className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative flex items-center gap-2"><item.icon size={16} aria-hidden="true" />{item.label}</span>
            </Link>;
          })}
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          <NavSearch />
          <UserMenu />
        </div>
      </div>
    </header>
    <main className={cn("mx-auto px-4 pb-32 pt-6 sm:px-6 sm:pt-10 md:pb-16", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</main>
    <footer className="mx-auto hidden max-w-6xl items-center justify-between gap-4 border-t border-white/[0.06] px-6 py-8 text-sm text-slate-500 md:flex">
      <span>Philly GamePlan · Made for the whole game day 🦅⚾🏀</span>
      <span>Place and route data from Google · Games from Ticketmaster</span>
    </footer>
    <MobileTabBar />
  </div>;
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
    <div className="min-w-0">
      {eyebrow && <p className="gp-eyebrow">{eyebrow}</p>}
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-xl text-slate-400">{subtitle}</p>}
    </div>
    {action}
  </div>;
}
