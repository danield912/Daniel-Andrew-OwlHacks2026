"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Renders into <body> so fixed overlays aren't trapped by animated parents.
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
