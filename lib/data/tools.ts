import type { Tool } from "./types";

export const tools: Tool[] = [
  // ── PDF Tools ──────────────────────────────────────────────
  { slug: "pdf-merge", name: "Merge PDF", description: "Enterprise merge studio: batch folder, encrypt unlock, fit A4, dedupe, API, preview.", category: "pdf-tools", live: true },
  { slug: "pdf-split", name: "Split PDF", description: "Enterprise split studio: bookmarks, batch, encrypt unlock, fit A4, metadata, API.", category: "pdf-tools", live: true },
  { slug: "json-formatter", name: "JSON Formatter", description: "Ultra JSON Studio — format, validate, repair, tree view, JSONPath, CSV export.", category: "text-ocr-tools", live: true },
  { slug: "base64-encode", name: "Base64 Encode", description: "Ultra Base64 Studio — text, hex, files, URL-safe, data URI, batch, API.", category: "text-ocr-tools", live: true },
  { slug: "base64-decode", name: "Base64 Decode", description: "Decode Base64, data URIs, and files — hex inspector & batch mode.", category: "text-ocr-tools", live: true },
  { slug: "url-encode", name: "URL Encode", description: "Ultra URL Studio — RFC 3986, query/path/form, batch, inspector, API.", category: "text-ocr-tools", live: true },
  { slug: "url-decode", name: "URL Decode", description: "Decode percent-encoding, form data, and URLs — smart detect & batch.", category: "text-ocr-tools", live: true },
  { slug: "case-converter", name: "Case Converter", description: "Ultra Case Studio — 19 modes, Unicode, DOCX/PDF import, batch, stats, API.", category: "text-ocr-tools", live: true },
  { slug: "reverse-text", name: "Reverse Text", description: "Ultra Reverse Studio — chars, words, lines, upside-down, RTL, palindrome, batch, API.", category: "text-ocr-tools", live: true },
  { slug: "remove-duplicates", name: "Remove Duplicates", description: "Ultra Dedupe Studio — lines, CSV, JSON, fuzzy match, highlight, batch, API.", category: "text-ocr-tools", live: true },
  { slug: "uuid-generator", name: "UUID Generator", description: "Ultra UUID Studio — v1/v3/v4/v5/v6/v7/v8, bulk up to 1M, validate, parse, export, API.", category: "security-tools", live: true },
  { slug: "hash-generator", name: "Hash Generator", description: "Ultra Hash Studio — MD5, SHA-1/2/3, BLAKE2/3, HMAC, Whirlpool, CRC32, file & batch hashing, API.", category: "security-tools", live: true },
  { slug: "pdf-compress", name: "Compress PDF", description: "Ultra compress studio: lossless to high, batch ZIP, compare, API.", category: "pdf-tools", live: true },
  { slug: "pdf-resize-kb", name: "Resize PDF in KB", description: "Resize PDF to an exact target file size in KB / MB — auto-tunes DPI + JPEG quality, before/after compare, 100% in-browser.", category: "pdf-tools", live: true },
  { slug: "pdf-to-word", name: "PDF to Word", description: "Ultra PDF→Word Studio — editable DOCX/DOC/RTF, layout retention, OCR for scanned PDFs, page ranges, batch ZIP, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "word-to-pdf", name: "Word to PDF", description: "Ultra Word→PDF Studio — DOCX/DOC/RTF/ODT/TXT, layout & tables, batch merge, watermark, encryption, PDF/A, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-to-excel", name: "PDF to Excel", description: "Ultra PDF→Excel Studio — XLSX/XLS/CSV/ODS, AI table detection, merged cells, multi-sheet, OCR, batch ZIP, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "excel-to-pdf", name: "Excel to PDF", description: "Ultra Excel→PDF Studio — XLSX/XLS/CSV, sheet pick, fit width, grid, header repeat, batch ZIP, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-to-ppt", name: "PDF to PowerPoint", description: "Ultra PDF→PPT Studio — one slide per page, image fill, DPI, page range, 16:9/4:3, batch ZIP, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "ppt-to-pdf", name: "PowerPoint to PDF", description: "Ultra PPT→PDF Studio — PPTX slide text & images, landscape, batch ZIP, API. (.ppt not supported)", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-to-jpg", name: "PDF to JPG", description: "Ultra PDF→Image Studio — JPG/PNG/WebP export, 72–300 DPI, page ranges, batch ZIP, individual files, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-rotate", name: "Rotate PDF", description: "Ultra PDF Rotate Studio — per-page 90°/180°/270°/custom, auto-orient, reorder, delete, batch ZIP, preview, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-watermark", name: "Watermark PDF", description: "Ultra PDF Watermark Studio — text/logo/QR, templates, tile/diagonal, page ranges, headers/footers, batch ZIP, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-page-numbers", name: "Add Page Numbers", description: "Ultra Page Numbers Studio — 8 formats (1, 1/10, Page N, roman/alpha), 6 positions, scope, batch ZIP, API.", category: "pdf-tools", live: true, badge: "pro" },
  { slug: "pdf-repair", name: "Repair PDF", description: "Ultra PDF Repair Studio — re-save, flatten/copy, rasterize rebuild, issue detection, batch ZIP, preview, API.", category: "pdf-tools", live: true, badge: "pro" },

  // ── Image Tools ────────────────────────────────────────────
  { slug: "image-compress", name: "Compress Image", description: "Ultra Image Compressor Studio — lossless/lossy, AVIF/WebP, batch ZIP, target size, smart AI, OCR-safe, REST API.", category: "image-tools", live: true, badge: "pro" },
  { slug: "image-resize-kb", name: "Resize Image in KB", description: "Resize image to an exact target file size in KB / MB — binary-search quality tuning, JPG/PNG/WebP/AVIF, before/after preview, 100% in-browser.", category: "image-tools", live: true },
  { slug: "image-resize", name: "Resize Image", description: "Ultra Image Resize Studio — px/%, in/cm/mm, DPI, social & print presets, content-aware, batch ZIP, rotate/flip, WebP/AVIF, API.", category: "image-tools", live: true, badge: "pro" },
  { slug: "image-crop", name: "Crop Image", description: "Ultra Image Crop Studio — smart auto-crop, face detect, 16+ aspect ratios, rotate/flip/straighten, perspective, circle crop, batch ZIP, PNG/WebP/AVIF, API.", category: "image-tools", live: true, badge: "pro" },
  { slug: "image-convert", name: "Convert Image", description: "Convert between JPG, PNG, WEBP.", category: "image-tools", live: true },
  { slug: "image-to-pdf", name: "Image to PDF", description: "Combine images into a single PDF.", category: "image-tools", live: true },
  { slug: "bg-remover", name: "Background Remover", description: "Client-side background removal — auto corner detect, color pick, green screen, edge refine, feather, PNG transparency, batch ZIP & REST API — no external AI.", category: "image-tools", live: true, badge: "pro" },
  { slug: "image-rotate", name: "Rotate & Flip Image", description: "Ultra Rotate & Flip Studio — 90°/180°/270°, custom angle, straighten, horizon AI, flip H/V, EXIF auto-orient, perspective correction, batch ZIP, PNG/WebP/AVIF export & REST API — 100% in-browser.", category: "image-tools", live: true },
  { slug: "image-editor", name: "Image Editor", description: "Ultra Image Editor Studio — 12 presets, auto enhance, light/color/detail controls, temperature, clarity, shadows, rotate/flip, zoom, compare, batch ZIP, PNG/JPG/WebP & API.", category: "image-tools", live: true, badge: "pro" },
  { slug: "bulk-compress", name: "Bulk Image Compressor", description: "Batch-first image compressor — folder upload, queue table with per-file savings, presets, target KB, ZIP download, WebP/AVIF, history & REST API — 100% in-browser.", category: "image-tools", live: true, badge: "pro" },
  { slug: "image-watermark", name: "Watermark Image", description: "Ultra Image Watermark Studio — text & logo watermarks, font, color, opacity, rotation, tile mode, drag-to-move preview, batch ZIP, PNG/JPG/WebP & REST API.", category: "image-tools", live: true, badge: "pro" },
  { slug: "svg-to-png", name: "SVG to PNG", description: "Ultra SVG Rasterizer — PNG/JPG/WebP/AVIF/BMP/ICO/TIFF, DPI 72–600, transparent bg, SVG optimization, batch ZIP, Web Worker & REST API — 100% in-browser.", category: "image-tools", live: true, badge: "pro" },
  { slug: "png-to-svg", name: "PNG to SVG", description: "Ultra PNG to SVG Vector Studio — AI mode picker, 10 vector modes, 16 trace presets, layer groups, SVG/EPS/PDF export, Web Worker batch, background removal, before/after compare & REST API.", category: "image-tools", live: true, badge: "pro" },
  { slug: "color-picker", name: "Image Color Picker", description: "Ultra color picker — hex/RGB/HSL, zoom, dominant palette, history & favorites.", category: "image-tools", live: true },
  { slug: "photo-enhancer", name: "Photo Enhancer", description: "AI Photo Enhancer — 2×/4× upscale, denoise, auto tone, portrait/landscape modes, batch ZIP.", category: "image-tools", live: true, badge: "ai" },

  // ── Video Downloader ───────────────────────────────────────
  { slug: "youtube-download", name: "YouTube Downloader", description: "Download YouTube videos in MP4 — quality picker, metadata, server proxy.", category: "video-downloader", live: true },
  { slug: "youtube-mp3", name: "YouTube to MP3", description: "Extract audio from YouTube — M4A/WebM streams via secure proxy.", category: "video-downloader", live: true },
  { slug: "youtube-thumbnail", name: "YouTube Thumbnail", description: "Grab max-res and fallback thumbnails from any YouTube video.", category: "video-downloader", live: true },
  { slug: "instagram-video", name: "Instagram Video", description: "Download Instagram post videos — HD stream resolver.", category: "video-downloader", live: true },
  { slug: "instagram-reel", name: "Instagram Reel", description: "Download Instagram reels in HD.", category: "video-downloader", live: true },
  { slug: "instagram-photo", name: "Instagram Photo", description: "Download full-resolution Instagram photos.", category: "video-downloader", live: true },
  { slug: "facebook-video", name: "Facebook Video", description: "Download Facebook videos.", category: "video-downloader" },
  { slug: "tiktok-download", name: "TikTok Downloader", description: "Download TikTok videos watermark-free.", category: "video-downloader" },
  { slug: "twitter-video", name: "Twitter / X Video", description: "Download videos from Twitter / X.", category: "video-downloader" },
  { slug: "pinterest-video", name: "Pinterest Video", description: "Download Pinterest videos and GIFs.", category: "video-downloader" },
  { slug: "reddit-video", name: "Reddit Video", description: "Download Reddit videos with audio.", category: "video-downloader" },
  { slug: "vimeo-download", name: "Vimeo Downloader", description: "Download Vimeo videos.", category: "video-downloader" },
  { slug: "dailymotion-dl", name: "Dailymotion Downloader", description: "Download Dailymotion videos.", category: "video-downloader" },
  { slug: "linkedin-video", name: "LinkedIn Video", description: "Download LinkedIn videos.", category: "video-downloader" },
  { slug: "twitch-clip", name: "Twitch Clip", description: "Download Twitch clips.", category: "video-downloader" },

  // ── Security Tools ─────────────────────────────────────────
  { slug: "pdf-protect", name: "Protect PDF", description: "Add a password to a PDF.", category: "security-tools" },
  { slug: "pdf-unlock", name: "Unlock PDF", description: "Remove a password from a PDF.", category: "security-tools" },
  { slug: "img-metadata", name: "Remove Image EXIF", description: "Strip metadata from images.", category: "security-tools", live: true },
  { slug: "pdf-metadata", name: "Remove PDF Metadata", description: "Strip metadata from a PDF.", category: "security-tools", live: true },
  { slug: "checksum-gen", name: "Checksum Generator", description: "Generate MD5 / SHA file checksums.", category: "security-tools", live: true },
  { slug: "password-gen", name: "Password Generator", description: "Ultra Password Generator Studio — secure RNG, Diceware passphrases, pronounceable, PIN, Wi-Fi QR, bulk, breach check, entropy, XLSX/CSV/JSON/PDF export, API.", category: "security-tools", live: true, badge: "pro" },
  { slug: "qr-generator", name: "QR Code Generator", description: "Ultra QR Studio — 30+ types (URL, Wi-Fi, vCard, crypto, social), logos, gradients, bulk CSV/ZIP, PNG/SVG/PDF, scan test, API.", category: "security-tools", live: true, badge: "pro" },
  { slug: "qr-scanner", name: "QR Code Scanner", description: "Read QR codes from an image.", category: "security-tools" },
  { slug: "barcode-gen", name: "Barcode Generator", description: "Generate barcodes in many formats.", category: "security-tools" },

  // ── Compress & Optimize ────────────────────────────────────
  { slug: "bulk-pdf-compress", name: "Bulk PDF Compressor", description: "Compress many PDFs at once.", category: "compress-tools" },
  { slug: "video-compress", name: "Video Compressor", description: "Shrink video files with FFmpeg.", category: "compress-tools" },
  { slug: "gif-compress", name: "GIF Compressor", description: "Optimize and compress GIFs.", category: "compress-tools" },
  { slug: "zip-creator", name: "ZIP Creator", description: "Create a ZIP archive from files.", category: "compress-tools" },
  { slug: "zip-extractor", name: "ZIP Extractor", description: "Extract ZIP, RAR and 7Z archives.", category: "compress-tools" },
  { slug: "file-optimizer", name: "File Optimizer", description: "Universal file size optimizer.", category: "compress-tools" },

  // ── Text & OCR ─────────────────────────────────────────────
  { slug: "image-to-text", name: "Image to Text (OCR)", description: "Extract text from images in 100+ languages.", category: "text-ocr-tools" },
  { slug: "pdf-to-text", name: "PDF to Text", description: "Extract text content from PDFs.", category: "text-ocr-tools" },
  { slug: "scanned-pdf", name: "Searchable PDF", description: "Turn scanned PDFs into searchable text.", category: "text-ocr-tools" },
  { slug: "handwriting-ocr", name: "Handwriting OCR", description: "Convert handwriting to text with AI.", category: "text-ocr-tools", badge: "ai" },
  { slug: "text-to-pdf", name: "Text to PDF", description: "Convert plain text into a PDF.", category: "text-ocr-tools", live: true },
  { slug: "text-to-speech", name: "Text to Speech", description: "Ultra TTS Studio — 300+ neural voices, SSML, MP3 export, chapters, subtitles, API.", category: "text-ocr-tools", live: true },
  { slug: "speech-to-text", name: "Speech to Text", description: "Transcribe audio to text.", category: "text-ocr-tools" },
  { slug: "word-counter", name: "Word Counter", description: "Count words, characters and reading time.", category: "text-ocr-tools", live: true },
  { slug: "text-diff", name: "Text Diff Checker", description: "Compare two texts and see differences.", category: "text-ocr-tools", live: true },

  // ── Design Tools ───────────────────────────────────────────
  { slug: "color-palette", name: "Color Palette Generator", description: "Generate beautiful color palettes.", category: "design-tools", live: true },
  { slug: "gradient-gen", name: "Gradient Generator", description: "Create and copy CSS gradients.", category: "design-tools", live: true },
  { slug: "font-pairing", name: "Font Pairing", description: "AI font pairing suggestions.", category: "design-tools" },
  { slug: "logo-maker", name: "Logo Maker", description: "Create a simple logo with AI.", category: "design-tools", badge: "ai" },
  { slug: "banner-maker", name: "Banner Maker", description: "Design banners and ads.", category: "design-tools" },
  { slug: "social-post-maker", name: "Social Post Maker", description: "Create social media posts.", category: "design-tools" },
  { slug: "business-card", name: "Business Card Maker", description: "Design a printable business card.", category: "design-tools" },
  { slug: "resume-maker", name: "Resume Maker", description: "Build a professional resume PDF.", category: "design-tools" },
  { slug: "favicon-gen", name: "Favicon Generator", description: "Generate favicons in all sizes.", category: "design-tools", live: true },

  // ── Office Tools ───────────────────────────────────────────
  { slug: "csv-to-excel", name: "CSV to Excel", description: "Convert CSV files to Excel.", category: "office-tools" },
  { slug: "excel-to-csv", name: "Excel to CSV", description: "Convert Excel files to CSV.", category: "office-tools" },
  { slug: "markdown-to-pdf", name: "Markdown to PDF", description: "Convert Markdown to a styled PDF.", category: "office-tools" },
  { slug: "html-to-pdf", name: "HTML to PDF", description: "Convert HTML pages to PDF.", category: "office-tools" },
  { slug: "txt-to-pdf", name: "TXT to PDF", description: "Convert text files to PDF.", category: "office-tools", live: true },

  // ── Merge & Split ──────────────────────────────────────────
  { slug: "image-merger", name: "Image Merger", description: "Stitch images vertically or horizontally.", category: "merge-split", live: true },
  { slug: "video-merger", name: "Video Merger", description: "Join multiple videos together.", category: "merge-split" },
  { slug: "audio-merger", name: "Audio Merger", description: "Join multiple audio files.", category: "merge-split" },

  // ── Social Media ───────────────────────────────────────────
  { slug: "story-maker", name: "Story Maker", description: "Create Instagram stories.", category: "social-tools" },
  { slug: "twitter-header", name: "Twitter Header", description: "Design a Twitter / X header.", category: "social-tools" },
  { slug: "fb-cover", name: "Facebook Cover", description: "Design a Facebook cover photo.", category: "social-tools" },
  { slug: "linkedin-banner", name: "LinkedIn Banner", description: "Design a LinkedIn banner.", category: "social-tools" },
  { slug: "social-resizer", name: "Social Image Resizer", description: "Resize images for every platform.", category: "social-tools", live: true },
  { slug: "hashtag-gen", name: "Hashtag Generator", description: "Generate relevant hashtags with AI.", category: "social-tools", badge: "ai" },

  // ── Government Services ─────────────────────────────────────
  { slug: "pan-card-resizer", name: "PAN Card Resizer", description: "Resize photo, signature & document for NSDL / UTIITSL PAN card applications — exact cm/px dimensions, target KB with high quality, crop + 3-step wizard, 100% in-browser.", category: "government-services", live: true },
  { slug: "passport-photo-resizer", name: "Passport Photo Resizer", description: "Resize photo for Indian, US, UK, Schengen, China passport & visa applications — exact 35×45mm / 2×2 inch dimensions, target KB, drag-to-crop, 100% in-browser.", category: "government-services", live: true },
  { slug: "visa-photo-resizer", name: "Visa Photo Resizer", description: "Resize photo for US, Schengen, UK, China, Australia visa applications — official mm dimensions, target KB with high quality, drag-to-crop, 100% in-browser.", category: "government-services", live: true },
  { slug: "exam-photo-resizer", name: "Exam Photo & Signature Resizer", description: "Resize photo & signature for UPSC, SSC, NEET, banking, railway & other exam applications — 3.5×4.5cm photo + 3.5×1.5cm signature, target KB, 100% in-browser.", category: "government-services", live: true },
  { slug: "aadhaar-pdf-resizer", name: "Aadhaar PDF Resizer", description: "Compress Aadhaar PDF to under 100/200/300/500 KB for online form uploads — high-quality-first DPI/quality ladder, password-protected PDF support, 100% in-browser.", category: "government-services", live: true },
  { slug: "resume-photo-resizer", name: "Resume Photo Resizer", description: "Resize photo for resume, CV, LinkedIn & job applications — passport 35×45mm / 2×2 inch, target KB with high quality, drag-to-crop, 100% in-browser.", category: "government-services", live: true },
  { slug: "voter-id-photo-resizer", name: "Voter ID Photo Resizer", description: "Resize photo & signature for Voter ID (EPIC), Form 6/7/8 & Overseas Elector applications — Election Commission specs, target KB, drag-to-crop, 100% in-browser.", category: "government-services", live: true },
  { slug: "driving-licence-photo-resizer", name: "Driving Licence Photo Resizer", description: "Resize photo & signature for Learner / Permanent driving licence (LL/DL), Sarathi Parivanan & RTO applications — official cm dimensions, target KB, drag-to-crop, 100% in-browser.", category: "government-services", live: true },
  { slug: "income-tax-photo-resizer", name: "ITR Photo & Document Resizer", description: "Resize photo, signature & documents for the Income Tax Return (ITR) portal — profile photo, signature, and PDF document compression under 1/2/5 MB, target KB, drag-to-crop, 100% in-browser.", category: "government-services", live: true },

  // ── AI Tools ───────────────────────────────────────────────
  { slug: "ai-pdf-summary", name: "AI PDF Summarizer", description: "Summarize long PDFs instantly.", category: "ai-tools", badge: "ai" },
  { slug: "ai-img-describe", name: "AI Image Describer", description: "Describe what is in an image.", category: "ai-tools", badge: "ai" },
  { slug: "ai-rewriter", name: "AI Text Rewriter", description: "Rewrite and paraphrase text.", category: "ai-tools", badge: "ai" },
  { slug: "ai-grammar", name: "AI Grammar Checker", description: "Fix grammar and spelling.", category: "ai-tools", badge: "ai" },
  { slug: "ai-translate", name: "AI Translator", description: "Translate documents with AI.", category: "ai-tools", badge: "ai" },
  { slug: "ai-resume", name: "AI Resume Reviewer", description: "Score and improve your resume.", category: "ai-tools", badge: "ai" },
  { slug: "ai-content", name: "AI Content Generator", description: "Generate articles and copy.", category: "ai-tools", badge: "ai" },
  { slug: "ai-chatbot", name: "AI Assistant", description: "Chat with an AI assistant.", category: "ai-tools", badge: "ai" },
];

export const toolMap: Record<string, Tool> = Object.fromEntries(
  tools.map((t) => [t.slug, t]),
);

export function getTool(slug: string): Tool | undefined {
  return toolMap[slug];
}

export function getToolsByCategory(category: string): Tool[] {
  return tools.filter((t) => t.category === category);
}

export function getLiveTools(): Tool[] {
  return tools.filter((t) => t.live);
}

export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q),
  );
}
