import type { Category } from "./types";

export const categories: Category[] = [
  {
    slug: "pdf-tools",
    name: "PDF Tools",
    icon: "FileText",
    color: "#E8231A",
    description: "Merge, split, compress, convert and edit PDF files.",
  },
  {
    slug: "image-tools",
    name: "Image Tools",
    icon: "Image",
    color: "#FF6B35",
    description: "Compress, resize, convert and enhance images.",
  },
  {
    slug: "video-downloader",
    name: "Video Downloader",
    icon: "Video",
    color: "#FF0000",
    description: "Download video and audio from popular platforms.",
  },
  {
    slug: "security-tools",
    name: "Security Tools",
    icon: "Lock",
    color: "#7B2FF7",
    description: "Protect files, generate passwords, QR codes and more.",
  },
  {
    slug: "compress-tools",
    name: "Compress & Optimize",
    icon: "Package",
    color: "#00B4D8",
    description: "Shrink PDFs, images, video and create archives.",
  },
  {
    slug: "text-ocr-tools",
    name: "Text & OCR",
    icon: "FileType",
    color: "#06D6A0",
    description: "Extract text, OCR, count words and translate.",
  },
  {
    slug: "design-tools",
    name: "Design Tools",
    icon: "Palette",
    color: "#F72585",
    description: "Palettes, gradients, logos, resumes and banners.",
  },
  {
    slug: "office-tools",
    name: "Office Tools",
    icon: "FileSpreadsheet",
    color: "#FB8500",
    description: "Convert documents between Office and PDF formats.",
  },
  {
    slug: "merge-split",
    name: "Merge & Split",
    icon: "Combine",
    color: "#4CC9F0",
    description: "Combine or split PDFs, images, audio and video.",
  },
  {
    slug: "social-tools",
    name: "Social Media",
    icon: "Share2",
    color: "#FF006E",
    description: "Create covers, banners and resize for social.",
  },
  {
    slug: "government-services",
    name: "Government Services",
    icon: "Landmark",
    color: "#1E6FBA",
    description: "Resize photos, signatures & documents for PAN, Aadhaar, passport, visa, exam & other government applications.",
  },
  {
    slug: "ai-tools",
    name: "AI Tools",
    icon: "Bot",
    color: "#7B2FF7",
    description: "AI summarize, rewrite, translate, enhance and chat.",
  },
];

export const categoryMap: Record<string, Category> = Object.fromEntries(
  categories.map((c) => [c.slug, c]),
);

export function getCategory(slug: string): Category | undefined {
  return categoryMap[slug];
}
