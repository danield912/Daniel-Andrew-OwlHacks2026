// The app's public address. Links people share (invites, chat previews) use
// it, so they still work for friends when made while testing on localhost.
// Set NEXT_PUBLIC_SITE_URL locally; on Vercel the production domain is used.
export function siteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return /^https?:\/\/[^\s/]+/.test(url) ? url.replace(/\/+$/, "") : null;
}
