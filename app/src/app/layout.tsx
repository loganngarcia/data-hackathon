import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aggies Data Hackathon 2026 · Vercel + TypeScript",
  description:
    "Mocked three-screen demo for the Aggies Data Hackathon 2026 portfolio workflow. Built with Next.js and TypeScript; intended for deployment on Vercel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
