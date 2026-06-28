import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCategory } from "@/lib/data/categories";
import { getPublicCategories, isPublicCategoryEnabled } from "@/lib/categories/config";
import { getPublicToolsByCategory } from "@/lib/tools/config";
import { ToolGrid } from "@/components/tool-grid";
import { Icon } from "@/components/icon";
import { SiteFooterLeaderboard } from "@/components/ads/site-chrome";

export async function generateStaticParams() {
  const publicCategories = await getPublicCategories();
  return publicCategories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category || !(await isPublicCategoryEnabled(slug))) return { title: "Category not found" };
  return {
    title: category.name,
    description: category.description,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category || !(await isPublicCategoryEnabled(slug))) notFound();

  const tools = await getPublicToolsByCategory(slug);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-1 text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <div className="mt-6 flex items-center gap-4">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${category.color}1f`, color: category.color }}
        >
          <Icon name={category.icon} className="h-8 w-8" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">{category.name}</h1>
          <p className="mt-1 text-muted">{category.description}</p>
        </div>
      </div>

      <div className="mt-10">
        <ToolGrid tools={tools} inlineAdsEvery={10} />
      </div>

      <SiteFooterLeaderboard />
    </div>
  );
}
