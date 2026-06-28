/**
 * Curated list of the top 20 most-searched / most-popular tools on ToolNest.
 *
 * Order matters — index 0 is the #1 most popular, index 19 is #20.
 * The homepage and category pages surface these tools at the top of their
 * listings (popular tools first, in rank order, then the rest by their
 * existing order). A "Popular" badge is also rendered on these cards.
 *
 * Only `live: true` tools are included here so we never float a "coming soon"
 * placeholder to the top of the page.
 */
export const POPULAR_TOOL_SLUGS: string[] = [
  "pdf-compress",      // #1  — Compress PDF (universally #1 on tool sites)
  "image-compress",    // #2  — Compress Image
  "pdf-merge",         // #3  — Merge PDF
  "pdf-split",         // #4  — Split PDF
  "pdf-to-word",       // #5  — PDF to Word
  "word-to-pdf",       // #6  — Word to PDF
  "image-resize",      // #7  — Resize Image
  "image-resize-kb",   // #8  — Resize Image in KB (target size)
  "pdf-resize-kb",     // #9  — Resize PDF in KB (target size)
  "image-convert",     // #10 — Convert Image (JPG / PNG / WebP)
  "image-to-pdf",      // #11 — Image to PDF
  "password-gen",      // #12 — Password Generator
  "qr-generator",      // #13 — QR Code Generator
  "image-crop",        // #14 — Crop Image
  "pdf-rotate",        // #15 — Rotate PDF
  "text-to-speech",    // #16 — Text to Speech
  "pan-card-resizer",  // #17 — PAN Card Resizer (huge in India)
  "pdf-to-excel",      // #18 — PDF to Excel
  "pdf-watermark",     // #19 — Watermark PDF
  "image-rotate",      // #20 — Rotate & Flip Image
];

/** Map slug → popularity rank (0-based). Tools not in the list get null. */
const POPULARITY_RANK: Map<string, number> = new Map(
  POPULAR_TOOL_SLUGS.map((slug, i) => [slug, i]),
);

/**
 * Returns the popularity rank (0 = most popular) for a slug, or `null` if the
 * tool is not in the curated top-20.
 */
export function getPopularityRank(slug: string): number | null {
  return POPULARITY_RANK.has(slug) ? (POPULARITY_RANK.get(slug) as number) : null;
}

/** True if the slug is in the curated top-20 most-popular list. */
export function isPopularTool(slug: string): boolean {
  return POPULARITY_RANK.has(slug);
}
