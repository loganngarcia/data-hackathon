import Link from "next/link";

/** Former three-screen deck used static fixtures; live data is on `/` only. */
export default function LegacyDeckPage() {
  return (
    <main className="tp-dashboard-shell" style={{ padding: 24 }}>
      <p className="tp-body">
        This route previously hosted a demo deck with placeholder data. It has been removed.{" "}
        <Link href="/">Open the Tipping Point dashboard</Link> for IRS TEOS / D1-backed portfolio data.
      </p>
    </main>
  );
}
