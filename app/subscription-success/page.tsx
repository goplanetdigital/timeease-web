import Link from "next/link";

export default function SubscriptionSuccessPage() {
  return (
    <main className="page-shell article-shell">
      <section className="page-header">
        <div className="eyebrow">Subscription confirmed</div>
        <h1>Your TimeEase plan is active.</h1>
        <p className="article-intro">
          Your monthly plan has started. The subscription will renew automatically
          until you cancel it.
        </p>
      </section>

      <section className="cta-panel">
        <div>
          <div className="eyebrow">Next step</div>
          <h2>Send your next task.</h2>
          <p>
            Monthly credits will be connected to task intake as the subscription
            credit system is enabled.
          </p>
        </div>
        <Link className="button primary" href="/upload">
          Start a task →
        </Link>
      </section>
    </main>
  );
}
