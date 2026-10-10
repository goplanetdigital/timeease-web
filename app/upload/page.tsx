import Link from "next/link";
import PlanSelector from "./PlanSelector";

const shopUrl =
  process.env.NEXT_PUBLIC_SHOP_URL ||
  "https://bvzw62-1t.myshopify.com";

export default function UploadPage() {
  return (
    <main className="page-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Start a task</div>
        <h1>Pay once. Upload securely. Get the finished file by email.</h1>
        <p className="hero-copy">
          Choose your TimeEase service in secure checkout. After payment,
          your order gets a private upload link automatically—no need to re-enter
          your email or order number.
        </p>
      </section>

      <PlanSelector />

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Secure checkout</div>
          <h2>Start your TimeEase order</h2>
          <p>
            Complete payment first, then upload your PDF, invoice, spreadsheet,
            or other supported file from your private order link.
          </p>
          <p className="note">
            Your file is linked to your paid order automatically. When processing
            is complete, the finished result is sent to your checkout email.
          </p>
        </div>

        <a className="button primary" href={shopUrl}>
          Continue to secure checkout →
        </a>
      </section>

      <section className="grid" style={{ marginTop: "24px" }}>
        <article className="card">
          <span className="card-kicker">1 · Pay</span>
          <h2>Complete checkout</h2>
          <p>Choose the service you need and pay securely online.</p>
        </article>
        <article className="card">
          <span className="card-kicker">2 · Upload</span>
          <h2>Use your private upload link</h2>
          <p>Your paid order creates a secure upload link automatically.</p>
        </article>
        <article className="card">
          <span className="card-kicker">3 · Receive</span>
          <h2>Get the completed result</h2>
          <p>TimeEase processes the job and emails the finished file to you.</p>
        </article>
      </section>
    </main>
  );
}
