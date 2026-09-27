import { Suspense } from "react";
import { InviteView } from "@/components/invites/invite-view";

// What shows in the group chat when someone pastes an invite link.
const title = "You’re invited to a Philly GamePlan 🏟️";
const description = "Join the crew for game day: see the plan, add where you’re coming from, and ride together.";
const image = { url: "/invite-preview.png", width: 1200, height: 630, alt: "You’re invited to a Philly GamePlan" };
export const metadata = {
  title,
  description,
  openGraph: { title, description, images: [image] },
  twitter: { card: "summary_large_image" as const, title, description, images: [image] },
};

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteView token={token} />;
}
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<p className="p-8">Opening invite…</p>}><Invite params={params} /></Suspense>;
}
