import Link from "next/link";
import UploadFirstForm from "../upload/UploadFirstForm";
export default function UploadPage() {
  return <main className="page-shell">
    <Link className="back-link" href="/">← Back to TimeEase</Link>
    <section className="page-header">
      <div className="eyebrow">Start a task</div>
      <h1>Upload once. See your price. Pay securely.</h1>
      <p className="hero-copy">Choose your service, select your files, and review the exact price before payment. Your files stay attached to the order, so you will not need to upload them again.</p>
    </section>
    <UploadFirstForm />
  </main>;
}
