import Link from "next/link";

const plans = [
  {
    name: "Basic",
    price: "US$9",
    note: "Best for one simple file",
    description: "For clear, standard documents with straightforward extraction.",
    features: [
      "1 simple PDF or invoice",
      "Clear layout and readable data",
      "Single table or straightforward fields",
      "Excel delivery by email",
    ],
  },
  {
    name: "Complex",
    price: "US$39",
    note: "Best for detailed or multi-page files",
    description: "For documents that need more extraction, cleanup, or review.",
    features: [
      "Multi-page documents",
      "Multiple tables or sections",
      "More complex formatting",
      "Additional review where needed",
    ],
    featured: true,
  },
  {
    name: "Batch",
    price: "US$99",
    note: "Best for multiple files",
    description: "For batch processing or larger sets of related documents.",
    features: [
      "Multiple files",
      "Batch extraction and cleanup",
      "Consistent structured output",
      "Best for repeat or higher-volume work",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <main className="page-shell pricing-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="pricing-header">
        <div className="eyebrow">Simple pricing</div>
        <h1>Choose the level that matches your file.</h1>
        <p className="hero-copy">
          Start at US$9 for a simple file. Choose Complex for harder documents,
          or Batch when you have multiple files to process.
        </p>
        <div className="pricing-help">
          Not sure which level fits? Start with Basic and we’ll flag it if the file needs an upgrade.
        </div>
      </section>

      <section className="pricing-grid pricing-grid-three" aria-label="TimeEase pricing">
        {plans.map((plan) => (
          <article
            className={`pricing-card${plan.featured ? " featured" : ""}`}
            key={plan.name}
          >
            {plan.featured && <div className="popular-badge">Most popular</div>}

            <div className="pricing-card-top">
              <div className="plan-note">{plan.note}</div>
              <h2>{plan.name}</h2>
              <div className="plan-price">
                <span>{plan.price}</span>
                <small>/ task</small>
              </div>
              <p className="plan-guide">{plan.description}</p>
            </div>

            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>

            <Link className="button primary plan-button" href="/upload">
              Choose {plan.name} →
            </Link>
          </article>
        ))}
      </section>

      <section className="credit-box">
        <div>
          <div className="eyebrow">What counts as complex?</div>
          <h2>We price by the work required, not just file size.</h2>
        </div>
        <div className="credit-list">
          <span>Basic: one simple file</span>
          <span>Complex: multi-page or multi-table</span>
          <span>Batch: multiple files</span>
          <span>Unclear data is flagged, not guessed</span>
        </div>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Ready to start?</div>
          <h2>Pay securely, upload privately, receive the result by email.</h2>
          <p>
            Your paid order creates a private upload link automatically.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Start a task →
        </Link>
      </section>
    </main>
  );
}
