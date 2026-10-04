import Link from "next/link";

const plans = [
  {
    name: "Pay as you go",
    price: "From US$39",
    note: "For occasional tasks",
    credits: "No monthly credits",
    features: ["PDF / invoice extraction", "Excel / CSV cleanup", "Automation from US$99"],
  },
  {
    name: "Starter",
    price: "US$49/mo",
    note: "For light repeat use",
    credits: "60 credits / month",
    features: ["About 3 standard file tasks", "Standard processing", "Cancel anytime"],
  },
  {
    name: "Business",
    price: "US$99/mo",
    note: "For regular weekly work",
    credits: "140 credits / month",
    features: ["About 7 standard file tasks", "Priority processing", "Built for repeat jobs"],
  },
  {
    name: "Pro",
    price: "US$299/mo",
    note: "For recurring operations",
    credits: "450 credits / month",
    features: ["Higher monthly usage", "Priority processing", "Recurring jobs", "Automation workflows"],
  },
];

export default function PricingPage() {
  return (
    <main className="page-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="page-header">
        <div className="eyebrow">Pricing</div>
        <h1>Pay per task, or use TimeEase every month.</h1>
        <p className="hero-copy">
          Start with a one-off job. Monthly plans are designed for customers who
          regularly need document, spreadsheet, and automation work.
        </p>
      </section>

      <section className="grid">
        {plans.map((plan) => (
          <article className="card" key={plan.name}>
            <span className="card-kicker">{plan.note}</span>
            <h2>{plan.name}</h2>
            <div className="service-price">{plan.price}</div>
            <p><strong>{plan.credits}</strong></p>
            <p>{plan.features.join(" · ")}</p>
          </article>
        ))}
      </section>

      <section className="article-section">
        <div className="eyebrow">Credit guide</div>
        <h2>Credits match the amount of work.</h2>
        <p>
          Standard PDF / invoice extraction: 20 credits · Excel / CSV cleanup:
          20 credits · Complex document processing: 35 credits · Coding or analysis:
          40 credits · Automation: 60+ credits.
        </p>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Live today</div>
          <h2>Pay-as-you-go stays available.</h2>
          <p>
            The current one-off payment flow remains unchanged while monthly
            billing is added separately.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Start a task →
        </Link>
      </section>
    </main>
  );
}
