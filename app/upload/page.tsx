import Link from "next/link";

const intakeUrl =
  "https://206-189-36-241.sslip.io/form/ecb81a49-c630-4c1d-a644-955b53e569bc";

export default function UploadPage() {
  return (
    <main className="page-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Start a task</div>
        <h1>Upload your file.</h1>
        <p className="hero-copy">
          Tell us what you need, upload your file, review the price, and continue
          to secure checkout.
        </p>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Secure upload</div>
          <h2>Send your task to TimeEase</h2>
          <p>
            Supports Excel and CSV cleaning, PDF or invoice extraction, coding
            tasks, automation work, and AI review.
          </p>
          <p className="note">
            No subscription. You will see the price before payment. Payment is
            handled securely by Stripe.
          </p>
        </div>

        <a
          className="button primary"
          href={intakeUrl}
          target="_blank"
          rel="noreferrer"
        >
          Continue to Secure Upload →
        </a>
      </section>

      <section className="grid" style={{ marginTop: "24px" }}>
        <article className="card">
          <span className="card-kicker">1 · Upload</span>
          <h2>Add your file</h2>
          <p>Choose the task type and add any special instructions.</p>
        </article>
        <article className="card">
          <span className="card-kicker">2 · Pay</span>
          <h2>Review the price</h2>
          <p>Continue only after you are happy with the calculated price.</p>
        </article>
        <article className="card">
          <span className="card-kicker">3 · Receive</span>
          <h2>Get the result</h2>
          <p>Track processing and download your completed result when ready.</p>
        </article>
      </section>
    </main>
  );
}