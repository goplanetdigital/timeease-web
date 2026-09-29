export type SeoPage = {
  id?: number | null;
  slug: string;
  seo_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  problem_section: string;
  target_customer_section: string;
  timeease_automation: string;
  solution_steps?: string[];
  common_mistakes?: string[];
  faq?: Array<{ question?: string; answer?: string } | string>;
  soft_cta: string;
  recommended_offer?: string;
  internal_cta_label?: string;
  payhip_cta_label?: string;
  primary_keyword?: string;
  buyer_intent_score?: number;
  page_status: "APPROVED";
  created_at?: string | null;
  updated_at?: string | null;
};

type SeoApiResponse = {
  success: boolean;
  count: number;
  pages: SeoPage[];
  generated_at?: string;
};

const SEO_API_URL =
  "https://206-189-36-241.sslip.io/webhook/timeease-seo-pages";

export async function getSeoPages(): Promise<SeoPage[]> {
  try {
    const response = await fetch(SEO_API_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("TimeEase SEO API error:", response.status);
      return [];
    }

    const data = (await response.json()) as SeoApiResponse;

    if (!data?.success || !Array.isArray(data.pages)) {
      return [];
    }

    return data.pages.filter(
      (page) =>
        page.page_status === "APPROVED" &&
        Boolean(page.slug?.trim()) &&
        Boolean(page.h1?.trim())
    );
  } catch (error) {
    console.error("Failed to load TimeEase SEO pages:", error);
    return [];
  }
}

export async function getSeoPage(slug: string): Promise<SeoPage | undefined> {
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const pages = await getSeoPages();

  return pages.find(
    (page) => String(page.slug || "").trim().toLowerCase() === normalizedSlug
  );
}
