"use client";
import { motion } from "motion/react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { TEAMS } from "@/lib/team-style";
import { TiltCard } from "@/components/gp/surfaces";
import { CountdownBadge } from "@/components/gp/countdown";
import { staggerChild } from "@/components/gp/reveal";
import { formatGameTime, type Game } from "./types";

export function GameCard({ game, onPlan }: { game: Game; onPlan: (game: Game) => void }) {
  const team = TEAMS[game.team];
  return <motion.li variants={staggerChild} layout className="list-none">
    <TiltCard glow={team.glow} className="flex flex-col overflow-hidden border border-white/[0.08] bg-night-800/70 shadow-lift backdrop-blur">
      <div className="relative h-28 overflow-hidden" style={{ background: team.gradient }}>
        <div className="gp-yardlines absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="absolute -right-4 -top-6 text-[110px] leading-none opacity-25 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true">{team.emoji}</div>
        <div className="relative flex h-full flex-col justify-between p-5" style={{ transform: "translateZ(30px)" }}>
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">{team.emoji} {team.name}</span>
            {game.startTime && <CountdownBadge startsAt={game.startTime} className="bg-black/30 text-white ring-white/20" />}
          </div>
          <p className="font-score text-sm font-semibold uppercase tracking-[0.2em] text-white/80">{team.sport}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5" style={{ transform: "translateZ(20px)" }}>
        <h3 className="font-display text-xl font-bold leading-snug text-white">
          {game.opponent ? <>vs. <span className="text-white">{game.opponent}</span></> : game.name}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          {team.fullName}
          {game.tag && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-semibold text-amber-200">{game.tag}</span>}
        </p>
        <div className="mb-5 mt-4 space-y-2 text-sm text-slate-300">
          <p className="flex items-center gap-2"><CalendarDays size={16} className="shrink-0 text-slate-500" aria-hidden="true" />{formatGameTime(game.startTime, true)}</p>
          <p className="flex items-center gap-2"><MapPin size={16} className="shrink-0 text-slate-500" aria-hidden="true" />{game.venue}</p>
        </div>
        <motion.button
          type="button"
          onClick={() => onPlan(game)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] font-semibold text-white ring-1 ring-white/10 transition-colors hover:bg-gradient-to-r hover:from-mint-300 hover:to-glow-cyan hover:text-night-950 hover:ring-transparent"
        >
          Plan this game <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
        </motion.button>
      </div>
    </TiltCard>
  </motion.li>;
}
