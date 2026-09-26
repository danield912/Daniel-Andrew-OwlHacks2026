"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";

// Fades and lifts content in as it scrolls into view. Visible at rest if JS/motion is off.
export function Reveal({ children, delay = 0, className, as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" }) {
  const Component = motion[as];
  return <Component
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "0px 0px -40px 0px" }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >{children}</Component>;
}

export const staggerParent = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06 } },
};

export const staggerChild = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};
