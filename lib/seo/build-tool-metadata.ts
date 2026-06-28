import type { Metadata } from "next";
import type { Tool } from "@/lib/data/types";
import { getCategory } from "@/lib/data/categories";
import { getToolSeoConfig } from "./tool-seo-data";
import { categoryUrl, toolUrl } from "./site-url";

export function buildToolMetadata(tool: Tool): Metadata {
  const seo = getToolSeoConfig(tool.slug);
  const category = getCategory(tool.category);
  const url = toolUrl(tool.slug);

  const title = seo?.title ?? tool.name;
  const description = seo?.metaDescription ?? tool.description;
  const keywords = seo?.keywords ?? [tool.name, category?.name ?? "online tool", "free", "ToolNest"];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: seo ? `${seo.title} | ToolNest` : `${tool.name} | ToolNest`,
      description,
      url,
      siteName: "ToolNest",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: seo?.title ?? tool.name,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    category: category?.name ?? "technology",
    other: {
      "application-name": "ToolNest",
    },
  };
}
