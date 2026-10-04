import Link from "next/link";

const intakeUrl =
  "https://206-189-36-241.sslip.io/form/d97f51f0-8349-4121-9bed-cf29f1b51f1b";

export default function RecoverMoneyPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Money Recovery</div>
        <h1>Describe the money issue first. Evidence can come later.</h1>
        <p className="article-intro">
          You do not need to upload a full bank statement — and you do not need
          to upload any document just to start. Tell TimeEase what happened first.
          Add only the relevant evidence if it helps.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Duplicate or incorrect charge</h2>
          <p>Start by describing the charge. Add a cropped transaction or receipt only if needed.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Refund not received</h2>
          <p>Tell us the amount, merchant, refund date, and what has happened so far. Evidence is optional at the first step.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Deposit or subscription issue</h2>
          <p>Describe the cancellation, deposit, or unexpected charge without exposing unrelated financial activity.</p>
        </article>
      </section>

      <section className="article-section">
        <div className="eyebrow">Privacy first</div>
        <h2>No full statement required.</h2>
        <p>
          If evidence is useful, send only the relevant receipt, screenshot, email,
          invoice, order record, or single transaction. Crop or hide unrelated
          transactions and account details.
        </p>
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
          <div className="eyebrow">Start privately</div>
          <h2>Describe what happened</h2>
          <p>
            Start with the issue and amount. Uploading a document is optional.
            You will review the price before payment.
          </p>
        </div>
        <a
          className="button primary"
          href={intakeUrl}
          target="_blank"
          rel="noreferrer"
        >
          Describe My Money Issue →
        </a>
      </section>
    </main>
  );
}
