import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Task Automation",
  description: "Automate repetitive business tasks with APIs, webhooks, data workflows, and connected tools using TimeEase.",
  alternates: { canonical: "/automation" },
};

const faqItems = [
  ["What kind of work can TimeEase automate?", "TimeEase focuses on repeatable file, data, API, webhook, routing, formatting, and notification workflows."],
  ["How much does automation cost?", "Automation work starts from US$99. More complex work can require a higher price after scope review."],
  ["Do I need to subscribe?", "No. You can start with a one-off automation task and move to a monthly plan later if the work becomes recurring."],
];

export default function AutomationPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <main className="page-shell article-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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
        <article className="card"><h2>Connect tools</h2><p>Move data between forms, spreadsheets, APIs, and business systems.</p></article>
        <article className="card"><h2>Reduce manual steps</h2><p>Automate repetitive processing, formatting, routing, and notifications.</p></article>
        <article className="card"><h2>Keep it practical</h2><p>Start with one clear workflow and expand only when it proves useful.</p></article>
      </section>

      <section className="article-section">
        <div className="eyebrow">FAQ</div>
        <h2>Before you start</h2>
        {faqItems.map(([question, answer]) => (
          <div key={question}>
            <strong>{question}</strong>
            <p>{answer}</p>
          </div>
        ))}
      </section>

      <section className="cta-panel">
        <div><div className="eyebrow">From US$99</div><h2>Describe the task you want automated</h2><p>Review the scope and price before payment.</p></div>
        <Link className="button primary" href="/upload">Automate this task →</Link>
      </section>
    </main>
  );
}
