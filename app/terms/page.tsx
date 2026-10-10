import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using TimeEase file processing and automation services.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>
      <section className="page-header">
        <div className="eyebrow">Terms</div>
        <h1>Terms of Service</h1>
        <p className="article-intro">
          By purchasing or using TimeEase, you agree to these service terms.
        </p>
      </section>

      <section className="article-section">
        <h2>Service scope</h2>
        <p>
          TimeEase provides document processing, spreadsheet cleanup, structured
          data extraction, and related automation services based on the selected
          product and the files or instructions you submit.
        </p>
      </section>

      <section className="article-section">
        <h2>Your responsibility</h2>
        <p>
          You are responsible for providing accurate instructions and for having
          the right to upload and process the files you submit. Do not submit
          unlawful, infringing, or unauthorized content.
        </p>
      </section>

      <section className="article-section">
        <h2>Processing and review</h2>
        <p>
          Automated processing can require review when source files are unclear,
          incomplete, unusually formatted, or outside the purchased scope. We may
          contact you when additional information is needed.
        </p>
      </section>

      <section className="article-section">
        <h2>Delivery</h2>
        <p>
          Completed results are normally delivered to the email associated with
          the order. Delivery time can vary by file size, complexity, service
          availability, and whether review is required.
        </p>
      </section>
    </main>
  );
}
