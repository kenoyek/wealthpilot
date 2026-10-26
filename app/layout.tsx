import type { Metadata, Viewport } from "next";
import "./globals.css";
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#176a50" };
export const metadata: Metadata = {
  applicationName: "WealthPilot",
  appleWebApp: {
    capable: true,
    title: "WealthPilot",
    statusBarStyle: "default",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  title: "WealthPilot — Your financial future",
  description:
    "A clearer picture of your money, built for life beyond a fixed salary.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
