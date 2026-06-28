import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTool, tools } from "@/lib/data/tools";
import { isToolImplemented } from "@/lib/data/implementations";
import { getCategory } from "@/lib/data/categories";
import { isPublicToolEnabled } from "@/lib/tools/config";
import { buildToolMetadata } from "@/lib/seo/build-tool-metadata";
import { buildToolJsonLd } from "@/lib/seo/tool-json-ld";
import { getToolSeoConfig } from "@/lib/seo/tool-seo-data";
import { Icon } from "@/components/icon";
import { ToolPageAds } from "@/components/ads/tool-page-ads";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found", robots: { index: false, follow: false } };
  if (!(await isPublicToolEnabled(slug))) {
    return { title: "Tool not found", robots: { index: false, follow: false } };
  }
  return buildToolMetadata(tool);
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const enabled = await isPublicToolEnabled(slug);
  if (!enabled && !(tool.live && isToolImplemented(slug))) notFound();

  const category = getCategory(tool.category);
  const seo = getToolSeoConfig(slug);
  const jsonLd = buildToolJsonLd(slug);

  const heading = seo?.h1 ?? tool.name;
  const subtitle = seo?.tagline ?? tool.description;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-none w-full">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden />
          {category && (
            <>
              <Link href={`/category/${category.slug}`} className="hover:text-foreground">
                {category.name}
              </Link>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </>
          )}
          <span className="text-foreground">{tool.name}</span>
        </nav>

        <header className="mt-6 flex items-start gap-4">
          {category && (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${category.color}1f`, color: category.color }}
              aria-hidden
            >
              <Icon name={category.icon} className="h-7 w-7" />
            </span>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{heading}</h1>
            <p className="mt-1 max-w-3xl text-muted">{subtitle}</p>
          </div>
        </header>

        <ToolPageAds slug={slug} toolName={tool.name} live={!!tool.live && isToolImplemented(slug)} />
      </div>
    </>
  );
}
