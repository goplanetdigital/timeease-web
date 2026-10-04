import type { Metadata } from "next";
import Link from "next/link";
import CreditsChecker from "./credits-checker";

export const metadata: Metadata = {
  title: "My Credits",
  description: "Check your TimeEase monthly subscription credit balance.",
  alternates: { canonical: "/credits" },
};

export default function CreditsPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">
        ← Back to TimeEase
      </Link>

      <section className="page-header">
        <div className="eyebrow">My Credits</div>
        <h1>Check your remaining credits.</h1>
        <p className="article-intro">
          Enter the email used for your TimeEase subscription to see your current
          monthly balance.
        </p>
      </section>

      <CreditsChecker />
    </main>
  );
}
