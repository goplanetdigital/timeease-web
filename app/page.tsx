import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">TimeEase</div>
        <h1>Upload your file. Get a finished result.</h1>
        <p className="hero-copy">
          Submit a document, spreadsheet, or digital task. TimeEase routes it to
          the right AI worker, calculates the price, and delivers the completed
          result after secure payment.
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/upload">
            Start a task
          </Link>
        </div>
      </section>

      <section className="grid" id="start">
        <article className="card">
          <span className="card-kicker">1 · Upload</span>
          <h2>Add your file</h2>
          <p>Send a PDF, CSV, Excel file, image, or task instructions.</p>
        </article>
        <article className="card">
          <span className="card-kicker">2 · Pay</span>
          <h2>Review the price</h2>
          <p>Pricing is calculated automatically before secure checkout.</p>
        </article>
        <article className="card">
          <span className="card-kicker">3 · Receive</span>
          <h2>Get the result</h2>
          <p>Your completed deliverable is sent automatically after processing.</p>
        </article>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Ready to start?</div>
          <h2>Send your task to TimeEase.</h2>
          <p>
            The production intake supports CSV and Excel cleaning, document
            extraction, coding tasks, automation work, and AI review.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Upload file →
        </Link>
      </section>
    </main>
  );
}