import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moobu | Nonprofit Financial Resilience",
  description:
    "Forward-looking resilience platform for nonprofit financial advisors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <nav className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-moobu-blue">
              Moobu
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/"
                className="text-muted hover:text-foreground transition-colors"
              >
                Portfolio
              </Link>
              <Link
                href="/at-risk"
                className="text-muted hover:text-foreground transition-colors"
              >
                At Risk
              </Link>
            </div>
          </div>
          <span className="text-xs text-muted">
            Aggies Data Hackathon 2026
          </span>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
