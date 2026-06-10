import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: "OBSIDIAN — Trading Terminal",
  description:
    "Enterprise-grade real-time crypto trading terminal. Live market data, technical indicators, paper trading and alerts.",
  applicationName: "OBSIDIAN",
  appleWebApp: {
    capable: true,
    title: "OBSIDIAN",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
