import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/me -> { user: { id, name } } when signed in, { user: null } when not.
// Signed-out is not an error here so the header can simply show "Sign in".
// `name` follows the same rule as plan members: profile name if set,
// otherwise the part of the email before "@" (never the full email).
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  if (!user) return NextResponse.json({ user: null }, { headers });

  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const fromProfile = [meta.full_name, meta.name]
    .find((value): value is string => typeof value === "string" && value.trim() !== "")
    ?.trim();
  const name = fromProfile ?? user.email?.split("@")[0] ?? "Guest";

  return NextResponse.json({ user: { id: user.id, name } }, { headers });
}
