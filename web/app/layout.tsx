import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Bricolage_Grotesque, Geist } from "next/font/google";
import { Providers } from "@/components/gp/providers";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Philly GamePlan",
  description: "Plan your Philly sports outing, from pregame to the final whistle.",
};

export const viewport: Viewport = {
  themeColor: "#07121a",
  viewportFit: "cover",
};

const body = Geist({ variable: "--font-body", display: "swap", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", display: "swap", subsets: ["latin"], weight: ["600", "700", "800"] });
const score = Barlow_Condensed({ variable: "--font-score", display: "swap", subsets: ["latin"], weight: ["500", "600", "700"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${body.variable} ${display.variable} ${score.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
