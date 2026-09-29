import Link from "next/link";
import { getSeoPages } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Solutions | TimeEase",
  description: "Practical document automation solutions from TimeEase.",
};

export default async function SolutionsPage() {
  const solutions = await getSeoPages();

  return (
    <main className="page-shell">
      <section className="page-header">
        <Link className="back-link" href="/">← TimeEase</Link>
        <div className="eyebrow">Solutions</div>
        <h1>Practical automation for repetitive document work.</h1>
        <p>
          Focused guides for finance, procurement, and operations teams dealing
          with recurring PDF, invoice, RFQ, purchase order, and spreadsheet workflows.
        </p>
      </section>

      {solutions.length === 0 ? (
        <section className="card">
          <h2>New solution guides are being reviewed.</h2>
          <p>
            TimeEase only publishes solution pages after they pass QA review.
            Check back soon, or view the current TimeEase products now.
          </p>
          <a
            className="button primary"
            href="https://payhip.com/TimeEase"
            target="_blank"
            rel="noreferrer"
          >
            View Products
          </a>
        </section>
      ) : (
        <section className="solution-list">
          {solutions.map((item) => (
            <Link
              className="solution-card"
              href={`/solutions/${item.slug}`}
              key={item.slug}
            >
              <div>
                <h2>{item.h1}</h2>
                <p>{item.meta_description}</p>
              </div>
              <span>Read →</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
