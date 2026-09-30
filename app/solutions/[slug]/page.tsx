import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoPage } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function HeroGraphic() {
  return (
    <div className="visual-card visual-hero" aria-label="Purchase order PDF to structured Excel workflow">
      <div className="visual-column">
        <div className="visual-doc">
          <div className="visual-doc-badge">PDF</div>
          <strong>PURCHASE ORDER</strong>
          <span>PO-10458</span>
          <span>Acme Supplies</span>
          <div className="visual-lines">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="visual-caption">Purchase Order PDF</div>
      </div>

      <div className="visual-arrow">→</div>

      <div className="visual-process">
        <div className="visual-process-core">✦</div>
        <div className="visual-process-item">PO fields</div>
        <div className="visual-process-item">Line items</div>
        <div className="visual-process-item">Review flags</div>
      </div>

      <div className="visual-arrow">→</div>

      <div className="visual-column">
        <div className="visual-sheet">
          <div className="visual-sheet-head">
            <span className="excel-chip">X</span>
            <strong>Excel / CSV</strong>
          </div>
          <div className="visual-grid-row visual-grid-header">
            <span>PO</span><span>Vendor</span><span>Item</span><span>Qty</span>
          </div>
          <div className="visual-grid-row">
            <span>10458</span><span>Acme</span><span>001</span><span>10</span>
          </div>
          <div className="visual-grid-row">
            <span>10458</span><span>Acme</span><span>002</span><span>5</span>
          </div>
          <div className="visual-grid-row">
            <span>10458</span><span>Acme</span><span>003</span><span>20</span>
          </div>
        </div>
        <div className="visual-caption">Structured output</div>
      </div>
    </div>
  );
}

function ComparisonGraphic() {
  return (
    <div className="comparison-visual" aria-label="Manual copy paste compared with TimeEase">
      <div className="comparison-panel comparison-manual">
        <div className="comparison-kicker">Manual</div>
        <h3>Copy-paste document data by hand</h3>
        <div className="comparison-stack">
          <div className="mini-doc">PDF</div>
          <span>→</span>
          <div className="mini-sheet">Spreadsheet</div>
        </div>
        <div className="comparison-tags">
          <span>Copy-paste</span>
          <span>Slow</span>
          <span>Errors</span>
        </div>
      </div>

      <div className="comparison-panel comparison-auto">
        <div className="comparison-kicker">With TimeEase</div>
        <h3>Turn supported documents into review-ready rows</h3>
        <div className="comparison-stack">
          <div className="mini-doc">PDF</div>
          <span>→</span>
          <div className="mini-process">✦</div>
          <span>→</span>
          <div className="mini-sheet">Excel / CSV</div>
        </div>
        <div className="comparison-tags">
          <span>Structured output</span>
          <span>Review flags</span>
          <span>Ready for workflow</span>
        </div>
      </div>
    </div>
  );
}

function WorkflowGraphic() {
  const steps = [
    ["1", "Upload PO PDF"],
    ["2", "Extract PO fields"],
    ["3", "Extract line items"],
    ["4", "Flag uncertain values"],
    ["5", "Export Excel / CSV"],
  ];

  return (
    <div className="workflow-visual" aria-label="Five step TimeEase document workflow">
      {steps.map(([number, label], index) => (
        <div className="workflow-step-wrap" key={label}>
          <div className="workflow-step">
            <div className="workflow-number">{number}</div>
            <div className="workflow-label">{label}</div>
          </div>
          {index < steps.length - 1 && <div className="workflow-connector">→</div>}
        </div>
      ))}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getSeoPage(slug);

  if (!page) {
    return {
      title: "Solution not found | TimeEase",
    };
  }

  return {
    title: page.seo_title,
    description: page.meta_description,
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getSeoPage(slug);

  if (!page) notFound();

  const isPurchaseOrderPage = slug === "purchase-order-pdf-to-excel";
  const displayTitle = isPurchaseOrderPage
    ? "Purchase Order PDF to Excel"
    : page.h1;
  const displaySubtitle = isPurchaseOrderPage
    ? "Extract PO fields and line items into review-ready Excel / CSV."
    : page.intro;

  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/solutions">← All solutions</Link>

      <article>
        <div className="eyebrow">TimeEase Solution</div>
        <h1 className="solution-hero-title">{displayTitle}</h1>
        <p className="article-intro solution-hero-subtitle">{displaySubtitle}</p>

        <HeroGraphic />

        <div className="article-section">
          <h2>The problem</h2>
          <p>{page.problem_section}</p>
        </div>

        <ComparisonGraphic />

        <div className="article-section">
          <h2>Who this is for</h2>
          <p>{page.target_customer_section}</p>
        </div>

        <div className="article-section">
          <h2>How TimeEase can help</h2>
          <p>{page.timeease_automation}</p>
        </div>

        {Array.isArray(page.solution_steps) && page.solution_steps.length > 0 && (
          <div className="article-section">
            <h2>How it works</h2>
            <WorkflowGraphic />
            <ol>
              {page.solution_steps.map((step, index) => (
                <li key={index}>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {Array.isArray(page.common_mistakes) && page.common_mistakes.length > 0 && (
          <div className="article-section">
            <h2>Common mistakes to avoid</h2>
            <ul>
              {page.common_mistakes.map((item, index) => (
                <li key={index}>
                  <p>{item}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cta-panel">
          <div>
            <div className="eyebrow">Next step</div>
            <h2>{page.soft_cta || "Start with a TimeEase product or workflow."}</h2>
          </div>
          <a
            className="button primary"
            href="https://payhip.com/TimeEase"
            target="_blank"
            rel="noreferrer"
          >
            {page.payhip_cta_label || "View Products"}
          </a>
        </div>
      </article>
    </main>
  );
}
