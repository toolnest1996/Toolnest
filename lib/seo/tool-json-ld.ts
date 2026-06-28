import { getTool } from "@/lib/data/tools";
import { getCategory } from "@/lib/data/categories";
import { getToolSeoConfig } from "./tool-seo-data";
import { categoryUrl, getSiteUrl, toolUrl } from "./site-url";

export function buildToolJsonLd(slug: string): object | null {
  const tool = getTool(slug);
  const seo = getToolSeoConfig(slug);
  if (!tool || !seo) return null;

  const category = getCategory(tool.category);
  const url = toolUrl(slug);
  const site = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: site,
        name: "ToolNest",
        description: "Free online tools for PDF, images, video, and more.",
      },
      {
        "@type": "WebApplication",
        "@id": `${url}/#app`,
        name: seo.h1 ?? tool.name,
        url,
        description: seo.metaDescription,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires a modern web browser with JavaScript enabled",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        featureList: seo.features.map((f) => f.title).join(", "),
        provider: {
          "@type": "Organization",
          name: "ToolNest",
          url: site,
        },
        isPartOf: { "@id": `${site}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: site,
          },
          ...(category
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: category.name,
                  item: categoryUrl(category.slug),
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: tool.name,
                  item: url,
                },
              ]
            : [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: tool.name,
                  item: url,
                },
              ]),
        ],
      },
      {
        "@type": "HowTo",
        name: `How to ${tool.name.toLowerCase()} online with ToolNest`,
        description: seo.intro.slice(0, 240),
        step: seo.steps.map((step, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: step.name,
          text: step.text,
          url: `${url}#step-${i + 1}`,
        })),
        tool: { "@type": "HowToTool", name: "ToolNest Merge PDF" },
      },
      {
        "@type": "FAQPage",
        mainEntity: seo.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
