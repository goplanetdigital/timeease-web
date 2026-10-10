import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How TimeEase handles customer, payment, and uploaded file information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>
      <section className="page-header">
        <div className="eyebrow">Privacy</div>
        <h1>Privacy Policy</h1>
        <p className="article-intro">
          TimeEase uses the information you provide only to process your order,
          deliver your result, provide support, and operate the service.
        </p>
      </section>

      <section className="article-section">
        <h2>Information we receive</h2>
        <p>
          We may receive your checkout email, order details, payment status,
          uploaded files, task instructions, and technical information required
          to process and deliver your order.
        </p>
      </section>

      <section className="article-section">
        <h2>Payments</h2>
        <p>
          Payments are handled by our payment and commerce providers. TimeEase
          does not store your full card number.
        </p>
      </section>

      <section className="article-section">
        <h2>Uploaded files</h2>
        <p>
          Files are used to perform the service you purchased and may pass through
          the systems required for secure upload, processing, delivery, and quality
          checks. Do not upload information you are not authorized to share.
        </p>
      </section>

      <section className="article-section">
        <h2>Support and retention</h2>
        <p>
          We may retain order and processing records for operational, support,
          fraud-prevention, and accounting purposes. If you need help with a file
          or order, contact us through the Help & Support page.
        </p>
      </section>
    </main>
  );
}
