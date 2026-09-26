import { Suspense } from "react";
import { PlansList } from "@/components/plans/plans-list";
import { PlansLoading, PlansShell } from "@/components/plans/shared";

export default function Page() {
  return <Suspense fallback={<PlansShell><PlansLoading /></PlansShell>}><PlansList /></Suspense>;
}
