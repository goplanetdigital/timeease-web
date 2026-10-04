import Link from "next/link";
import type { Metadata } from "next";
import SupportForm from "./support-form";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Get help with a TimeEase payment, file, result, subscription, or other issue.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Help & Support</div>
        <h1>Tell us what went wrong.</h1>
        <p className="article-intro">
          Send the details below. If your question is about a task, include the Job ID so it is easier to locate.
        </p>
      </section>

      <SupportForm />
    </main>
  );
}
