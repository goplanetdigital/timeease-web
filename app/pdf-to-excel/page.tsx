import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Excel",
  description: "Convert PDF tables and document data into a clean, usable Excel spreadsheet with TimeEase.",
  alternates: { canonical: "/pdf-to-excel" },
};

const faqItems = [
  ["What kind of PDF can I send?", "You can send PDFs that contain tables, invoice-style fields, or other structured information you want organized into Excel."],
  ["Do I need a subscription?", "No. Pay-as-you-go is available for one-off PDF to Excel jobs."],
  ["Will I see the price before paying?", "Yes. TimeEase shows the price before you continue to secure checkout."],
];

export default function PdfToExcelPage() {
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
        <div className="eyebrow">PDF to Excel</div>
        <h1>Turn PDF data into a clean Excel file.</h1>
        <p className="article-intro">
          Upload a PDF and get the tables, fields, and structured data organized into a spreadsheet you can actually use.
        </p>
      </section>
      <section className="grid">
        <article className="card"><h2>Extract tables</h2><p>Move tabular PDF content into organized rows and columns.</p></article>
        <article className="card"><h2>Clean the output</h2><p>Reduce formatting mess and make the spreadsheet easier to work with.</p></article>
        <article className="card"><h2>Ready to use</h2><p>Receive a practical Excel output for review, reporting, or further processing.</p></article>
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
        <div><div className="eyebrow">From US$39</div><h2>Send your PDF to TimeEase</h2><p>Review the price before payment. No subscription required.</p></div>
        <Link className="button primary" href="/upload">Convert PDF to Excel →</Link>
      </section>
    </main>
  );
}
