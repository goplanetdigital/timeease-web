import Link from "next/link";
import { notFound } from "next/navigation";

const pages: Record<string, {
  title: string;
  meta: string;
  intro: string;
  problem: string;
  audience: string;
  solution: string;
}> = {
  "bulk-invoice-data-extraction-to-excel": {
    title: "Bulk invoice data extraction to Excel",
    meta: "A practical workflow for converting recurring invoice batches into structured Excel or CSV output.",
    intro:
      "When invoice batches grow, manual copying becomes slow, repetitive, and error-prone. TimeEase helps structure recurring invoice data into spreadsheet-ready output.",
    problem:
      "Finance and accounts teams often spend hours re-keying supplier names, invoice numbers, dates, line items, totals, and other fields into spreadsheets.",
    audience:
      "This workflow is most useful for finance teams, accounts payable teams, bookkeeping services, and operations teams handling recurring invoice batches.",
    solution:
      "TimeEase can extract structured fields from supported business documents and return them as Excel or CSV for review and downstream processing.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) return {};
  return { title: `${page.title} | TimeEase`, description: page.meta };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();

  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/solutions">← All solutions</Link>
      <article>
        <div className="eyebrow">TimeEase Solution</div>
        <h1>{page.title}</h1>
        <p className="article-intro">{page.intro}</p>

        <div className="article-section">
          <h2>The problem</h2>
          <p>{page.problem}</p>
        </div>

        <div className="article-section">
          <h2>Who this is for</h2>
          <p>{page.audience}</p>
        </div>

        <div className="article-section">
          <h2>How TimeEase can help</h2>
          <p>{page.solution}</p>
        </div>

        <div className="cta-panel">
          <div>
            <div className="eyebrow">Next step</div>
            <h2>Start with a TimeEase product or workflow.</h2>
          </div>
          <a
            className="button primary"
            href="https://payhip.com/TimeEase"
            target="_blank"
            rel="noreferrer"
          >
            View TimeEase products
          </a>
        </div>
      </article>
    </main>
  );
}
