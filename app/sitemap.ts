import type { MetadataRoute } from "next";
import { getPublicCategories } from "@/lib/categories/config";
import { getPublicTools } from "@/lib/tools/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://toolnest.io";
  const [publicTools, publicCategories] = await Promise.all([
    getPublicTools(),
    getPublicCategories(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/api`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/api/docs`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/api/status`, changeFrequency: "daily", priority: 0.5 },
  ];

  const categoryPages: MetadataRoute.Sitemap = publicCategories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const toolPages: MetadataRoute.Sitemap = publicTools.map((t) => ({
    url: `${base}/tool/${t.slug}`,
    changeFrequency: "weekly",
    priority: t.slug === "pdf-merge" || t.slug === "pdf-split" ? 1.0 : 0.9,
    lastModified: new Date(),
  }));

  return [...staticPages, ...categoryPages, ...toolPages];
}
