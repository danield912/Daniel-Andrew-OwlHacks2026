import { Suspense } from "react";
import { InviteView } from "@/components/invites/invite-view";

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteView token={token} />;
}
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<p className="p-8">Opening invite…</p>}><Invite params={params} /></Suspense>;
}
