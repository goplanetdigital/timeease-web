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
          You do not need to upload a full bank statement. Share only the evidence
          related to the issue, such as a receipt, order confirmation, refund email,
          screenshot, invoice, or the relevant transaction only.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Duplicate or incorrect charge</h2>
          <p>Share the relevant transaction, receipt, invoice, or order record without exposing unrelated activity.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Refund not received</h2>
          <p>Use the refund confirmation, merchant email, order record, or a screenshot showing the missing refund.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Common case</span>
          <h2>Deposit or subscription issue</h2>
          <p>Share only the cancellation, deposit, or charge evidence needed to explain the problem.</p>
        </article>
      </section>

      <section className="article-section">
        <div className="eyebrow">Privacy first</div>
        <h2>Only send what is relevant.</h2>
        <p>
          You can crop screenshots, hide unrelated transactions, and remove account
          numbers or other details that are not needed for the review.
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
          <div className="eyebrow">Start a review</div>
          <h2>Share only the relevant evidence</h2>
          <p>
            A receipt, screenshot, email, invoice, order record, or single relevant
            transaction is enough to start. You will review the price before payment.
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
