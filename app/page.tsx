import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero hero-split">
        <div>
          <div className="eyebrow">TimeEase</div>
          <h1>Turn messy files into clean, ready-to-use results.</h1>
          <p className="hero-copy">
            Pay securely, upload your file from a private order link, and receive a clean, ready-to-use result by email.
          </p>

          <div className="hero-actions">
            <Link className="button primary" href="/upload">
              Upload a file →
            </Link>
            <Link className="button secondary" href="/pricing">
              View monthly plans
            </Link>
          </div>

          <div className="trust-line">
            Secure payment · Private upload link · Automatic email delivery
          </div>
        </div>

        <div className="before-after" aria-label="File cleanup example">
          <div className="before-after-label">Before</div>
          <div className="mini-file messy-file">
            <div className="mini-file-title">invoice-data.csv</div>
            <span className="messy-row" />
            <span className="messy-row short" />
            <span className="messy-row" />
            <span className="messy-row tiny" />
          </div>

          <div className="transform-arrow">→</div>

          <div className="before-after-label">After</div>
          <div className="mini-file clean-file">
            <div className="mini-file-title">clean-result.xlsx</div>
            <div className="sheet-row sheet-head"><span /><span /><span /></div>
            <div className="sheet-row"><span /><span /><span /></div>
            <div className="sheet-row"><span /><span /><span /></div>
            <div className="sheet-row"><span /><span /><span /></div>
          </div>
        </div>
      </section>

      <section className="grid service-grid" id="start">
        <article className="card">
          <span className="service-price">From US$39</span>
          <h2>PDF / Invoice → Excel</h2>
          <p>
            Extract tables, invoice details, and structured data into a clean,
            usable spreadsheet.
          </p>
          <Link className="text-link" href="/upload">
            Convert to Excel →
          </Link>
        </article>

        <article className="card">
          <span className="service-price">From US$39</span>
          <h2>Excel / CSV Cleanup</h2>
          <p>
            Remove duplicates, fix formatting, organize columns, and clean
            messy spreadsheet data.
          </p>
          <Link className="text-link" href="/upload">
            Clean my file →
          </Link>
        </article>

        <article className="card">
          <span className="service-price">From US$99</span>
          <h2>Task Automation</h2>
          <p>
            Turn repetitive data work into an automated workflow using APIs,
            webhooks, and connected tools.
          </p>
          <Link className="text-link" href="/upload">
            Automate this →
          </Link>
        </article>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Monthly plans</div>
          <h2>Use TimeEase regularly? Pay monthly and use credits.</h2>
          <p>
            Keep pay-as-you-go for occasional work, or choose a monthly plan
            for repeat document, spreadsheet, and automation tasks.
          </p>
        </div>

        <Link className="button secondary" href="/pricing">
          Compare plans →
        </Link>
      </section>

      <section className="cta-panel how-it-works">
        <div>
          <div className="eyebrow">How it works</div>
          <h2>Pay. Upload. We process it. You get the result.</h2>
          <p>
            Complete secure checkout, upload from your private order link, and receive the finished result by email when it is ready.
          </p>
        </div>

        <Link className="button primary" href="/upload">
          Start now →
        </Link>
      </section>
    </main>
  );
}
