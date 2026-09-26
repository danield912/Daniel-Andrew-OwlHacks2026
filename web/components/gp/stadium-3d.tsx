"use client";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

const YARD_NUMBERS = ["10", "20", "30", "40", "50", "40", "30", "20", "10"];

// A 3D football field under the lights. Tilts toward the pointer; balls float
// at different depths; a route line draws from "home" to the stadium.
export function Stadium3D({ className, compact = false }: { className?: string; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 90, damping: 18 };
  const tiltX = useSpring(useTransform(py, [-1, 1], [64, 52]), spring);
  const tiltZ = useSpring(useTransform(px, [-1, 1], [-26, -14]), spring);
  const floatX = useSpring(useTransform(px, [-1, 1], [-14, 14]), spring);
  const floatY = useSpring(useTransform(py, [-1, 1], [-10, 10]), spring);

  function onMove(event: React.PointerEvent) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    py.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  return <div
    ref={ref}
    onPointerMove={onMove}
    onPointerLeave={() => { px.set(0); py.set(0); }}
    aria-hidden="true"
    className={cn("relative isolate select-none overflow-hidden [mask-image:radial-gradient(ellipse_75%_70%_at_50%_45%,#000_55%,transparent_100%)]", compact ? "h-[260px]" : "h-[340px] sm:h-[420px]", className)}
  >
    {/* Floodlight beams */}
    <div className="absolute -left-10 -top-24 h-[140%] w-40 origin-top animate-beam bg-gradient-to-b from-mint-200/35 via-mint-300/5 to-transparent blur-2xl" />
    <div className="absolute -right-6 -top-24 h-[140%] w-40 origin-top animate-beam bg-gradient-to-b from-indigo-200/30 via-indigo-300/5 to-transparent blur-2xl [animation-delay:-4s]" />
    <div className="absolute left-1/2 top-[-30%] h-64 w-[80%] -translate-x-1/2 rounded-full bg-mint-300/10 blur-3xl" />

    <div className="absolute inset-0 grid place-items-center [perspective:900px]">
      <motion.div
        style={{ rotateX: tiltX, rotateZ: tiltZ, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={cn("relative rounded-[28px]", compact ? "h-[360px] w-[210px]" : "h-[440px] w-[260px] sm:h-[520px] sm:w-[300px]")}
      >
        {/* Turf */}
        <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/15 shadow-[0_60px_120px_-30px_rgba(45,212,191,0.45)]"
          style={{ background: "linear-gradient(180deg,#0c5a4a 0%,#0e6b56 50%,#0c5a4a 100%)" }}>
          {/* mowing stripes */}
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0 24px, transparent 24px 48px)" }} />
          {/* yard lines, scrolling slowly */}
          <div className="absolute inset-x-[10%] inset-y-[12%] animate-field-scroll" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 48px)" }} />
          {/* hash marks */}
          <div className="absolute inset-y-[12%] left-[34%] w-2" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 9.6px)" }} />
          <div className="absolute inset-y-[12%] right-[34%] w-2" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 9.6px)" }} />
          {/* end zones */}
          <div className="absolute inset-x-0 top-0 grid h-[12%] place-items-center bg-gradient-to-r from-[#004C54] to-[#0b6b6b]">
            <span className="font-score text-sm font-bold tracking-[0.5em] text-white/85">PHILLY</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 grid h-[12%] place-items-center bg-gradient-to-r from-[#1e3a8a] to-[#0e7490]">
            <span className="font-score text-sm font-bold tracking-[0.5em] text-white/85">GAMEPLAN</span>
          </div>
          {/* yard numbers */}
          <div className="absolute inset-y-[12%] left-[12%] flex flex-col justify-around">
            {YARD_NUMBERS.map((number, index) => <span key={index} className="font-score text-[11px] font-bold text-white/55 [writing-mode:vertical-rl]">{number}</span>)}
          </div>
          {/* scanning light */}
          {!reduce && <motion.div
            className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-white/15 to-transparent"
            animate={{ top: ["-20%", "110%"] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
          />}
          {/* route: home → stadium */}
          <svg viewBox="0 0 100 180" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <motion.path
              d="M 22 160 C 30 120, 78 118, 64 86 S 40 44, 60 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="3 3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, delay: 0.6, ease: "easeInOut", repeat: reduce ? 0 : Infinity, repeatDelay: 2.5 }}
            />
            <circle cx="22" cy="160" r="3" fill="#fbbf24" />
            <circle cx="60" cy="24" r="3.6" fill="#fb7185" />
          </svg>
        </div>
        {/* Goal posts, standing up out of the field */}
        <div className="absolute left-1/2 top-[3%] h-16 w-14 -translate-x-1/2 [transform:rotateX(-90deg)_translateZ(0)] [transform-origin:bottom]" style={{ transformStyle: "preserve-3d" }}>
          <div className="absolute bottom-0 left-1/2 h-8 w-[3px] -translate-x-1/2 bg-amber-300" />
          <div className="absolute bottom-8 left-0 h-[3px] w-full bg-amber-300" />
          <div className="absolute bottom-8 left-0 h-8 w-[3px] bg-amber-300" />
          <div className="absolute bottom-8 right-0 h-8 w-[3px] bg-amber-300" />
        </div>
      </motion.div>
    </div>

    {/* Floating balls at different depths */}
    <motion.div style={{ x: floatX, y: floatY }} className="absolute inset-0">
      <motion.span
        className={cn("absolute drop-shadow-[0_18px_24px_rgba(0,0,0,0.5)]", compact ? "left-[12%] top-[14%] text-4xl" : "left-[10%] top-[16%] text-5xl sm:text-6xl")}
        animate={reduce ? undefined : { y: [0, -14, 0], rotate: [-18, 12, -18] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >🏈</motion.span>
      <motion.span
        className={cn("absolute drop-shadow-[0_14px_20px_rgba(0,0,0,0.5)]", compact ? "right-[12%] top-[30%] text-3xl" : "right-[10%] top-[26%] text-4xl sm:text-5xl")}
        animate={reduce ? undefined : { y: [0, 12, 0], rotate: [0, 360] }}
        transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 12, repeat: Infinity, ease: "linear" } }}
      >🏀</motion.span>
      <motion.span
        className={cn("absolute drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)]", compact ? "bottom-[12%] right-[26%] text-2xl" : "bottom-[14%] right-[22%] text-3xl sm:text-4xl")}
        animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, -360] }}
        transition={{ y: { duration: 3.4, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 9, repeat: Infinity, ease: "linear" } }}
      >⚾</motion.span>
    </motion.div>

    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-night-900 to-transparent" />
  </div>;
}
