"use client";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export function Panel({ className, children, as: Tag = "section", ...props }:
  { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={cn("gp-panel p-6 sm:p-8", className)} {...props}>{children}</Tag>;
}

// A card that tilts in 3D toward the pointer, with a moving light glare.
export function TiltCard({ className, children, glow = "#5eead4", intensity = 9, style }: {
  className?: string;
  children: ReactNode;
  glow?: string;
  intensity?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), spring);
  const glareX = useTransform(px, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(py, [0, 1], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, ${glow}33, transparent 45%)`;

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return <div className="perspective-1000 h-full">
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", ...style }}
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={cn("group relative h-full rounded-3xl", className)}
    >
      {children}
      <motion.div
        aria-hidden="true"
        style={{ background: glare }}
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </motion.div>
  </div>;
}
