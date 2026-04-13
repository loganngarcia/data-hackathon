import type { Metadata } from "next";
import { Fraunces, Inter, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { DevRootExtras } from "@/components/dev/dev-root-extras";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-dashboard-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tipping Point | Aggies Data Hackathon 2026",
  description: "Editorial three-screen demo for nonprofit resilience triage, decision review, and scenario memoing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const bodyClass = `${manrope.variable} ${fraunces.variable} ${inter.variable}`;

  return (
    <html lang="en">
      <body className={bodyClass}>
        {process.env.NODE_ENV === "development" ? (
          <DevRootExtras>{children}</DevRootExtras>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
