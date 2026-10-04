import Link from "next/link";
import type { Metadata } from "next";

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
          If you have a question about a payment, file, result, or subscription,
          use the TimeEase email you already received so we can match your request quickly.
        </p>
      </section>

      <section className="support-grid">
        <article className="card">
          <span className="card-kicker">Task or result</span>
          <h2>Something looks wrong?</h2>
          <p>
            Reply to the latest TimeEase email for that task. Keep the Job ID in
            your message and describe what needs to be corrected.
          </p>
        </article>

        <article className="card">
          <span className="card-kicker">Payment or subscription</span>
          <h2>Billing question?</h2>
          <p>
            Reply to your TimeEase payment or subscription email. Include the
            email used at checkout so we can locate the payment quickly.
          </p>
        </article>
      </section>

      <section className="support-details">
        <div className="eyebrow">What to include</div>
        <h2>Send these details for faster support.</h2>
        <div className="support-detail-list">
          <span>Your email</span>
          <span>Job ID, if available</span>
          <span>Payment / File / Result / Subscription / Other</span>
          <span>A short description of the issue</span>
        </div>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">No order email yet?</div>
          <h2>Start or review your TimeEase task.</h2>
          <p>
            Once a task or subscription is created, keep the TimeEase email for
            support and order tracking.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Go to upload →
        </Link>
      </section>
    </main>
  );
}
