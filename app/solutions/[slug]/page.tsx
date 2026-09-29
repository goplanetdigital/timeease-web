import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoPage } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  return (
    <main className="page-shell article-shell">
      <Link className="back-link" href="/solutions">← All solutions</Link>

      <article>
        <div className="eyebrow">TimeEase Solution</div>
        <h1>{page.h1}</h1>
        <p className="article-intro">{page.intro}</p>

        <div className="article-section">
          <h2>The problem</h2>
          <p>{page.problem_section}</p>
        </div>

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
