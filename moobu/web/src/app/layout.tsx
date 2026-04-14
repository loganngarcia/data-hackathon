import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./NavBar";

export const metadata: Metadata = {
  title: "Fairlight Advisors | Nonprofit Financial Resilience X-Ray",
  description:
    "Portfolio-level financial resilience assessment for nonprofit financial advisors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
