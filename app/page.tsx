import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">TimeEase</div>
        <h1>Turn business documents into usable data, faster.</h1>
        <p className="hero-copy">
          Practical PDF-to-Excel, invoice extraction, RFQ extraction, purchase
          order extraction, and structured document workflows for finance,
          procurement, and operations teams.
        </p>
        <div className="hero-actions">
          <a
            className="button primary"
            href="https://payhip.com/TimeEase"
            target="_blank"
            rel="noreferrer"
          >
            View Products
          </a>
          <Link className="button secondary" href="/solutions">
            Explore Solutions
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <span className="card-kicker">Finance</span>
          <h2>Invoice & PDF extraction</h2>
          <p>
            Convert repetitive document data into structured spreadsheet output
            without manual re-keying.
          </p>
        </article>

        <article className="card">
          <span className="card-kicker">Procurement</span>
          <h2>RFQ & purchase order workflows</h2>
          <p>
            Extract line items, normalize fields, and prepare structured data for
            quotation and review workflows.
          </p>
        </article>

        <article className="card">
          <span className="card-kicker">Operations</span>
          <h2>Document-to-spreadsheet automation</h2>
          <p>
            Turn recurring business documents into cleaner, reusable Excel or
            CSV outputs.
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-copy">
          <div className="eyebrow">Useful before you buy</div>
          <h2>Solution pages built around real work problems.</h2>
          <p>
            TimeEase publishes focused guides for document-processing problems
            that can be solved with structured extraction and spreadsheet
            automation.
          </p>
        </div>
        <Link className="text-link" href="/solutions">
          Browse solution pages →
        </Link>
      </section>
    </main>
  );
}
