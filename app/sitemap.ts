import type { MetadataRoute } from "next";
import { getSeoPages } from "@/lib/seo-pages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://timeease-ruby.vercel.app";
  const pages = await getSeoPages();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/upload`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pdf-to-excel`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/invoice-to-excel`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/excel-cleanup`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/solutions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  ];

  return [
    ...staticPages,
    ...pages.map((page) => ({
      url: `${base}/solutions/${page.slug}`,
      lastModified: page.updated_at || page.created_at || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
  ];
}
