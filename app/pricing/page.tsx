import Link from "next/link";

const plans = [
  {
    name: "Pay as you go",
    price: "From US$39",
    suffix: "",
    note: "Best for occasional tasks",
    credits: "No monthly commitment",
    taskGuide: "Pay only when you need TimeEase.",
    features: ["PDF / invoice extraction", "Excel / CSV cleanup", "Automation from US$99"],
    cta: "Start a task",
    href: "/upload",
    featured: false,
  },
  {
    name: "Starter",
    price: "US$49",
    suffix: "/month",
    note: "Best for light repeat use",
    credits: "60 credits / month",
    taskGuide: "About 3 standard file tasks.",
    features: ["Standard processing", "Use credits across supported tasks", "Cancel anytime"],
    cta: "Monthly checkout coming next",
    href: "",
    featured: false,
  },
  {
    name: "Business",
    price: "US$99",
    suffix: "/month",
    note: "Best for regular weekly work",
    credits: "140 credits / month",
    taskGuide: "About 7 standard file tasks.",
    features: ["Priority processing", "Built for repeat jobs", "Better value for frequent use"],
    cta: "Monthly checkout coming next",
    href: "",
    featured: true,
  },
  {
    name: "Pro",
    price: "US$299",
    suffix: "/month",
    note: "Best for recurring operations",
    credits: "450 credits / month",
    taskGuide: "For higher-volume recurring work.",
    features: ["Priority processing", "Recurring jobs", "Automation workflows"],
    cta: "Monthly checkout coming next",
    href: "",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="page-shell pricing-shell">
      <Link className="back-link" href="/">← Back to TimeEase</Link>

      <section className="pricing-header">
        <div className="eyebrow">Simple pricing</div>
        <h1>Choose how often you use TimeEase.</h1>
        <p className="hero-copy">
          Use pay-as-you-go for occasional work. Choose a monthly plan when you
          regularly need documents, spreadsheets, or automation handled.
        </p>
        <div className="pricing-help">
          Not sure? Start with pay-as-you-go. You can move to a monthly plan later.
        </div>
      </section>

      <section className="pricing-grid" aria-label="TimeEase plans">
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
                {plan.suffix && <small>{plan.suffix}</small>}
              </div>
              <p className="plan-credits">{plan.credits}</p>
              <p className="plan-guide">{plan.taskGuide}</p>
            </div>

            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>

            {plan.href ? (
              <Link className="button primary plan-button" href={plan.href}>
                {plan.cta} →
              </Link>
            ) : (
              <div className="button plan-button disabled-button" aria-disabled="true">
                {plan.cta}
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="credit-box">
        <div>
          <div className="eyebrow">How credits work</div>
          <h2>Credits keep monthly usage simple.</h2>
        </div>
        <div className="credit-list">
          <span>PDF / Invoice → 20 credits</span>
          <span>Excel / CSV → 20 credits</span>
          <span>Complex document → 35 credits</span>
          <span>Coding / analysis → 40 credits</span>
          <span>Automation → 60+ credits</span>
        </div>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Want to try TimeEase first?</div>
          <h2>Start with one task. No subscription required.</h2>
          <p>
            The existing one-off payment flow stays available while monthly
            checkout is connected separately.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Start a task →
        </Link>
      </section>
    </main>
  );
}
