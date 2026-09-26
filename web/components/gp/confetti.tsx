"use client";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

const COLORS = ["#5eead4", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#ffffff"];

// A small celebratory burst. Render it with a changing `key` to replay.
export function ConfettiBurst({ colors = COLORS, pieces = 26 }: { colors?: string[]; pieces?: number }) {
  const reduce = useReducedMotion();
  const bits = useMemo(() => Array.from({ length: pieces }, (_, index) => {
    const angle = (index / pieces) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 70 + Math.random() * 90;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      rotate: Math.random() * 540 - 270,
      color: colors[index % colors.length],
      size: 6 + Math.random() * 6,
      round: Math.random() > 0.6,
      delay: Math.random() * 0.08,
    };
  }), [colors, pieces]);
  if (reduce) return null;
  return <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10">
    {bits.map((bit, index) => <motion.span
      key={index}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
      animate={{ x: bit.x, y: [0, bit.y, bit.y + 70], opacity: [1, 1, 0], scale: 1, rotate: bit.rotate }}
      transition={{ duration: 1.1, delay: bit.delay, ease: [0.2, 0.7, 0.3, 1] }}
      className="absolute block"
      style={{ width: bit.size, height: bit.round ? bit.size : bit.size * 0.45, background: bit.color, borderRadius: bit.round ? 999 : 2 }}
    />)}
  </span>;
}

// Animated check mark that draws itself.
export function SuccessCheck({ size = 56 }: { size?: number }) {
  return <motion.svg width={size} height={size} viewBox="0 0 52 52" initial="hidden" animate="shown" aria-hidden="true">
    <motion.circle
      cx="26" cy="26" r="24" fill="rgba(94,234,212,0.12)" stroke="#5eead4" strokeWidth="2.5"
      variants={{ hidden: { pathLength: 0, opacity: 0 }, shown: { pathLength: 1, opacity: 1 } }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    />
    <motion.path
      d="M15 27 l7 7 l15 -16" fill="none" stroke="#5eead4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1 } }}
      transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
    />
  </motion.svg>;
}
