import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">TimeEase</div>
        <h1>Turn messy files into ready-to-use results.</h1>
        <p className="hero-copy">
          Upload your PDF, invoice, Excel, or CSV. TimeEase cleans, extracts,
          and organizes the work automatically.
        </p>

        <div className="hero-actions">
          <Link className="button primary" href="/upload">
            Upload a file →
          </Link>
        </div>

        <p className="note">
          No subscription. Pay only for the task you submit.
        </p>
      </section>

      <section className="grid" id="start">
        <article className="card">
          <span className="card-kicker">From US$39</span>
          <h2>PDF / Invoice → Excel</h2>
          <p>
            Extract tables, invoice details, and structured data into a clean,
            usable spreadsheet.
          </p>
          <Link className="text-link" href="/upload">
            Start this task →
          </Link>
        </article>

        <article className="card">
          <span className="card-kicker">From US$39</span>
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
          <span className="card-kicker">From US$99</span>
          <h2>Task Automation</h2>
          <p>
            Turn repetitive data work into an automated workflow using APIs,
            webhooks, and connected tools.
          </p>
          <Link className="text-link" href="/upload">
            Automate a task →
          </Link>
        </article>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">How it works</div>
          <h2>Upload. Review the price. Get the finished result.</h2>
          <p>
            Standard jobs are processed automatically after secure payment.
            You can track progress and download the completed result when it is
            ready.
          </p>
        </div>

        <Link className="button primary" href="/upload">
          Start now →
        </Link>
      </section>
    </main>
  );
}
