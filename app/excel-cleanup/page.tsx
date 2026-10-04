import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Excel & CSV Cleanup",
  description: "Clean messy Excel and CSV files by organizing columns, fixing formatting, and removing duplicates with TimeEase.",
  alternates: { canonical: "/excel-cleanup" },
};

export default function ExcelCleanupPage() {
  return (
    <main className="page-shell article-shell">
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
      <section className="cta-panel">
        <div><div className="eyebrow">From US$39</div><h2>Send your spreadsheet</h2><p>Review the price before payment. Pay only when you need the service.</p></div>
        <Link className="button primary" href="/upload">Clean my spreadsheet →</Link>
      </section>
    </main>
  );
}
