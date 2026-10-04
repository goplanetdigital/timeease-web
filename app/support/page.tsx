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
        <h1>How can we help?</h1>
        <p className="article-intro">
          Send us the details below. If your question is about an existing task,
          include the Job ID so we can locate it faster.
        </p>
      </section>

      <SupportForm />

      <section className="support-details">
        <div className="eyebrow">For faster support</div>
        <h2>Keep your order details handy.</h2>
        <div className="support-detail-list">
          <span>Your checkout email</span>
          <span>Job ID, if available</span>
          <span>Payment / File / Result / Subscription / Other</span>
          <span>A short description of what went wrong</span>
        </div>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Already have a TimeEase email?</div>
          <h2>You can also reply directly to that email.</h2>
          <p>
            Keeping the original email thread gives us useful order context and
            can make support faster.
          </p>
        </div>
        <Link className="button secondary" href="/upload">
          Back to upload →
        </Link>
      </section>
    </main>
  );
}
