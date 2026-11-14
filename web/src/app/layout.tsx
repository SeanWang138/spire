import type { Metadata, Viewport } from "next";
import {
  Cinzel,
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { AppProviders } from "@/lib/spire/motion";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-serif",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lore",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06060A",
};

export const metadata: Metadata = {
  title: "SpireFi | The BossVault Raid Citadel on NEAR",
  description:
    "Autonomous dark-fantasy raid citadel with self-balancing weapon economies, deterministic boss vaults, signless gameplay, and AI-proposed TEE governance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${cinzel.variable} ${cormorant.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body className="bg-oled text-parchment font-sans min-h-screen selection:bg-solar/30 selection:text-parchment">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-solar focus:px-4 focus:py-2.5 focus:text-xs focus:font-bold focus:text-oled focus:shadow-lg"
        >
          Skip to content
        </a>
        <AppProviders>
          <div className="relative z-10 flex flex-col min-h-screen">
            {children}
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
