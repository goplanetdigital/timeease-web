import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://timeease-ruby.vercel.app";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/solutions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    {
      url: `${base}/solutions/bulk-invoice-data-extraction-to-excel`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
