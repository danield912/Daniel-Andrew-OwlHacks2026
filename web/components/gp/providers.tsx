"use client";
import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ToastProvider } from "./toast";
import { UserProvider } from "./user";

export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">
    <UserProvider>
      <ToastProvider>{children}</ToastProvider>
    </UserProvider>
  </MotionConfig>;
}
