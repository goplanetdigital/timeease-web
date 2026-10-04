import Link from "next/link";

export default function UploadPage() {
  return (
    <main className="page-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Start a task</div>
        <h1>Upload your file.</h1>
        <p className="hero-copy">
          Add your file, choose the task, and review the price before secure
          checkout.
        </p>
      </section>

      <section className="embedded-form-shell">
        <iframe
          className="embedded-form"
          src="https://206-189-36-241.sslip.io/form/d97f51f0-8349-4121-9bed-cf29f1b51f1b"
          title="TimeEase task upload"
        />
      </section>

      <p className="note">
        Secure payment is handled by Stripe. Your completed result is delivered
        automatically after processing.
      </p>
    </main>
  );
}