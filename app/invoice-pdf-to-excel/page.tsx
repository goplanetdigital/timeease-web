import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice PDF to Excel | TimeEase",
  description: "Convert invoice PDFs into structured Excel-ready data. See how TimeEase handles invoice extraction and start a secure order.",
  alternates: { canonical: "/invoice-pdf-to-excel" },
};

export default function InvoiceLandingPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">TimeEase · Invoice processing</div>
        <h1>Turn invoice PDFs into usable spreadsheet data.</h1>
        <p className="hero-copy">Stop copying invoice numbers, dates, totals, and line items by hand. Upload your files through a secure order flow and receive a structured result.</p>
        <div className="hero-actions">
          <Link className="button primary" href="/upload?utm_source=organic&utm_medium=seo&utm_campaign=invoice_pdf_to_excel">Get started →</Link>
          <Link className="button secondary" href="/pricing">See pricing</Link>
        </div>
        <p className="trust-line">Check the extracted data before using it for accounting or payments.</p>
      </section>
      <section className="grid service-grid">
        <article className="card"><h2>Invoice fields</h2><p>Organize invoice number, vendor, invoice date, currency, and totals.</p></article>
        <article className="card"><h2>Line items</h2><p>Turn supported tables into spreadsheet-friendly rows for review.</p></article>
        <article className="card"><h2>Clear output</h2><p>Use the extracted information for reconciliation and reporting after checking accuracy.</p></article>
      </section>
      <section className="cta-panel"><div><h2>Ready to reduce manual entry?</h2><p>Start with an invoice and follow the secure order process.</p></div><Link className="button primary" href="/upload?utm_source=organic&utm_medium=seo&utm_campaign=invoice_pdf_to_excel">Start now →</Link></section>
    </main>
  );
}
