import type { Metadata } from "next";
import { tools } from "@/lib/data/tools";
import { categories } from "@/lib/data/categories";

export const metadata: Metadata = {
  title: "About",
  description: "About ToolNest — the all-in-one online tools platform.",
};

export default function AboutPage() {
  const stats = [
    { value: `${tools.length}`, label: "Tools" },
    { value: `${categories.length}`, label: "Categories" },
    { value: "100%", label: "Free to start" },
    { value: "0", label: "Installs needed" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold">
        About <span className="text-gradient">ToolNest</span>
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">
        ToolNest is the world&apos;s most powerful all-in-one online tools
        platform. We bring together {tools.length} carefully crafted tools for
        PDF, images, video, OCR, security, design and AI — all in one place,
        with no installs and no friction.
      </p>
      <p className="mt-4 leading-relaxed text-muted">
        Our mission is simple: every tool you need, one place. Whether you want
        to merge a PDF, compress an image, generate a QR code or summarize a
        document with AI, ToolNest gets it done fast, privately and for free.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5 text-center"
          >
            <div className="font-display text-3xl font-bold text-primary">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
