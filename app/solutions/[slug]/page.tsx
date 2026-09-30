import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoPage, type SeoPage } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VisualConfig = {
  shortTitle: string;
  subtitle: string;
  documentLabel: string;
  documentCode: string;
  documentExample: string;
  fieldLabels: [string, string, string];
  outputTitle: string;
  columns: [string, string, string, string];
  rows: [string, string, string, string][];
  workflow: string[];
};

function getVisualConfig(page: SeoPage, slug: string): VisualConfig {
  const source = [
    slug,
    page.primary_keyword || "",
    page.h1 || "",
    page.seo_title || "",
    page.meta_description || "",
  ].join(" ").toLowerCase();

  if (source.includes("purchase order") || source.includes(" po ")) {
    return {
      shortTitle: "Purchase Order PDF to Excel",
      subtitle: "Extract PO fields and line items into review-ready Excel / CSV.",
      documentLabel: "PURCHASE ORDER",
      documentCode: "PO-10458",
      documentExample: "Acme Supplies",
      fieldLabels: ["PO fields", "Line items", "Review flags"],
      outputTitle: "Excel / CSV",
      columns: ["PO", "Vendor", "Item", "Qty"],
      rows: [
        ["10458", "Acme", "001", "10"],
        ["10458", "Acme", "002", "5"],
        ["10458", "Acme", "003", "20"],
      ],
      workflow: [
        "Upload PO PDF",
        "Extract PO fields",
        "Extract line items",
        "Flag uncertain values",
        "Export Excel / CSV",
      ],
    };
  }

  if (source.includes("invoice")) {
    return {
      shortTitle: "Invoice PDF to Excel",
      subtitle: "Turn invoice headers and line items into review-ready spreadsheet data.",
      documentLabel: "INVOICE",
      documentCode: "INV-20841",
      documentExample: "Northstar Trading",
      fieldLabels: ["Invoice fields", "Line items", "Review flags"],
      outputTitle: "Excel / CSV",
      columns: ["Invoice", "Supplier", "Item", "Total"],
      rows: [
        ["20841", "Northstar", "A01", "$420"],
        ["20841", "Northstar", "A02", "$185"],
        ["20841", "Northstar", "A03", "$96"],
      ],
      workflow: [
        "Upload invoice PDF",
        "Extract invoice fields",
        "Extract line items",
        "Flag uncertain values",
        "Export Excel / CSV",
      ],
    };
  }

  if (source.includes("rfq") || source.includes("quotation") || source.includes("quote")) {
    return {
      shortTitle: "RFQ & Quotation Data to Excel",
      subtitle: "Structure supplier quote fields into spreadsheet-ready data for review.",
      documentLabel: "SUPPLIER QUOTE",
      documentCode: "RFQ-3107",
      documentExample: "Supplier Response",
      fieldLabels: ["Quote fields", "Price rows", "Review flags"],
      outputTitle: "Comparison-ready CSV",
      columns: ["Supplier", "Item", "Price", "Lead time"],
      rows: [
        ["Alpha", "A01", "$120", "7d"],
        ["Beta", "A01", "$126", "5d"],
        ["Gamma", "A01", "$118", "9d"],
      ],
      workflow: [
        "Upload supplier PDFs",
        "Extract quote fields",
        "Structure price rows",
        "Flag uncertain values",
        "Export Excel / CSV",
      ],
    };
  }

  if (source.includes("table") || source.includes("spreadsheet")) {
    return {
      shortTitle: "PDF Tables to Spreadsheet",
      subtitle: "Convert supported document tables into structured, review-ready rows.",
      documentLabel: "PDF TABLE",
      documentCode: "TABLE-001",
      documentExample: "Structured source",
      fieldLabels: ["Table fields", "Rows", "Review flags"],
      outputTitle: "Spreadsheet",
      columns: ["Field 1", "Field 2", "Field 3", "Value"],
      rows: [
        ["A", "North", "001", "42"],
        ["B", "South", "002", "18"],
        ["C", "West", "003", "27"],
      ],
      workflow: [
        "Upload document",
        "Identify table fields",
        "Extract structured rows",
        "Flag uncertain values",
        "Export spreadsheet",
      ],
    };
  }

  return {
    shortTitle: page.h1,
    subtitle: page.intro,
    documentLabel: "BUSINESS DOCUMENT",
    documentCode: "DOC-001",
    documentExample: "Supported document",
    fieldLabels: ["Document fields", "Structured rows", "Review flags"],
    outputTitle: "Excel / CSV",
    columns: ["Field", "Source", "Row", "Value"],
    rows: [
      ["A", "Document", "001", "42"],
      ["B", "Document", "002", "18"],
      ["C", "Document", "003", "27"],
    ],
    workflow: [
      "Upload document",
      "Choose required fields",
      "Extract structured data",
      "Flag uncertain values",
      "Export Excel / CSV",
    ],
  };
}

