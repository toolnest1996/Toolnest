/** Client-side implemented tool slugs (server-safe list) */
export const implementedToolSlugs = new Set([
  "pdf-merge", "pdf-split", "pdf-compress", "pdf-rotate", "pdf-watermark", "pdf-page-numbers",
  "pdf-metadata", "image-to-pdf",
  "pdf-resize-kb",
  "word-counter", "text-diff", "text-to-speech", "text-to-pdf", "txt-to-pdf",
  "json-formatter", "base64-encode", "base64-decode",
  "url-encode", "url-decode", "case-converter",
  "reverse-text", "remove-duplicates", "uuid-generator",
  "hash-generator",
  "password-gen", "qr-generator", "checksum-gen",
  "color-palette", "gradient-gen", "favicon-gen",
  "image-compress", "image-resize", "image-crop", "image-convert", "image-rotate",
  "image-editor", "image-watermark", "svg-to-png",
  "image-resize-kb",
  "pan-card-resizer",
  "passport-photo-resizer",
  "visa-photo-resizer",
  "exam-photo-resizer",
  "aadhaar-pdf-resizer",
  "resume-photo-resizer",
  "voter-id-photo-resizer",
  "driving-licence-photo-resizer",
  "income-tax-photo-resizer",
  "social-resizer", "color-picker", "image-merger", "img-metadata",
  "youtube-thumbnail",
  "pdf-to-word",
  "pdf-to-excel",
  "word-to-pdf",
]);

export function isToolImplemented(slug: string): boolean {
  return implementedToolSlugs.has(slug);
}
