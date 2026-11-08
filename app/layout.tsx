import type { Metadata, Viewport } from "next";
import { Header } from "@/components/chrome";
import { ScrollObserver } from "@/components/scroll-observer";
import { SettingsProvider } from "@/components/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Interlock — scam protection that watches the whole conversation",
    template: "%s · Interlock",
  },
  description:
    "Interlock scores a conversation rather than a message, tracks a scam through six stages, and places a safeguard at each one — ending with a cooling-off hold on the irreversible account changes a carrier uniquely controls. Research prototype on synthetic data.",
  applicationName: "Interlock",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#171917" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <SettingsProvider>
          <ScrollObserver />
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Header />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  );
}
