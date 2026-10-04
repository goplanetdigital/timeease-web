import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CSV Cleanup",
  description: "Clean messy CSV files by fixing structure, removing duplicates, and standardizing data with TimeEase.",
  alternates: { canonical: "/csv-cleanup" },
};

const faqItems = [
  ["What can TimeEase clean in a CSV file?", "TimeEase can help reduce duplicate rows, organize columns, and standardize inconsistent values and formatting."],
  ["Can the cleaned CSV be used for imports?", "The output is designed to be easier to review and reuse for analysis, reporting, CRM, or system imports."],
  ["Do I need a monthly plan?", "No. One-off CSV cleanup remains available with pay-as-you-go pricing."],
];

export default function CsvCleanupPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <main className="page-shell article-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">CSV Cleanup</div>
        <h1>Turn a messy CSV into a cleaner, usable file.</h1>
        <p className="article-intro">
          Send a CSV and get back a cleaner version with better structure,
          fewer duplicates, and more consistent values.
        </p>
      </section>

      <section className="grid">
        <article className="card"><h2>Remove duplicates</h2><p>Reduce repeated rows and obvious duplicate records.</p></article>
        <article className="card"><h2>Standardize values</h2><p>Make dates, labels, columns, and formats more consistent.</p></article>
        <article className="card"><h2>Ready for import</h2><p>Get a cleaner CSV for analysis, reporting, CRM, or system imports.</p></article>
      </section>

      <section className="article-section">
        <div className="eyebrow">FAQ</div>
        <h2>Before you upload</h2>
        {faqItems.map(([question, answer]) => (
          <div key={question}>
            <strong>{question}</strong>
            <p>{answer}</p>
          </div>
        ))}
      </section>

      <section className="cta-panel">
        <div><div className="eyebrow">From US$39</div><h2>Send your CSV to TimeEase</h2><p>Review the price before payment. No subscription required.</p></div>
        <Link className="button primary" href="/upload">Clean my CSV →</Link>
      </section>
    </main>
  );
}
