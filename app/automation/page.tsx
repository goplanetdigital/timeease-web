import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Task Automation",
  description: "Automate repetitive business tasks with APIs, webhooks, data workflows, and connected tools using TimeEase.",
  alternates: { canonical: "/automation" },
};

export default function AutomationPage() {
  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Task Automation</div>
        <h1>Turn repetitive work into an automated workflow.</h1>
        <p className="article-intro">
          TimeEase can help connect files, APIs, webhooks, forms, and business
          tools so repeated tasks need less manual work.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Connect tools</h2>
          <p>Move data between forms, spreadsheets, APIs, and business systems.</p>
        </article>
        <article className="card">
          <h2>Reduce manual steps</h2>
          <p>Automate repetitive processing, formatting, routing, and notifications.</p>
        </article>
        <article className="card">
          <h2>Keep it practical</h2>
          <p>Start with one clear workflow and expand only when it proves useful.</p>
        </article>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">From US$99</div>
          <h2>Describe the task you want automated</h2>
          <p>Review the scope and price before payment.</p>
        </div>
        <Link className="button primary" href="/upload">
          Automate this task →
        </Link>
      </section>
    </main>
  );
}
