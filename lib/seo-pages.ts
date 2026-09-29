export type SeoPage = {
  slug: string;
  seo_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  problem_section: string;
  target_customer_section: string;
  timeease_automation: string;
  soft_cta: string;
  page_status: "APPROVED" | "PUBLISHED";
};

export const seoPages: SeoPage[] = [];

export function getSeoPage(slug: string) {
  return seoPages.find((page) => page.slug === slug);
}
