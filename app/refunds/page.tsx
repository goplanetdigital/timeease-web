import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "TimeEase refund and order issue policy.",
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>
      <section className="page-header">
        <div className="eyebrow">Refunds</div>
        <h1>Refund Policy</h1>
        <p className="article-intro">
          If there is a problem with your TimeEase order, contact support with
          your checkout email and Job ID so we can review it.
        </p>
      </section>

      <section className="article-section">
        <h2>Before processing starts</h2>
        <p>
          If an order has not entered processing, contact support as soon as
          possible. Eligibility for cancellation or refund depends on the order
          status at the time we receive the request.
        </p>
      </section>

      <section className="article-section">
        <h2>After processing starts</h2>
        <p>
          Because TimeEase performs digital processing work specifically for each
          order, completed or substantially processed work is generally not
          refundable simply because the customer changes their mind.
        </p>
      </section>

      <section className="article-section">
        <h2>Incorrect or failed delivery</h2>
        <p>
          If the delivered result is missing, corrupted, or clearly inconsistent
          with the purchased service, contact support. We will first attempt to
          correct or re-deliver the result and will review refund requests when a
          reasonable correction cannot be provided.
        </p>
      </section>
    </main>
  );
}
