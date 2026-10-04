import Link from "next/link";

const plans = [
  {
    key: "payg",
    name: "Pay as you go",
    price: "From US$39",
    suffix: "",
    note: "Best for occasional tasks",
    credits: "No monthly commitment",
    taskGuide: "Pay only when you need TimeEase.",
    features: ["PDF / invoice extraction", "Excel / CSV cleanup", "Automation from US$99"],
    featured: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: "US$49",
    suffix: "/month",
    note: "Best for light repeat use",
    credits: "60 credits / month",
    taskGuide: "About 3 standard file tasks.",
    features: ["Standard processing", "Use credits across supported tasks", "Cancel anytime"],
    featured: false,
  },
  {
    key: "business",
    name: "Business",
    price: "US$99",
    suffix: "/month",
    note: "Best for regular weekly work",
    credits: "140 credits / month",
    taskGuide: "About 7 standard file tasks.",
    features: ["Priority processing", "Built for repeat jobs", "Better value for frequent use"],
    featured: true,
  },
  {
    key: "pro",
    name: "Pro",
    price: "US$299",
    suffix: "/month",
    note: "Best for recurring operations",
    credits: "450 credits / month",
    taskGuide: "For higher-volume recurring work.",
    features: ["Priority processing", "Recurring jobs", "Automation workflows"],
    featured: false,
  },
] as const;

export default function PricingPage() {
  const monthlyReady = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_STARTER &&
    process.env.STRIPE_PRICE_BUSINESS &&
    process.env.STRIPE_PRICE_PRO
  );

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
        <div className="hero-actions" style={{ marginTop: 18 }}>
          <Link className="button secondary" href="/credits">
            Check my credits →
          </Link>
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

            {plan.key === "payg" ? (
              <Link className="button primary plan-button" href="/upload">
                Start a task →
              </Link>
            ) : monthlyReady ? (
              <form action="/api/subscription/checkout" method="post">
                <input type="hidden" name="plan" value={plan.key} />
                <button className="button primary plan-button" type="submit">
                  Choose {plan.name} →
                </button>
              </form>
            ) : (
              <div className="button plan-button disabled-button" aria-disabled="true">
                Monthly checkout is being connected
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
            Pay-as-you-go stays available. Monthly buttons turn on automatically
            once the Stripe recurring prices are connected.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Start a task →
        </Link>
      </section>
    </main>
  );
}
