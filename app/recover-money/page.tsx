import Link from "next/link";

const intakeUrl =
  "https://206-189-36-241.sslip.io/form/d97f51f0-8349-4121-9bed-cf29f1b51f1b";

export default function RecoverMoneyPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Money Recovery</div>
        <h1>Find out if money may be worth claiming back.</h1>
        <p className="article-intro">
          Upload the evidence you already have. TimeEase can organize the issue,
          identify the amount in dispute, and prepare a clear refund or claim request.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Duplicate or incorrect charge</h2>
          <p>Use receipts, statements, invoices, or order records to document what was charged.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Refund not received</h2>
          <p>Organize the refund promise, payment record, dates, and follow-up evidence in one place.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Deposit or subscription issue</h2>
          <p>Prepare a concise request when a deposit was not returned or a charge continued after cancellation.</p>
        </article>
      </section>

      <section className="article-section">
        <div className="eyebrow">What you get</div>
        <h2>A ready-to-use claim package</h2>
        <p>
          The output can include a structured summary, timeline, disputed amount,
          supporting evidence checklist, and a draft refund or claim message.
          TimeEase does not guarantee recovery or provide legal advice.
        </p>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Start a review</div>
          <h2>Upload your evidence</h2>
          <p>
            Add receipts, statements, emails, screenshots, or order records and
            describe what happened. You will review the price before payment.
          </p>
        </div>
        <a
          className="button primary"
          href={intakeUrl}
          target="_blank"
          rel="noreferrer"
        >
          Start Money Recovery Review →
        </a>
      </section>
    </main>
  );
}
