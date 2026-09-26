"use client";
import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

// Counts up to `value` the first time it scrolls into view.
export function AnimatedNumber({ value, className, duration = 1.2 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!inView || reduce) { node.textContent = String(value); return; }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: latest => { node.textContent = String(Math.round(latest)); },
    });
    return () => controls.stop();
  }, [inView, value, reduce, duration]);
  return <span ref={ref} className={className}>{value}</span>;
}
