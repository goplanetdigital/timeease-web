import Link from "next/link";

const solutions = [
  {
    slug: "bulk-invoice-data-extraction-to-excel",
    title: "Bulk invoice data extraction to Excel",
    description:
      "A practical workflow for turning recurring invoice batches into structured spreadsheet output.",
  },
];

export const metadata = {
  title: "Solutions | TimeEase",
  description: "Practical document automation solutions from TimeEase.",
};

export default function SolutionsPage() {
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

      <section className="solution-list">
        {solutions.map((item) => (
          <Link className="solution-card" href={`/solutions/${item.slug}`} key={item.slug}>
            <div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
            <span>Read →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
