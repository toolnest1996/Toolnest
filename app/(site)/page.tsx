import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { getPublicTools } from "@/lib/tools/config";
import { Explorer } from "@/components/home/explorer";

export default async function HomePage() {
  const [settings, publicTools] = await Promise.all([
    getSiteSettings(),
    getPublicTools(),
  ]);
  const heroTitle = settings.hero_title || "Every Tool You Need, One Place.";
  const heroSubtitle =
    settings.hero_subtitle ||
    `${publicTools.length} tools for PDF, images, video, OCR and AI — free, fast, no signup.`;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[250px] w-[500px] -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />
          <div className="absolute right-1/4 top-20 h-[200px] w-[300px] rounded-full bg-secondary/10 blur-[100px]" />
        </div>

        <div className="px-4 py-6 text-center sm:px-6 lg:px-8 lg:py-8">
          <h1 className="mx-auto max-w-3xl font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl animate-fade-up">
            {heroTitle.includes("One Place") ? (
              <>Every Tool You Need, <span className="text-gradient">One Place.</span></>
            ) : heroTitle}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted animate-fade-up">{heroSubtitle}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 animate-fade-up">
            <Link href="#tools" className="inline-flex h-9 items-center gap-2 rounded-lg gradient-primary px-4 text-sm font-medium text-white shadow-md shadow-primary/20 transition-transform hover:scale-105">
              Browse tools <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/pricing" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-card-hover">
              Pricing
            </Link>
          </div>
        </div>
      </section>
      <Explorer />
    </>
  );
}
