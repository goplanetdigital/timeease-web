import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Excel & CSV Cleanup",
  description: "Clean messy Excel and CSV files by organizing columns, fixing formatting, and removing duplicates with TimeEase.",
  alternates: { canonical: "/excel-cleanup" },
};

const faqItems = [
  ["What can TimeEase clean in Excel?", "TimeEase can help remove obvious duplicates, organize columns, standardize inconsistent values, and improve spreadsheet structure."],
  ["Will my original file be replaced?", "No. The goal is to return a cleaned result while keeping the original source separate."],
  ["Can I use pay-as-you-go?", "Yes. Pay-as-you-go remains available for occasional spreadsheet cleanup."],
];

export default function ExcelCleanupPage() {
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
        <div className="eyebrow">Excel & CSV Cleanup</div>
        <h1>Clean messy spreadsheets without doing it row by row.</h1>
        <p className="article-intro">
          Send an Excel or CSV file and get back a cleaner, more consistent version that is easier to use.
        </p>
      </section>
      <section className="grid">
        <article className="card"><h2>Remove duplicates</h2><p>Reduce repeated records and obvious duplicate rows.</p></article>
        <article className="card"><h2>Fix structure</h2><p>Organize columns, formatting, and inconsistent values.</p></article>
        <article className="card"><h2>Ready for work</h2><p>Get a cleaner file for analysis, reporting, imports, or operations.</p></article>
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
        <div><div className="eyebrow">From US$39</div><h2>Send your spreadsheet</h2><p>Review the price before payment. Pay only when you need the service.</p></div>
        <Link className="button primary" href="/upload">Clean my spreadsheet →</Link>
      </section>
    </main>
  );
}
