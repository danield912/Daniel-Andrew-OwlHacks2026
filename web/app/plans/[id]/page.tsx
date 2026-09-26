import { Suspense } from "react";
import { PlanDetails } from "@/components/plans/plan-details";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDetails id={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-8">Opening plan…</p>}><Detail params={params} /></Suspense>;
}
