import type { Metadata, Viewport } from "next";
import { Cinzel, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080B11",
};

export const metadata: Metadata = {
  title: "SpireFi | Dark-Fantasy GameFi Protocol on NEAR",
  description:
    "Signless dark-fantasy raid citadel on NEAR testnet. Adaptive boss resistance, deterministic jackpot splits, and on-chain conqueror trophies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${cinzel.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body className="bg-oled text-slate-200 font-sans min-h-screen selection:bg-solar/30 selection:text-white">
        <main className="relative z-10 flex flex-col min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