function HeroGraphic({ config }: { config: VisualConfig }) {
  return (
    <div
      className="visual-card visual-hero"
      aria-label={`${config.documentLabel} to ${config.outputTitle} workflow`}
    >
      <div className="visual-column">
        <div className="visual-doc">
          <div className="visual-doc-badge">PDF</div>
          <strong>{config.documentLabel}</strong>
          <span>{config.documentCode}</span>
          <span>{config.documentExample}</span>
          <div className="visual-lines">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="visual-caption">{config.documentLabel} PDF</div>
      </div>

      <div className="visual-arrow">→</div>

      <div className="visual-process">
        <div className="visual-process-core">✦</div>
        {config.fieldLabels.map((label) => (
          <div className="visual-process-item" key={label}>{label}</div>
        ))}
      </div>

      <div className="visual-arrow">→</div>

      <div className="visual-column">
        <div className="visual-sheet">
          <div className="visual-sheet-head">
            <span className="excel-chip">X</span>
            <strong>{config.outputTitle}</strong>
          </div>
          <div className="visual-grid-row visual-grid-header">
            {config.columns.map((column) => <span key={column}>{column}</span>)}
          </div>
          {config.rows.map((row, index) => (
            <div className="visual-grid-row" key={index}>
              {row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}
            </div>
          ))}
        </div>
        <div className="visual-caption">Structured output</div>
      </div>
    </div>
  );
}

function ComparisonGraphic({ config }: { config: VisualConfig }) {
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
          <span>Error-prone</span>
        </div>
      </div>

      <div className="comparison-panel comparison-auto">
        <div className="comparison-kicker">With TimeEase</div>
        <h3>Turn supported documents into review-ready rows</h3>
        <div className="comparison-stack">
          <div className="mini-doc">{config.documentLabel.split(" ")[0]}</div>
          <span>→</span>
          <div className="mini-process">✦</div>
          <span>→</span>
          <div className="mini-sheet">{config.outputTitle}</div>
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

function WorkflowGraphic({ config }: { config: VisualConfig }) {
  return (
    <div className="workflow-visual" aria-label="Five step TimeEase document workflow">
      {config.workflow.map((label, index) => (
        <div className="workflow-step-wrap" key={label}>
          <div className="workflow-step">
            <div className="workflow-number">{index + 1}</div>
            <div className="workflow-label">{label}</div>
          </div>
          {index < config.workflow.length - 1 && (
            <div className="workflow-connector">→</div>
          )}
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

  const visual = getVisualConfig(page, slug);

  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/solutions">← All solutions</Link>

      <article>
        <div className="eyebrow">TimeEase Solution</div>
        <h1 className="solution-hero-title">{visual.shortTitle}</h1>
        <p className="article-intro solution-hero-subtitle">{visual.subtitle}</p>

        <HeroGraphic config={visual} />

        <div className="article-section">
          <h2>The problem</h2>
          <p>{page.problem_section}</p>
        </div>

        <ComparisonGraphic config={visual} />

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
            <WorkflowGraphic config={visual} />
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
