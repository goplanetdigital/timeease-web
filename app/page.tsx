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
          <span className="service-price">US$9</span>
          <h2>Basic File → Excel</h2>
          <p>
            Process one simple PDF or invoice into a clean, usable spreadsheet.
          </p>
          <Link className="text-link" href="/upload">
            Start Basic →
          </Link>
        </article>

        <article className="card">
          <span className="service-price">US$39</span>
          <h2>Complex File Processing</h2>
          <p>
            Handle multi-page, multi-table, or more complex documents with extra review.
          </p>
          <Link className="text-link" href="/upload">
            Choose Complex →
          </Link>
        </article>

        <article className="card">
          <span className="service-price">US$99</span>
          <h2>Batch File Processing</h2>
          <p>
            Process multiple related files and return consistent structured outputs.
          </p>
          <Link className="text-link" href="/upload">
            Choose Batch →
          </Link>
        </article>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Simple pricing</div>
          <h2>Three clear levels: Basic, Complex, and Batch.</h2>
          <p>
            Start at US$9 for a simple file, US$39 for complex work, or US$99 for batch processing.
          </p>
        </div>

        <Link className="button secondary" href="/pricing">
          View pricing →
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
