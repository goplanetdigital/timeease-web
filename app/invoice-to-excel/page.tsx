import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice to Excel",
  description: "Extract invoice details into a clean Excel spreadsheet with TimeEase.",
  alternates: { canonical: "/invoice-to-excel" },
};

export default function InvoiceToExcelPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>
      <section className="page-header">
        <div className="eyebrow">Invoice to Excel</div>
        <h1>Turn invoices into structured spreadsheet data.</h1>
        <p className="article-intro">
          Extract useful invoice fields and line-item data into a clean Excel file without retyping everything manually.
        </p>
      </section>
      <section className="grid">
        <article className="card"><h2>Key invoice fields</h2><p>Organize dates, invoice numbers, suppliers, totals, and other relevant fields.</p></article>
        <article className="card"><h2>Line items</h2><p>Structure invoice rows so they are easier to review and reuse.</p></article>
        <article className="card"><h2>Clean output</h2><p>Receive an Excel file that is easier to sort, check, and process.</p></article>
      </section>
      <section className="cta-panel">
        <div><div className="eyebrow">From US$39</div><h2>Upload your invoice</h2><p>Review the price before payment. No monthly commitment required.</p></div>
        <Link className="button primary" href="/upload">Convert invoice to Excel →</Link>
      </section>
    </main>
  );
}
