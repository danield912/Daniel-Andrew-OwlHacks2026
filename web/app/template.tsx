"use client";
import { motion } from "motion/react";

// Re-mounts on every navigation, giving each page a smooth entrance.
// Anything position: fixed (bottom nav, modals, toasts) renders through a
// portal, because a transformed parent would otherwise trap it.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
