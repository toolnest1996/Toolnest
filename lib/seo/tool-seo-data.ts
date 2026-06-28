export interface ToolSeoConfig {
  /** Browser tab / SERP title (site name appended via layout template). */
  title: string;
  metaDescription: string;
  keywords: string[];
  /** Optional H1 override; defaults to tool name. */
  h1?: string;
  /** Short line under H1 on the page. */
  tagline?: string;
  /** Lead paragraph for the SEO content block. */
  intro: string;
  features: { title: string; description: string }[];
  steps: { name: string; text: string }[];
  faqs: { question: string; answer: string }[];
  /** Related tool slugs for internal linking. */
  relatedSlugs: string[];
  /** Optional SEO section H2 override. */
  whyHeading?: string;
  /** Optional how-to section H3 override. */
  howToHeading?: string;
}

const TOOL_SEO: Record<string, ToolSeoConfig> = {
  "pdf-merge": {
    title: "Merge PDF Online Free — Combine & Join PDF Files",
    metaDescription:
      "Merge PDF files online for free. Combine multiple PDFs, reorder pages, rotate, interleave, watermark, password-protect & preview before download. Private — files stay in your browser.",
    keywords: [
      "merge pdf",
      "merge pdf online",
      "merge pdf online free",
      "combine pdf",
      "combine pdf files",
      "join pdf",
      "pdf merger",
      "pdf combiner",
      "merge multiple pdfs",
      "combine pdf online free",
      "merge pdf files online",
      "pdf joiner",
      "reorder pdf pages",
      "merge pdf no signup",
      "merge pdf in browser",
      "free pdf merger",
      "concatenate pdf",
      "append pdf",
      "merge pdf with password",
      "pdf merge tool",
    ],
    h1: "Merge PDF Online — Free PDF Merger & Combiner",
    tagline:
      "Combine unlimited PDF files in your browser. Reorder pages, interleave documents, add cover pages, watermarks, and download instantly — no account required.",
    intro:
      "ToolNest Merge PDF is a professional-grade online PDF merger that runs entirely in your browser. Upload two or more PDF documents, drag to reorder files or individual pages, pick exact page ranges (for example 1–3, 5, 8–10), and export one polished PDF in seconds. Unlike basic combiners, our Ultra Merge Studio includes live preview, smart presets such as interleaving pages across files, per-page rotation, blank pages, optional password protection, and diagonal watermarks — all without uploading your files to a server.",
    features: [
      {
        title: "100% private & secure",
        description:
          "Your PDFs are processed locally in your browser using WebAssembly. Nothing is uploaded to ToolNest servers, making this ideal for contracts, invoices, and confidential documents.",
      },
      {
        title: "Drag-and-drop page studio",
        description:
          "Reorder entire documents or fine-tune every page with thumbnail previews. Include, exclude, duplicate, or rotate any page before merging.",
      },
      {
        title: "Smart merge presets",
        description:
          "Append in file order, interleave pages across PDFs, reverse document or page order, and sync your queue with one click.",
      },
      {
        title: "Page range selection",
        description:
          "Merge only the pages you need from each file using simple range syntax like 1-5, 7, 12-15 — perfect for reports and scanned batches.",
      },
      {
        title: "Cover image & blank pages",
        description:
          "Add a PNG or JPG cover at the start or insert blank A4 separator pages anywhere in the final document.",
      },
      {
        title: "Live preview before download",
        description:
          "Render the merged PDF in-browser and review every page before saving — no surprises after download.",
      },
      {
        title: "Password & watermark",
        description:
          "Optionally encrypt the output PDF with a password and stamp a custom watermark across all pages.",
      },
      {
        title: "Enterprise REST API",
        description:
          "Automate merges via POST /api/v1/pdf/merge — send base64 PDFs, optional page map, receive merged output for CI/CD pipelines.",
      },
      {
        title: "Duplicate detection & dedupe",
        description:
          "SHA-256 fingerprinting flags identical uploads; one-click removal of duplicate pages from the merge queue.",
      },
      {
        title: "Password-protected PDF input",
        description:
          "Unlock encrypted source PDFs with a password prompt — decrypted in-browser, never stored on servers.",
      },
      {
        title: "Fit to A4 normalization",
        description:
          "Scale and center pages of different sizes onto uniform A4 sheets — ideal for mixed scan batches.",
      },
    ],
    steps: [
      {
        name: "Upload your PDF files",
        text: "Drag and drop one or more PDF documents onto the merge area, or click to browse. You can add files at any time.",
      },
      {
        name: "Arrange pages and settings",
        text: "Use Documents to reorder files and set page ranges. Open Page Studio to drag pages, rotate, skip pages, or apply a merge preset such as Interleave.",
      },
      {
        name: "Preview and download",
        text: "Click Live Preview to check the result, then Download Ultra PDF. Your merged file saves instantly to your device.",
      },
    ],
    faqs: [
      {
        question: "Is this PDF merger really free?",
        answer:
          "Yes. ToolNest Merge PDF is free to use with no signup required. Core merge, reorder, rotate, preview, and download features are available at no cost on the Free plan.",
      },
      {
        question: "Are my PDF files uploaded to your servers?",
        answer:
          "No. Merging happens entirely inside your web browser. Your files never leave your device, which keeps sensitive documents private.",
      },
      {
        question: "How many PDFs can I merge at once?",
        answer:
          "You can add multiple PDF files and include as many pages as your browser memory allows. Very large files may depend on your device RAM.",
      },
      {
        question: "Can I merge only specific pages from each PDF?",
        answer:
          "Yes. In the Documents tab, enter a page range per file (for example 1-3, 5, 8) and click Apply range to update the merge queue.",
      },
      {
        question: "Can I combine PDFs in alternating (interleaved) order?",
        answer:
          "Yes. Use the Interleave smart preset to merge page 1 from each file, then page 2 from each file, and so on — useful for scanned duplex batches.",
      },
      {
        question: "Does merged PDF work on mobile?",
        answer:
          "Yes. The tool works on modern mobile browsers, though large files are easier to manage on desktop.",
      },
      {
        question: "Can I password-protect the merged PDF?",
        answer:
          "Yes. Open Output & security settings, set a password, and the downloaded PDF will be encrypted with that password.",
      },
      {
        question: "What is the difference between Merge PDF and Split PDF?",
        answer:
          "Merge PDF combines multiple files into one document. Split PDF separates one file into individual page files. Both tools are available free on ToolNest.",
      },
    ],
    relatedSlugs: ["pdf-split", "pdf-rotate", "pdf-watermark", "pdf-page-numbers", "image-to-pdf", "pdf-compress"],
    whyHeading: "Why merge PDFs with ToolNest?",
    howToHeading: "How to merge PDF files online",
  },
  "pdf-split": {
    title: "Split PDF Online Free — Extract & Separate PDF Pages",
    metaDescription:
      "Split PDF online for free. Extract pages, split every page to ZIP, divide by ranges or every N pages. Page studio with thumbnails, rotate, preview, password & watermark. 100% in-browser.",
    keywords: [
      "split pdf",
      "split pdf online",
      "split pdf online free",
      "extract pdf pages",
      "separate pdf pages",
      "pdf splitter",
      "divide pdf",
      "split pdf into pages",
      "extract pages from pdf",
      "pdf page extractor",
      "split pdf by range",
      "split pdf every page",
      "pdf split zip",
      "split pdf no signup",
      "split pdf in browser",
      "free pdf splitter",
      "cut pdf pages",
      "remove pages from pdf",
      "pdf split tool",
      "split large pdf",
    ],
    h1: "Split PDF Online — Free PDF Splitter & Page Extractor",
    tagline:
      "Separate one PDF into multiple files in your browser. Pick pages visually, split by range or chunk size, preview output, and download as single PDF or ZIP — no account required.",
    intro:
      "ToolNest Split PDF is a professional-grade online PDF splitter that runs entirely in your browser. Upload a document, use the Page Studio to include or exclude pages with thumbnail previews, rotate individual pages, and choose how to split: one file per page (ZIP download), extract selected pages into a single PDF, split by custom ranges like 1–3; 4–8; 9–12, or chunk every N pages. Unlike basic splitters, our Ultra Split Studio includes live preview, selection presets for odd/even pages, optional password protection, watermarks, page numbers, and progress tracking — all without uploading your files to a server.",
    features: [
      {
        title: "100% private & secure",
        description:
          "Your PDF is processed locally in your browser. Nothing is uploaded to ToolNest servers, keeping contracts and personal documents confidential.",
      },
      {
        title: "Visual page studio",
        description:
          "Browse every page with thumbnails. Include, exclude, drag to reorder, rotate, and search pages before splitting.",
      },
      {
        title: "Multiple split modes",
        description:
          "Split every selected page into its own PDF (ZIP), extract one combined PDF, divide by semicolon-separated ranges, or chunk every N pages.",
      },
      {
        title: "Selection presets",
        description:
          "Quickly select all, odd, even, first half, second half, or invert your current selection with one click.",
      },
      {
        title: "Live preview before download",
        description:
          "Render the first output PDF in-browser and review pages before saving — no surprises after download.",
      },
      {
        title: "ZIP bulk download",
        description:
          "When splitting into many files, download them all at once as a compressed ZIP archive.",
      },
      {
        title: "Password & watermark",
        description:
          "Optionally encrypt output PDFs with a password and stamp a custom diagonal watermark on every page.",
      },
      {
        title: "Split by PDF bookmarks",
        description:
          "Use top-level PDF outline entries as automatic section breaks — ideal for chapters, reports, and structured documents.",
      },
      {
        title: "Batch split multiple PDFs",
        description:
          "Queue many PDFs and split them all with the same mode and settings — download one combined ZIP.",
      },
      {
        title: "Password-protected PDF input",
        description:
          "Unlock encrypted PDFs in-browser with a password prompt before splitting — passwords are never stored.",
      },
      {
        title: "Metadata preservation",
        description:
          "Optionally carry over title, author, subject, and keywords from the source PDF into each output file.",
      },
      {
        title: "Enterprise REST API",
        description:
          "POST /api/v1/pdf/split for server-side automation — base64 in, split PDFs or ZIP out.",
      },
    ],
    steps: [
      {
        name: "Upload your PDF",
        text: "Drag and drop a PDF onto the upload area, or click to browse. Thumbnails load automatically for every page.",
      },
      {
        name: "Select pages and split plan",
        text: "Use Page Studio to include or exclude pages. Open Split Plan to choose every-page, extract, by-ranges, or every-N mode and apply selection presets.",
      },
      {
        name: "Preview and download",
        text: "Click Preview to check the result, then Split & Download. Multiple files save as a ZIP; a single extract saves as one PDF.",
      },
    ],
    faqs: [
      {
        question: "Is this PDF splitter really free?",
        answer:
          "Yes. ToolNest Split PDF is free to use with no signup required. Core split, extract, preview, and download features are available at no cost on the Free plan.",
      },
      {
        question: "Are my PDF files uploaded to your servers?",
        answer:
          "No. Splitting happens entirely inside your web browser. Your file never leaves your device.",
      },
      {
        question: "How do I split a PDF into separate pages?",
        answer:
          "Choose the Every page mode, select the pages you want, and click Split & Download. Each page becomes its own PDF file, bundled in a ZIP if there are multiple outputs.",
      },
      {
        question: "Can I extract only specific pages into one PDF?",
        answer:
          "Yes. Select the pages you need in Page Studio, choose Extract selection mode, and download a single PDF containing only those pages.",
      },
      {
        question: "How do range splits work?",
        answer:
          "In By ranges mode, enter groups separated by semicolons, for example 1-3; 4-8; 9-12. Each group becomes a separate PDF file.",
      },
      {
        question: "Can I split every N pages?",
        answer:
          "Yes. Use Every N pages mode and set N (for example 5) to divide the selected pages into equal chunks, each saved as its own PDF.",
      },
      {
        question: "Does split PDF work on mobile?",
        answer:
          "Yes. The tool works on modern mobile browsers, though large files are easier to manage on desktop.",
      },
      {
        question: "What is the difference between Split PDF and Merge PDF?",
        answer:
          "Split PDF separates one file into multiple documents or extracts selected pages. Merge PDF combines multiple files into one. Both tools are available free on ToolNest.",
      },
    ],
    relatedSlugs: ["pdf-merge", "pdf-rotate", "pdf-watermark", "pdf-page-numbers", "pdf-compress", "image-to-pdf"],
    whyHeading: "Why split PDFs with ToolNest?",
    howToHeading: "How to split PDF files online",
  },
  "pdf-rotate": {
    title: "Rotate PDF Online Free — Turn & Flip PDF Pages",
    metaDescription:
      "Rotate PDF online for free. Per-page 90°, 180°, 270° or custom angles, auto-orient, reorder, delete pages, batch ZIP, password unlock, preview before download. 100% in-browser.",
    keywords: [
      "rotate pdf",
      "rotate pdf online",
      "rotate pdf online free",
      "turn pdf pages",
      "flip pdf",
      "pdf rotator",
      "rotate pdf 90 degrees",
      "rotate pdf pages",
      "rotate single pdf page",
      "pdf page rotation",
      "rotate pdf clockwise",
      "rotate pdf counterclockwise",
      "fix pdf orientation",
      "auto rotate pdf",
      "batch rotate pdf",
      "rotate pdf no signup",
      "rotate pdf in browser",
      "free pdf rotator",
      "pdf rotate tool",
      "rotate landscape pdf",
    ],
    h1: "Rotate PDF Online — Free PDF Page Rotator",
    tagline:
      "Rotate, reorder, or delete PDF pages in your browser. Visual thumbnails, auto-orientation, preview before save, batch ZIP — no account required.",
    intro:
      "ToolNest Rotate PDF is an enterprise-grade Ultra PDF Rotate Studio that runs entirely in your browser. Upload a PDF, rotate individual pages or apply bulk rotation to a page range, use auto-orientation to fix sideways scans, drag to reorder, exclude pages, preview the result, and download — or batch-rotate many PDFs into one ZIP. Password-protected PDFs can be unlocked in-browser. When only rotation changes (no reorder/delete), lossless in-place processing preserves bookmarks and hyperlinks. Digital signature awareness warns before invalidating signed documents. REST API available for automation.",
    features: [
      {
        title: "100% private & secure",
        description:
          "PDF rotation runs locally in your browser. Files are not uploaded unless you use the optional REST API.",
      },
      {
        title: "Visual page studio",
        description:
          "Thumbnail grid for every page. Rotate clockwise/counterclockwise, delete, drag to reorder, and filter pages.",
      },
      {
        title: "Flexible rotation",
        description:
          "90°, 180°, 270°, or any custom angle per page or page range. Rotate all pages with one click.",
      },
      {
        title: "Auto-orientation detection",
        description:
          "Smart heuristics detect landscape pages and embedded /Rotate values — normalize with one click.",
      },
      {
        title: "AI rotation recommendations",
        description:
          "Context-aware tips for mixed-orientation documents, embedded rotation, and batch landscape fixes.",
      },
      {
        title: "Lossless in-place rotation",
        description:
          "When page order is unchanged, rotation applies in-place — bookmarks and hyperlinks stay intact.",
      },
      {
        title: "Preview before download",
        description:
          "Render the rotated PDF in-browser and compare before/after side-by-side before saving.",
      },
      {
        title: "Batch rotate & ZIP export",
        description:
          "Queue multiple PDFs, apply a global rotation angle, and download all results as a ZIP archive.",
      },
      {
        title: "Password-protected PDFs",
        description:
          "Unlock encrypted PDFs with a password prompt — passwords are never stored or transmitted.",
      },
      {
        title: "Digital signature awareness",
        description:
          "Detects signed PDFs and warns that rotation may invalidate digital signatures.",
      },
      {
        title: "Metadata & PDF/A mode",
        description:
          "Preserve title, author, subject, and keywords. Optional PDF/A metadata and output encryption.",
      },
      {
        title: "Enterprise REST API",
        description:
          "POST /api/v1/pdf/rotate for server-side automation — base64 in, rotated PDF out.",
      },
    ],
    steps: [
      {
        name: "Upload your PDF",
        text: "Drag and drop, browse, paste from clipboard, or upload a folder. Thumbnails load for every page.",
      },
      {
        name: "Rotate and arrange pages",
        text: "Click rotate on individual pages or use page ranges for bulk rotation. Auto-orient fixes sideways scans. Drag to reorder or exclude pages.",
      },
      {
        name: "Preview and download",
        text: "Preview the rotated PDF, compare before/after, then download. Batch mode exports multiple PDFs as ZIP.",
      },
    ],
    faqs: [
      {
        question: "Is this PDF rotator really free?",
        answer:
          "Yes. ToolNest Rotate PDF is free with no signup. Core rotate, preview, reorder, and download features are available at no cost.",
      },
      {
        question: "Are my PDF files uploaded to your servers?",
        answer:
          "No. The browser studio processes PDFs entirely on your device. Only the optional API sends base64 to your server endpoint.",
      },
      {
        question: "Can I rotate only some pages?",
        answer:
          "Yes. Use the page studio to rotate individual pages, or enter a page range like 1-3, 5, 8-10 for bulk rotation.",
      },
      {
        question: "Will rotation break digital signatures?",
        answer:
          "Rotating a signed PDF typically invalidates the signature. ToolNest detects signatures and warns you before export.",
      },
      {
        question: "Are bookmarks preserved?",
        answer:
          "When you only rotate pages without reordering or deleting, in-place rotation preserves bookmarks and hyperlinks.",
      },
      {
        question: "Can I rotate multiple PDFs at once?",
        answer:
          "Yes. Use the Batch tab to queue PDFs, set a global rotation angle, and download results as a ZIP.",
      },
      {
        question: "Does it work with password-protected PDFs?",
        answer:
          "Yes. Enter the password when prompted to unlock the PDF before rotating.",
      },
      {
        question: "What angles are supported?",
        answer:
          "Quick 90° clockwise/counterclockwise buttons, plus any custom angle from 0 to 359 degrees per page.",
      },
    ],
    relatedSlugs: ["pdf-merge", "pdf-split", "pdf-compress", "pdf-watermark", "pdf-page-numbers", "image-to-pdf"],
    whyHeading: "Why rotate PDFs with ToolNest?",
    howToHeading: "How to rotate PDF pages online",
  },
  "pdf-compress": {
    title: "Compress PDF Online Free — Reduce PDF File Size",
    metaDescription:
      "Compress PDF online for free. Lossless to high compression, batch ZIP, before/after compare, encrypted PDF unlock, metadata cleanup. Ultra PDF Compress Studio — 100% in-browser.",
    keywords: [
      "compress pdf",
      "compress pdf online",
      "reduce pdf size",
      "pdf compressor",
      "shrink pdf",
      "pdf compression",
      "optimize pdf",
      "make pdf smaller",
      "pdf size reducer",
      "compress pdf free",
      "batch compress pdf",
      "lossless pdf compress",
      "pdf compress tool",
      "compress large pdf",
      "pdf optimize online",
    ],
    h1: "Compress PDF Online — Free PDF Size Reducer",
    tagline:
      "Reduce PDF file size in your browser. Choose lossless, low, medium, or high compression — preview before/after, batch ZIP, and download instantly.",
    intro:
      "ToolNest Compress PDF is an enterprise-grade Ultra PDF Compress Studio that runs in your browser. Upload a PDF, pick a compression level from lossless structure optimization to high-quality rasterization for scans, estimate savings, preview side-by-side, strip metadata, optionally grayscale, and download — or batch-compress many files into one ZIP. Password-protected PDFs can be unlocked in-browser; optional output encryption supported. REST API available for automation.",
    features: [
      { title: "100% private", description: "Compression runs locally — files never uploaded unless you use the optional API." },
      { title: "Five compression levels", description: "Lossless, low, medium, high, and custom JPEG quality + DPI controls." },
      { title: "Before/after compare", description: "Side-by-side preview with exact byte savings percentage." },
      { title: "Batch ZIP export", description: "Compress multiple PDFs with the same settings — one download." },
      { title: "Smart assist", description: "Heuristic tips based on file size, page count, and chosen level." },
      { title: "Metadata cleanup", description: "Strip title, author, and keywords to shave extra bytes." },
      { title: "Encrypted PDF input", description: "Unlock password-protected PDFs before compressing." },
      { title: "REST API", description: "POST /api/v1/pdf/compress for server-side automation." },
    ],
    steps: [
      { name: "Upload PDF", text: "Drag and drop or browse. Unlock encrypted PDFs if prompted." },
      { name: "Choose level", text: "Pick lossless for text PDFs or medium/high for scans. Tune quality in Settings." },
      { name: "Preview & download", text: "Compare before/after, then download or batch ZIP." },
    ],
    faqs: [
      { question: "Is PDF compression free?", answer: "Yes. ToolNest Compress PDF is free with no signup for browser compression." },
      { question: "Will quality suffer?", answer: "Lossless mode preserves visuals. Medium/high rasterize pages — best for scans, not pure text." },
      { question: "Are files uploaded?", answer: "No for the browser studio. The optional API sends base64 to your server endpoint." },
    ],
    relatedSlugs: ["pdf-merge", "pdf-split", "image-compress", "pdf-rotate", "pdf-watermark"],
    whyHeading: "Why compress PDFs with ToolNest?",
    howToHeading: "How to compress PDF files online",
  },
  "pdf-to-word": {
    title: "PDF to Word Online Free — Convert PDF to Editable DOCX",
    metaDescription:
      "Convert PDF to Word online for free. Editable DOCX, DOC & RTF output with layout retention, font & formatting preservation, table & image extraction, multilingual OCR for scanned PDFs, page ranges, encrypted PDF support, batch ZIP & REST API — 100% in-browser.",
    keywords: [
      "pdf to word",
      "pdf to word online",
      "pdf to docx",
      "pdf to docx online free",
      "convert pdf to word",
      "pdf to word converter",
      "pdf to word editable",
      "pdf to doc",
      "pdf to rtf",
      "pdf converter",
      "extract text from pdf",
      "pdf to word ocr",
      "scanned pdf to word",
      "pdf to word without losing formatting",
      "pdf to word layout preserve",
      "pdf to word free no signup",
      "pdf to word in browser",
      "pdf to word api",
      "batch pdf to word",
      "pdf to word multilingual",
      "pdf to word hindi",
      "pdf to word spanish",
      "pdf to word arabic",
      "pdf to word chinese",
      "pdf to word encrypted",
      "adobe acrobat alternative",
      "smallpdf alternative",
      "ilovepdf alternative",
    ],
    h1: "PDF to Word Online — Free Editable DOCX Converter",
    tagline:
      "Convert PDF to editable Word in your browser. DOCX, DOC & RTF output with layout preservation, multilingual OCR for scanned PDFs, page ranges, encrypted PDFs, batch ZIP & REST API.",
    intro:
      "ToolNest PDF to Word is a world-class Ultra PDF→Word Studio that runs entirely in your browser using pdfjs-dist and the `docx` library. Drop one or many PDFs — or a whole folder — and get fully editable Word documents in seconds. Choose DOCX for editable fidelity (headings, lists, alignment, embedded page images), DOC for Word-compatible HTML, or RTF for universal text. Reconstruct paragraphs from PDF text runs, detect headings by font size, preserve alignment, bullet lists, bold/italic, headers, footers and hyperlinks. OCR scanned PDFs in 17+ languages via Tesseract.js loaded on-demand from CDN — auto-detect scanned pages or force OCR. Pick page ranges (1-3, 5, 8-10), unlock password-protected PDFs, batch convert to ZIP, preview page thumbnails, view history, favorite the tool, paste PDFs from clipboard. Eight UI languages, dark/light mode, full keyboard accessibility, and a server-side REST API at POST /api/v1/pdf/to-word for CI/CD automation.",
    features: [
      { title: "100% private & secure", description: "Conversion runs locally via pdfjs-dist + docx + Tesseract.js. Nothing is uploaded unless you use the optional REST API." },
      { title: "Editable DOCX output", description: "Real .docx with headings, lists, alignment, bold/italic, page breaks and embedded scanned-page images — opens natively in Word, Google Docs, LibreOffice." },
      { title: "DOC & RTF alternatives", description: "Word-compatible HTML saved as .doc, plus a hand-written RTF encoder for universal text-only export." },
      { title: "Multilingual OCR", description: "Tesseract.js OCR in 17+ languages including English, Spanish, French, German, Arabic, Hindi, Chinese, Japanese, Korean, Turkish — auto-detect or force-OCR mode." },
      { title: "Layout preservation", description: "Reconstructs paragraphs from text runs, detects headings by font size, infers alignment from line extents, marks bullet/numbered list items." },
      { title: "Page range selection", description: "Convert only the pages you need with simple range syntax like 1-3, 5, 8-10 — much faster for big PDFs." },
      { title: "Encrypted PDF support", description: "Unlock password-protected PDFs in-browser; password never leaves your device in the browser studio." },
      { title: "Batch & folder upload", description: "Queue many PDFs or an entire folder and download a single ZIP of Word documents — parallel processing." },
      { title: "Page preview", description: "Render every source page as a thumbnail and view them in the Preview tab before/after conversion." },
      { title: "History & favorites", description: "Last 50 conversions remembered locally; favorite the tool for one-click access from your dashboard." },
      { title: "Clipboard & multilingual UI", description: "Paste PDFs straight from the clipboard; UI translated into English, Spanish, German, French, Turkish, Hindi, Portuguese and Japanese." },
      { title: "REST API", description: "POST /api/v1/pdf/to-word with base64 PDF + options — server-side extraction via pdfjs-dist and DOCX rendering for CI/CD pipelines." },
    ],
    steps: [
      { name: "Upload PDF", text: "Drag-and-drop, paste, or pick files / a whole folder. Encrypted PDFs prompt for a password." },
      { name: "Choose format & options", text: "Pick DOCX/DOC/RTF, page ranges, OCR mode & language, layout preservation. Apply Smart AI suggestions when prompted." },
      { name: "Convert & download", text: "Preview page thumbnails, download one document or export the whole batch as a ZIP. History is saved locally." },
    ],
    faqs: [
      { question: "Is PDF to Word conversion free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is also available for automation." },
      { question: "Are my PDFs uploaded?", answer: "No. All browser conversion runs locally. The API only processes PDFs you explicitly send to it." },
      { question: "Can it convert scanned PDFs?", answer: "Yes — enable OCR (scanned-only or always) and pick the document's language. Tesseract.js loads on-demand from CDN (~3-15 MB language model)." },
      { question: "Does it preserve formatting?", answer: "DOCX output preserves headings, lists, alignment, bold/italic and page breaks. Complex multi-column layouts may reflow but all text and headings remain editable." },
      { question: "Can I convert only some pages?", answer: "Yes — use page range syntax like 1-3, 5, 8-10 in Settings. This is much faster for large PDFs." },
      { question: "Does it handle password-protected PDFs?", answer: "Yes — enter the password in Settings or use the unlock prompt. The password never leaves your device in the browser studio." },
    ],
    relatedSlugs: ["pdf-merge", "pdf-split", "pdf-compress", "pdf-to-text", "pdf-rotate", "word-to-pdf"],
    whyHeading: "Why convert PDF to Word with ToolNest?",
    howToHeading: "How to convert PDF to Word online",
  },
  "pdf-to-excel": {
    title: "PDF to Excel Online Free — Convert PDF Tables to XLSX & CSV",
    metaDescription:
      "Convert PDF to Excel online for free. AI table detection, merged-cell recognition, multi-sheet XLSX, CSV, XLS & ODS output, OCR for scanned PDFs, page ranges, encrypted PDF support, 17+ OCR languages, batch ZIP & REST API — 100% in-browser.",
    keywords: [
      "pdf to excel",
      "pdf to excel online",
      "pdf to xlsx",
      "pdf to xlsx online free",
      "convert pdf to excel",
      "pdf to excel converter",
      "pdf to csv",
      "pdf to xls",
      "pdf to ods",
      "extract tables from pdf",
      "pdf table extractor",
      "pdf to excel ocr",
      "scanned pdf to excel",
      "pdf to excel without losing formatting",
      "pdf to excel merged cells",
      "pdf to excel free no signup",
      "pdf to excel in browser",
      "pdf to excel api",
      "batch pdf to excel",
      "pdf to excel multilingual",
      "pdf to excel hindi",
      "pdf to excel spanish",
      "pdf to excel arabic",
      "pdf to excel chinese",
      "pdf to excel encrypted",
      "adobe acrobat alternative",
      "smallpdf alternative",
      "ilovepdf alternative",
      "pdf24 alternative",
      "nitro pdf alternative",
      "pdf candy alternative",
    ],
    h1: "PDF to Excel Online — Free AI Table Extractor & XLSX Converter",
    tagline:
      "Convert PDF tables to Excel in your browser. AI-powered table detection with merged cells, multi-sheet XLSX/CSV/XLS/ODS, OCR for scanned PDFs, page ranges, encrypted PDFs, batch ZIP & REST API.",
    intro:
      "ToolNest PDF to Excel is a world-class Ultra PDF→Excel Studio that runs entirely in your browser using pdfjs-dist + exceljs + jszip. Drop one or many PDFs — or a whole folder — and get fully editable spreadsheets in seconds. The intelligent table engine clusters text items into rows and columns by position, detects column boundaries via gap analysis, recognizes merged cells that span multiple columns, identifies header rows (bolded + shaded), parses numeric values into real Excel numbers with `#,##0.00` formatting, and preserves formula-like strings starting with `=`. Output formats: XLSX (Excel, full fidelity with merged cells), CSV (RFC 4180, UTF-8 BOM, custom delimiter), XLS (Excel-compatible HTML), ODS (OpenDocument Spreadsheet with proper mimetype + manifest). OCR scanned PDFs in 17+ languages via Tesseract.js — word bounding boxes feed the same table engine, so even photographed tables become structured spreadsheets. Choose one sheet per page or one combined sheet, pick page ranges, unlock encrypted PDFs, batch convert to ZIP, preview detected tables with row/col counts and OCR confidence, view duplicate-row warnings for data cleanup, history, favorites, paste PDFs from clipboard. Eight UI languages, dark/light mode, full keyboard accessibility, and a server-side REST API at POST /api/v1/pdf/to-excel for CI/CD automation.",
    features: [
      { title: "100% private & secure", description: "Conversion runs locally via pdfjs-dist + exceljs + Tesseract.js. Nothing is uploaded unless you use the optional REST API." },
      { title: "AI table detection", description: "Clusters text items into rows & columns by position, detects column boundaries via gap analysis, supports auto/grid/lines modes." },
      { title: "Merged-cell recognition", description: "Detects cells spanning multiple columns by text-item width and produces real Excel merged cells — perfect for grouped headers." },
      { title: "Multi-format output", description: "XLSX (Excel with merged cells + number formatting), CSV (RFC 4180 + BOM), XLS (Excel HTML), ODS (OpenDocument via jszip with proper mimetype + manifest)." },
      { title: "Multi-sheet support", description: "One sheet per page or one combined sheet — your choice. Auto-width columns, bold shaded headers, tabular numerics." },
      { title: "Numeric & formula parsing", description: "Detects numeric strings (currencies, percentages, thousands) and writes them as real Excel numbers. Formula-like strings (starting with =) are preserved as formulas." },
      { title: "Multilingual OCR", description: "Tesseract.js in 17+ languages — word bounding boxes feed the same table engine, so scanned/photographed tables become structured data." },
      { title: "Page range selection", description: "Convert only the pages you need with range syntax like 1-3, 5, 8-10 — much faster for big PDFs." },
      { title: "Encrypted PDF support", description: "Unlock password-protected PDFs in-browser; password never leaves your device in the browser studio." },
      { title: "Duplicate-row detection", description: "After conversion, the preview tab flags duplicate rows across pages — invaluable for data cleanup before analysis." },
      { title: "Batch & folder upload", description: "Queue many PDFs or an entire folder and download a single ZIP of spreadsheets." },
      { title: "REST API", description: "POST /api/v1/pdf/to-excel with base64 PDF + options — server-side extraction via pdfjs-dist and XLSX rendering via exceljs for CI/CD pipelines." },
    ],
    steps: [
      { name: "Upload PDF", text: "Drag-and-drop, paste, or pick files / a whole folder. Encrypted PDFs prompt for a password." },
      { name: "Choose format & table mode", text: "Pick XLSX/CSV/XLS/ODS, table mode (auto/grid/lines), page ranges, OCR, merged cells & headers. Apply Smart AI when prompted." },
      { name: "Convert & download", text: "Preview detected tables with row/col counts, review duplicate-row warnings, download one spreadsheet or batch ZIP. History saved locally." },
    ],
    faqs: [
      { question: "Is PDF to Excel conversion free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is also available for automation." },
      { question: "Are my PDFs uploaded?", answer: "No. All browser conversion runs locally. The API only processes PDFs you explicitly send to it." },
      { question: "How does table detection work?", answer: "The engine clusters text items into rows by Y position, detects column boundaries via X-gap analysis, and assigns each text item to a cell. Merged cells are detected by item width spanning multiple columns." },
      { question: "Can it convert scanned PDFs?", answer: "Yes — enable OCR (scanned-only or always). Tesseract.js loads on-demand from CDN and feeds word bounding boxes into the same table engine." },
      { question: "Which output format should I choose?", answer: "XLSX for full fidelity (merged cells, number formatting). CSV for universal data import. ODS for LibreOffice/OpenOffice. XLS for legacy Excel." },
      { question: "Does it handle complex tables?", answer: "Yes for most cases. Very complex multi-line cells or tables without clear column alignment may reflow, but all extracted data remains editable." },
    ],
    relatedSlugs: ["pdf-to-word", "pdf-merge", "pdf-split", "pdf-compress", "pdf-to-text", "image-to-pdf"],
    whyHeading: "Why convert PDF to Excel with ToolNest?",
    howToHeading: "How to convert PDF to Excel online",
  },
  "word-to-pdf": {
    title: "Word to PDF Online Free — Convert DOCX to PDF with Layout Preservation",
    metaDescription:
      "Convert Word to PDF online for free. DOCX, DOC, RTF, ODT & TXT to PDF with layout, tables, images, hyperlinks, batch merge, watermark, AES password protection, PDF/A metadata, page numbers, headers/footers, ZIP export & REST API — 100% in-browser.",
    keywords: [
      "word to pdf",
      "word to pdf online",
      "docx to pdf",
      "doc to pdf",
      "convert word to pdf",
      "word to pdf converter",
      "rtf to pdf",
      "odt to pdf",
      "txt to pdf",
      "word to pdf free",
      "word to pdf no signup",
      "word to pdf in browser",
      "batch word to pdf",
      "merge word to pdf",
      "word to pdf watermark",
      "password protect pdf",
      "word to pdf api",
      "docx to pdf layout preserve",
      "adobe acrobat alternative",
      "smallpdf alternative",
      "ilovepdf alternative",
      "pdf24 alternative",
    ],
    h1: "Word to PDF Online — Free Ultra Word→PDF Studio",
    tagline:
      "Convert Word documents to PDF in your browser. DOCX, RTF, ODT & TXT with tables, images, hyperlinks, batch merge, watermark, encryption, PDF/A & REST API.",
    intro:
      "ToolNest Word to PDF is an enterprise Ultra Word→PDF Studio powered by pdf-lib and JSZip. Drop DOCX, RTF, ODT, or TXT files — or an entire folder — and get print-ready PDFs in seconds. Parse DOCX structure (paragraphs, headings, tables, embedded images, hyperlinks), render with configurable page size (A4/Letter/Legal), margins, headers, footers, page numbers, diagonal watermarks, and optional AES password protection. Batch-convert to individual PDFs or merge into one document, preview before download, export ZIP, save local history, favorite the tool, paste text from clipboard. Eight UI languages, dark/light mode, accessibility, and REST API at POST /api/v1/pdf/word-to-pdf.",
    features: [
      { title: "100% private & secure", description: "Conversion runs locally in your browser via pdf-lib. Documents never leave your device unless you use the optional REST API." },
      { title: "DOCX layout preservation", description: "Parses Word XML for headings, bold/italic runs, alignment, tables, embedded images, and hyperlinks — rendered into structured PDF pages." },
      { title: "Multi-format input", description: "DOCX (best fidelity), ODT, RTF, and plain TXT/MD. Legacy .doc binary is detected with guidance to save as .docx." },
      { title: "Batch & folder upload", description: "Queue many documents or an entire folder. Download individual PDFs or a single ZIP. Optional merge into one combined PDF." },
      { title: "PDF security", description: "Optional open password (AES-256 via @pdfsmaller/pdf-encrypt), owner password, watermark text with adjustable opacity." },
      { title: "Print-ready output", description: "A4, Letter, or Legal page sizes with configurable margins, headers, footers, page numbers, and PDF/A metadata intent." },
      { title: "Live preview", description: "Preview converted PDF in-browser before download. Real-time progress bar during conversion." },
      { title: "Smart assist", description: "AI-powered suggestions for merge mode, .doc conversion, watermark settings, and compression levels." },
      { title: "History & favorites", description: "Last 50 conversions remembered locally; favorite the tool for quick dashboard access." },
      { title: "REST API", description: "POST /api/v1/pdf/word-to-pdf with base64 document + options for CI/CD and server-side automation." },
    ],
    steps: [
      { name: "Upload documents", text: "Drag-and-drop DOCX/RTF/ODT/TXT files, pick a folder, or paste text from clipboard." },
      { name: "Configure output", text: "Set page size, margins, watermark, passwords, headers/footers, merge mode. Apply Smart suggestions." },
      { name: "Convert & download", text: "Preview PDF, download individually, as ZIP, or merged single PDF. History saved locally." },
    ],
    faqs: [
      { question: "Is Word to PDF conversion free?", answer: "Yes — the in-browser studio is free with no signup. Optional REST API is available for automation." },
      { question: "Are my documents uploaded?", answer: "No. Browser conversion runs entirely locally. The API only processes documents you explicitly send." },
      { question: "Does it support .doc files?", answer: "Legacy binary .doc (OLE) cannot be parsed in-browser. Save as .docx in Word for best results." },
      { question: "Does it preserve formatting?", answer: "DOCX output preserves headings, bold/italic, alignment, tables, images, and hyperlinks. Complex Word layouts may simplify slightly." },
      { question: "Can I password-protect the PDF?", answer: "Yes — set an open password in Settings. AES-256 encryption is applied when supported." },
      { question: "Can I merge multiple Word files?", answer: "Yes — enable Merge batch in Settings to combine all converted PDFs into one document." },
    ],
    relatedSlugs: ["pdf-to-word", "pdf-merge", "pdf-compress", "text-to-pdf", "pdf-watermark", "pdf-page-numbers"],
    whyHeading: "Why convert Word to PDF with ToolNest?",
    howToHeading: "How to convert Word to PDF online",
  },
  "image-compress": {
    title: "Compress Image Online Free — AVIF, WebP, JPG & PNG Optimizer",
    metaDescription:
      "Compress images online for free. Batch compress JPG, PNG, WebP, AVIF, GIF & BMP with lossless, lossy, target-size & AI smart modes. Resize, convert formats, strip EXIF, preserve transparency, OCR-safe, ZIP export & REST API — 100% in-browser.",
    keywords: [
      "compress image",
      "image compressor",
      "compress image online",
      "image compressor online free",
      "compress jpg",
      "compress png",
      "compress webp",
      "compress avif",
      "reduce image size",
      "image optimizer",
      "bulk image compressor",
      "batch image compress",
      "lossless image compress",
      "image size reducer",
      "tinypng alternative",
      "squoosh alternative",
      "iloveimg alternative",
      "compress image to 100kb",
      "compress image to 200kb",
      "compress image without losing quality",
      "compress png to webp",
      "convert jpg to webp",
      "convert png to avif",
      "strip exif online",
      "resize image before compress",
      "image compress api",
    ],
    h1: "Compress Image Online — Free Ultra Image Compressor",
    tagline:
      "Enterprise-grade image compression in your browser. Batch compress JPG, PNG, WebP & AVIF with lossless, lossy, target-size, smart-AI, OCR-safe modes — ZIP export & REST API included.",
    intro:
      "ToolNest Compress Image is a world-class Ultra Image Compressor Studio that runs 100% in your browser. Drag-and-drop, paste, or upload entire folders — then compress dozens of images at once with six intelligent modes (Lossless, Low, Medium, High, Extreme, Target file size). Convert between JPG, PNG, WebP and AVIF. Resize before compress with aspect-ratio lock and contain/cover fits. Preserve PNG transparency or flatten to a custom background. Strip EXIF, IPTC and XMP metadata for privacy. Use OCR-safe mode to keep text legible. Smart AI assist analyses each image and recommends the best mode + format based on dimensions, alpha and bits-per-pixel. Side-by-side before/after comparison with a draggable slider and zoom preview. Web Worker + OffscreenCanvas acceleration keeps big batches smooth. History, favorites, ZIP export, clipboard paste, eight languages, dark/light mode, full keyboard accessibility, and a server-side REST API at POST /api/v1/image/compress for CI/CD automation.",
    features: [
      { title: "100% private & secure", description: "Browser-side compression via Canvas + Web Workers. Nothing is uploaded unless you explicitly call the REST API." },
      { title: "Six compression modes", description: "Lossless, Low, Medium, High, Extreme, and exact Target file size with binary-search quality tuning." },
      { title: "Modern formats", description: "Encode to AVIF and WebP when supported, with automatic fallback to JPG/PNG — feature-detected per browser." },
      { title: "Batch & folder upload", description: "Drop entire folders, queue hundreds of images, then download a single ZIP — parallel processing via Web Workers." },
      { title: "Smart AI assist", description: "Heuristic recommendations on mode + format based on alpha, megapixels, bpp, and source MIME — one click to apply." },
      { title: "Resize before compress", description: "Pixel or percentage sizing with contain/cover/free fit and aspect-ratio lock — perfect for web delivery." },
      { title: "Transparency & EXIF control", description: "Preserve PNG/WebP alpha or flatten to a chosen background color; strip EXIF/IPTC/XMP metadata for privacy." },
      { title: "OCR-safe mode", description: "High-quality resampling and no aggressive chroma subsampling — keeps text, diagrams, and receipts legible." },
      { title: "Side-by-side compare", description: "Before/after panels plus a draggable slider comparison with zoom preview up to 300%." },
      { title: "History & favorites", description: "Last 50 compressions remembered locally; favorite the tool for one-click access from your dashboard." },
      { title: "Clipboard & multilingual", description: "Paste images straight from the clipboard; UI translated into English, Spanish, German, French, Turkish, Hindi, Portuguese and Japanese." },
      { title: "REST API", description: "POST /api/v1/image/compress with base64 image + options — powered by sharp for server-side automation in CI/CD pipelines." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop, paste, or pick files / a whole folder. JPG, PNG, WebP, AVIF, GIF, BMP & SVG accepted." },
      { name: "Choose mode & format", text: "Pick Lossless…Extreme or Target size; choose JPG/PNG/WebP/AVIF. Apply Smart AI suggestions when prompted." },
      { name: "Compress & download", text: "Preview before/after, download one file or export the whole batch as a ZIP. History is saved locally." },
    ],
    faqs: [
      { question: "Is image compression free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is also available for automation." },
      { question: "Are my images uploaded?", answer: "No. All browser compression runs locally via Canvas and Web Workers. The API only processes images you explicitly send to it." },
      { question: "Which format should I choose?", answer: "Use WebP or AVIF for the smallest files. Use PNG for sharp transparency. Use JPG for maximum compatibility. Smart AI will recommend the best option per image." },
      { question: "Can I hit an exact file size?", answer: "Yes — Target size mode runs a binary search on quality to land at or below the size you specify." },
      { question: "Does it support batch compression?", answer: "Yes — upload hundreds of files or a folder, then download everything as a single ZIP." },
      { question: "Is OCR-safe mode needed for documents?", answer: "Enable it for screenshots, receipts and scanned text — it preserves fine detail by avoiding aggressive subsampling." },
    ],
    relatedSlugs: ["image-resize", "image-convert", "image-watermark", "img-metadata", "image-to-pdf", "svg-to-png"],
    whyHeading: "Why compress images with ToolNest?",
    howToHeading: "How to compress images online",
  },
  "image-crop": {
    title: "Crop Image Online Free — Smart Auto-Crop, Face Detect & Batch Crop",
    metaDescription:
      "Crop images online for free. Smart auto-crop, face detection, trim edges, 16+ aspect ratios (1:1, 16:9, 9:16, A4, social presets), rotate, flip, straighten, perspective correction, circle crop, batch ZIP, PNG/WebP/AVIF export & REST API — 100% in-browser.",
    keywords: [
      "crop image",
      "crop image online",
      "image cropper",
      "free image cropper",
      "crop photo online",
      "smart crop",
      "auto crop image",
      "face crop",
      "crop image to circle",
      "crop image 1:1",
      "crop image 16:9",
      "instagram crop",
      "youtube thumbnail crop",
      "batch crop images",
      "crop and resize",
      "rotate and crop image",
      "straighten photo online",
      "perspective correction",
      "canva crop alternative",
      "adobe express crop alternative",
      "pixlr crop alternative",
      "fotor crop alternative",
      "iloveimg crop alternative",
      "photopea crop alternative",
      "crop png transparent",
      "crop image to exact size",
      "crop image api",
      "crop image free no signup",
      "crop image in browser",
      "a4 crop ratio",
      "tiktok crop 9:16",
      "linkedin banner crop",
      "pinterest crop 2:3",
    ],
    h1: "Crop Image Online — Smart Auto-Crop, Face Detect & Batch Cropper",
    tagline:
      "Enterprise-grade image cropping in your browser. Smart auto-crop, face detection, 16+ aspect ratios, rotate/flip/straighten, perspective warp, circle crop, batch ZIP & REST API.",
    intro:
      "ToolNest Crop Image is a world-class Ultra Image Crop Studio that runs 100% in your browser. Drag-and-drop, paste, or upload entire folders — then crop with a professional editor featuring drag handles, rule-of-thirds grid, undo/redo, and keyboard shortcuts (Ctrl+Z, R to rotate). Choose from 16+ aspect ratio presets: freeform, 1:1, 4:3, 16:9, 9:16 Instagram Story, 4:5 Instagram Portrait, 2:3 Pinterest, A4 portrait/landscape, TikTok, LinkedIn banner, YouTube thumbnail, and more. Smart auto-crop modes: Trim Edges (content-aware margin removal), Face Detect (browser FaceDetector API with padded framing), and Center crop. Transform with rotate 90°, flip horizontal/vertical, straighten (-45° to +45°), zoom and pan. Perspective correction via 4-corner bilinear warp on export. Circular crop with alpha transparency. Export to JPG, PNG, WebP, AVIF, GIF, BMP, ICO with quality control and custom output dimensions. Batch crop all files with the same settings and download a ZIP. Before/after compare tab, local history (50 entries), favorites, eight UI languages, dark/light mode, accessibility, and REST API at POST /api/v1/image/crop powered by sharp.",
    features: [
      { title: "100% private & secure", description: "All cropping runs locally via Canvas + createImageBitmap. Nothing is uploaded unless you call the REST API." },
      { title: "Smart auto-crop", description: "Trim edges (content boundary detection), Face Detect (FaceDetector API), and Center crop with aspect-ratio lock." },
      { title: "16+ aspect ratios", description: "Freeform, 1:1, 4:3, 16:9, 9:16, 4:5, 2:3, A4, Instagram, TikTok, YouTube, LinkedIn, Pinterest presets." },
      { title: "Professional editor", description: "Drag handles, move region, rule-of-thirds grid, undo/redo stack, keyboard shortcuts." },
      { title: "Rotate, flip & straighten", description: "90° rotation, horizontal/vertical flip, and -45° to +45° straighten baked before crop." },
      { title: "Perspective correction", description: "4-corner bilinear warp maps skewed documents and photos to a flat rectangle on export." },
      { title: "Circle crop", description: "Export circular avatars and profile photos with transparent PNG/WebP alpha." },
      { title: "Multi-format export", description: "PNG, JPG, WebP, AVIF, GIF, BMP, ICO with quality slider and custom output width/height." },
      { title: "Batch & folder upload", description: "Crop dozens of images with the same settings; download all as a ZIP archive." },
      { title: "Before/after compare", description: "Side-by-side preview of original vs cropped output before downloading." },
      { title: "AI crop tips", description: "Recommends smart trim, format changes, and aspect ratios based on your image and settings." },
      { title: "REST API", description: "POST /api/v1/image/crop with base64 image, normalized crop rect, rotate, format — powered by sharp." },
    ],
    steps: [
      { name: "Upload images", text: "Drag-and-drop, paste from clipboard, or pick files / a whole folder." },
      { name: "Crop & transform", text: "Draw or adjust the crop region, pick an aspect ratio, use Smart Crop, rotate, flip, or straighten." },
      { name: "Export", text: "Choose format and output size, download one file, preview before/after, or batch ZIP all images." },
    ],
    faqs: [
      { question: "Is the image cropper free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is available for automation." },
      { question: "Are my images uploaded?", answer: "No. All browser cropping runs locally. The API only processes images you explicitly send." },
      { question: "How does smart face crop work?", answer: "When your browser supports the FaceDetector API, we detect faces and frame the crop with padding around the subject." },
      { question: "Can I crop to exact pixels?", answer: "Yes — set Output Width and Height in the settings panel. Leave at 0 for native crop resolution." },
      { question: "Does batch crop use the same settings?", answer: "Yes — upload multiple files, set crop/aspect/format once, and export all as a ZIP." },
      { question: "Which format for transparent circle crops?", answer: "Use PNG or WebP with Preserve transparency enabled." },
    ],
    relatedSlugs: ["image-compress", "image-resize", "image-convert", "image-rotate", "image-watermark", "passport-photo-resizer"],
    whyHeading: "Why crop images with ToolNest?",
    howToHeading: "How to crop an image online",
  },
  "image-resize": {
    title: "Resize Image Online Free — Smart Resize, Social & Print Presets",
    metaDescription:
      "Resize images online for free. Pixels, percent, inches, cm, mm with DPI, social & print presets, content-aware crop, contain/cover/pad, rotate, flip, batch ZIP, WebP/AVIF/PNG/JPG export & REST API — 100% in-browser.",
    keywords: [
      "resize image",
      "resize image online",
      "image resizer",
      "resize image online free",
      "resize photo",
      "change image size",
      "resize image pixels",
      "resize image percentage",
      "resize image for instagram",
      "resize image 1920x1080",
      "batch resize images",
      "resize image dpi",
      "resize image cm",
      "resize image inches",
      "content aware resize",
      "resize png",
      "resize webp",
      "resize image without losing quality",
      "canva resize alternative",
      "squoosh alternative",
      "iloveimg resize alternative",
      "tinypng resize alternative",
      "fotor resize alternative",
      "pixlr resize alternative",
      "adobe express resize alternative",
      "resize image api",
      "resize image free no signup",
      "resize image in browser",
      "social media image size",
      "print image resize dpi",
      "4x6 photo resize",
      "a4 image resize",
    ],
    h1: "Resize Image Online — Smart Resize, Presets & Batch Export",
    tagline:
      "Enterprise-grade image resizing in your browser. Pixels, percent, inches, cm, mm with DPI — social & print presets, content-aware crop, batch ZIP & REST API.",
    intro:
      "ToolNest Resize Image is a world-class Ultra Image Resize Studio that runs 100% in your browser. Drag-and-drop, paste, or upload entire folders — then resize with pixel-perfect control using px, %, inches, centimeters, or millimeters at any DPI/PPI. Lock or unlock aspect ratio. Choose fit modes: Contain (pad/letterbox), Cover (crop), Content-aware (saliency-weighted smart crop), or Stretch. 18+ presets for Instagram, TikTok, YouTube, LinkedIn, Pinterest, Facebook, HD, 4K, A4, US Letter, and photo print sizes. Rotate 90° and flip horizontal/vertical. Export to JPG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO with quality control, transparency preservation, optional sharpen, and lossless optimization. Batch resize dozens of images and download a ZIP. Before/after compare tab, undo/redo, keyboard shortcuts, AI optimization recommendations, local history, favorites, eight languages, and REST API at POST /api/v1/image/resize powered by sharp.",
    features: [
      { title: "100% private & secure", description: "All resizing runs locally via Canvas + createImageBitmap. Nothing is uploaded unless you call the REST API." },
      { title: "Multi-unit sizing", description: "Resize by pixels, percentage, inches, centimeters, or millimeters with configurable DPI/PPI for print-ready output." },
      { title: "18+ size presets", description: "Instagram, TikTok, YouTube, LinkedIn, Pinterest, Facebook, HD 1080p, 4K, A4, US Letter, 4×6, 5×7, 8×10 photo sizes." },
      { title: "Smart fit modes", description: "Contain (pad), Cover (crop), Content-aware (saliency detection), or Stretch — with aspect ratio lock/unlock." },
      { title: "Rotate & flip", description: "Rotate 90° steps and flip horizontal/vertical before resize — applied before scaling." },
      { title: "Content-aware scaling", description: "Edge + center-bias saliency map keeps subjects centered when cropping to fit." },
      { title: "Modern format export", description: "JPG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO with quality slider and transparency control." },
      { title: "Batch & ZIP export", description: "Apply the same resize settings to an entire folder and download all results as one ZIP." },
      { title: "Before/after compare", description: "Side-by-side preview of original vs resized output before download." },
      { title: "AI optimization tips", description: "Heuristic recommendations for format, fit mode, and web delivery sizes based on image analysis." },
      { title: "Undo/redo & shortcuts", description: "24-step undo stack, R to rotate, Ctrl+Z undo, Ctrl+Shift+Z redo." },
      { title: "REST API", description: "POST /api/v1/image/resize with base64 image + dimensions — sharp-powered server automation." },
    ],
    steps: [
      { name: "Upload images", text: "Drag-and-drop, paste, browse files, or upload a folder. JPG, PNG, WebP, AVIF, GIF, BMP, SVG, HEIC supported." },
      { name: "Set size & fit", text: "Enter width/height in px, %, in, cm, or mm. Pick a social/print preset or choose contain, cover, or content-aware fit." },
      { name: "Resize & download", text: "Preview before/after, download one file or batch-export all as ZIP. History saved locally." },
    ],
    faqs: [
      { question: "Is image resizing free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is available for automation." },
      { question: "Are my images uploaded?", answer: "No. Browser resizing runs locally. Only the API processes images you explicitly send." },
      { question: "Can I resize for Instagram?", answer: "Yes — use presets like Instagram Square (1080×1080), 4:5 Portrait, or Story 9:16." },
      { question: "How do inches and DPI work?", answer: "Enter size in inches, cm, or mm and set DPI (default 300). Output pixels = physical size × DPI." },
      { question: "What is content-aware resize?", answer: "When using Cover fit with content-aware mode, the crop center is chosen by detecting edges and salient regions — keeping subjects in frame." },
      { question: "Can I batch resize?", answer: "Yes — upload multiple files, set dimensions once, and download a ZIP of all resized images." },
    ],
    relatedSlugs: ["image-compress", "image-crop", "image-convert", "image-rotate", "image-watermark", "image-resize-kb"],
    whyHeading: "Why resize images with ToolNest?",
    howToHeading: "How to resize an image online",
  },
  "json-formatter": {
    title: "JSON Formatter Online Free — Validate, Beautify & Minify JSON",
    metaDescription:
      "Format JSON online for free. Validate, repair broken JSON, minify, sort keys, tree view, JSONPath query, flatten, and export to CSV. Ultra JSON Studio runs 100% in your browser — no signup.",
    keywords: [
      "json formatter",
      "json formatter online",
      "format json",
      "json beautifier",
      "json validator",
      "validate json",
      "json minify",
      "minify json",
      "pretty print json",
      "json parser",
      "json viewer",
      "json tree view",
      "json path",
      "json to csv",
      "repair json",
      "fix json",
      "json prettifier",
      "online json tool",
      "free json formatter",
      "json editor online",
    ],
    h1: "JSON Formatter Online — Free JSON Beautifier & Validator",
    tagline:
      "Format, validate, and explore JSON in your browser. Repair common syntax errors, browse an interactive tree, query paths, flatten objects, and export — no account required.",
    intro:
      "ToolNest JSON Formatter is a professional-grade Ultra JSON Studio that runs entirely in your browser. Paste API responses or upload .json files, beautify with 2-space, 4-space, or tab indentation, minify for production, validate with line and column errors, and auto-repair trailing commas and comments from copy-paste mistakes. Explore nested data in an interactive tree with search, run JSONPath-style queries, flatten to dot notation, convert arrays to CSV, and download results instantly — nothing is sent to a server.",
    features: [
      {
        title: "100% private & secure",
        description:
          "Your JSON is processed locally in the browser. No uploads, no logging — ideal for API keys, configs, and production payloads.",
      },
      {
        title: "Format, minify & sort keys",
        description:
          "Beautify with configurable indent or compress to a single line. Optionally sort object keys alphabetically at every level.",
      },
      {
        title: "Validate with precise errors",
        description:
          "Instant syntax validation with line and column numbers when JSON.parse fails — fix issues faster.",
      },
      {
        title: "Smart JSON repair",
        description:
          "Strip // and block comments, remove trailing commas, and recover common copy-paste mistakes before formatting.",
      },
      {
        title: "Interactive tree view",
        description:
          "Expand and collapse objects and arrays, color-coded types, and search across keys, values, and paths.",
      },
      {
        title: "JSONPath-style queries",
        description:
          "Extract nested values with paths like data.users[0].name without writing code.",
      },
      {
        title: "Transform & export",
        description:
          "Flatten to dot notation, convert JSON arrays to CSV, copy output, or download .json and .csv files.",
      },
      {
        title: "Sample templates & file upload",
        description:
          "Load API, config, GraphQL, or broken JSON samples; drag-and-drop .json files to start instantly.",
      },
    ],
    steps: [
      {
        name: "Paste or upload JSON",
        text: "Drop a .json file onto Ultra JSON Studio or paste from your clipboard, log file, or API client.",
      },
      {
        name: "Format, validate, or repair",
        text: "Click Format to beautify, Minify to compress, Validate to check syntax, or Repair to fix comments and trailing commas.",
      },
      {
        name: "Explore and export",
        text: "Use Tree View to browse structure, Transform tab for JSONPath and CSV export, then Copy or Download your result.",
      },
    ],
    faqs: [
      {
        question: "Is this JSON formatter free?",
        answer:
          "Yes. ToolNest JSON Formatter is free with no signup. Format, validate, repair, tree view, and export features are available on the Free plan.",
      },
      {
        question: "Is my JSON uploaded to your servers?",
        answer:
          "No. All processing happens in your web browser. Your data never leaves your device.",
      },
      {
        question: "Can it fix invalid JSON?",
        answer:
          "The Repair tool removes comments, trailing commas, and BOM markers. Severely malformed JSON may still need manual fixes — validation shows the exact error line.",
      },
      {
        question: "What is JSONPath used for here?",
        answer:
          "Enter a path like data.users[0].name to extract a nested value from large API responses without scrolling through formatted text.",
      },
      {
        question: "Can I convert JSON to CSV?",
        answer:
          "Yes. If your JSON is an array of flat objects (same keys per row), use JSON → CSV in the Transform tab and download the result.",
      },
      {
        question: "Does it work on mobile?",
        answer:
          "Yes. The tool works on modern mobile browsers, though large JSON files are easier to edit on desktop.",
      },
      {
        question: "What indent options are supported?",
        answer:
          "Choose 2 spaces, 4 spaces, or tabs in Settings before formatting. Minify removes all whitespace.",
      },
      {
        question: "Can I sort JSON keys alphabetically?",
        answer:
          "Yes. Enable Sort keys in Settings, then click Format to output deterministic, sorted JSON — useful for diffs and configs.",
      },
    ],
    relatedSlugs: ["hash-generator", "uuid-generator", "base64-encode", "url-encode", "case-converter", "remove-duplicates"],
    whyHeading: "Why format JSON with ToolNest?",
    howToHeading: "How to format and validate JSON online",
  },
  "base64-encode": {
    title: "Base64 Encode Online Free — Text, File & URL-Safe Encoder",
    metaDescription:
      "Encode Base64 online for free. UTF-8 text, hex, file upload, URL-safe alphabet, MIME wrap, data URIs, batch mode, hex inspector, and REST API. Ultra Base64 Studio — 100% in-browser.",
    keywords: [
      "base64 encode",
      "base64 encoder",
      "base64 encode online",
      "encode to base64",
      "base64 converter",
      "text to base64",
      "file to base64",
      "image to base64",
      "base64 url safe",
      "base64 data uri",
      "base64 online free",
      "base64 tool",
      "base64 generator",
      "utf8 base64",
      "hex to base64",
      "base64 mime",
      "base64 encode file",
      "base64 studio",
      "encode base64 online free",
      "base64 api",
    ],
    h1: "Base64 Encode Online — Free Ultra Base64 Encoder",
    tagline:
      "Encode text, hex, and files to Base64 in your browser. URL-safe mode, MIME wrapping, data URIs, batch processing, and hex inspector — no signup required.",
    intro:
      "ToolNest Base64 Encode is an enterprise-grade Ultra Base64 Studio that runs entirely in your browser. Paste UTF-8 text or hex bytes, drag-and-drop any file, and encode to standard or URL-safe Base64 with optional padding. Output plain Base64, RFC-style MIME-wrapped lines, or ready-to-use data URIs with custom MIME types. Batch-encode multiple lines, inspect raw bytes in hex dump view, validate strings, swap encode/decode in one click, and automate via our REST API — your data never leaves your device unless you call the optional server API.",
    features: [
      {
        title: "100% private client-side processing",
        description:
          "The browser studio encodes locally with zero uploads. Ideal for tokens, certificates, and proprietary file payloads.",
      },
      {
        title: "Text, hex & file inputs",
        description:
          "Encode UTF-8 strings (including emoji), raw hex byte sequences, or any uploaded file with automatic MIME detection.",
      },
      {
        title: "Standard & URL-safe alphabets",
        description:
          "Switch between RFC 4648 standard (+/) and URL-safe (-_) Base64 — perfect for JWT segments and query strings.",
      },
      {
        title: "MIME wrap & data URIs",
        description:
          "Output PEM-style 76-column wrapped Base64 or complete data:image/png;base64,... URIs for HTML and CSS.",
      },
      {
        title: "Live encode with smart detect",
        description:
          "Real-time processing with intelligent input detection for hex, data URIs, and multi-line batch suggestions.",
      },
      {
        title: "Batch line processing",
        description:
          "Encode hundreds of strings at once — one input per line, one output per line, with per-line error reporting.",
      },
      {
        title: "Hex inspector & dump",
        description:
          "Visualize encoded bytes as spaced hex and classic offset hex dump — essential for debugging binary payloads.",
      },
      {
        title: "REST API for automation",
        description:
          "POST /api/v1/base64 for server-side encode/decode in CI pipelines, webhooks, and internal tools.",
      },
    ],
    steps: [
      {
        name: "Choose input type",
        text: "Paste UTF-8 text or hex, or drag a file onto Ultra Base64 Studio. Pick Encode mode and adjust alphabet in Settings.",
      },
      {
        name: "Configure output",
        text: "Select plain Base64, MIME-wrapped lines, or data URI. Set URL-safe mode and padding as needed.",
      },
      {
        name: "Copy, download, or API",
        text: "Copy the result, download as text, inspect bytes in the Inspector tab, or integrate via POST /api/v1/base64.",
      },
    ],
    faqs: [
      {
        question: "Is this Base64 encoder free?",
        answer:
          "Yes. ToolNest Base64 Encode is free with no signup. Encode, batch, inspect, and download features are available on the Free plan.",
      },
      {
        question: "Are my files uploaded to your servers?",
        answer:
          "No. The browser studio processes everything locally. The optional REST API is separate and stateless — use it only when you need automation.",
      },
      {
        question: "Does it support Unicode and emoji?",
        answer:
          "Yes. Text is encoded as UTF-8 bytes before Base64, preserving emoji, Bengali, Arabic, and all Unicode characters.",
      },
      {
        question: "What is URL-safe Base64?",
        answer:
          "URL-safe Base64 replaces + with - and / with _ so encoded strings can be used in URLs and JWT tokens without extra escaping.",
      },
      {
        question: "Can I encode images and PDFs?",
        answer:
          "Yes. Drag and drop any file. The tool reads it as binary and can output a data URI with the correct MIME type.",
      },
      {
        question: "What is MIME wrapping?",
        answer:
          "MIME wrap inserts line breaks every 76 characters, matching email and PEM conventions for long Base64 blocks.",
      },
      {
        question: "Is there an API?",
        answer:
          "Yes. POST /api/v1/base64 with JSON body { action: 'encode', input: '...' } returns encoded output and stats.",
      },
      {
        question: "What's the difference between Encode and Decode tools?",
        answer:
          "Both use Ultra Base64 Studio. The Encode page opens in encode mode; Decode opens in decode mode with the same features.",
      },
    ],
    relatedSlugs: ["base64-decode", "hash-generator", "json-formatter", "url-encode", "uuid-generator", "checksum-gen"],
    whyHeading: "Why encode Base64 with ToolNest?",
    howToHeading: "How to encode Base64 online",
  },
  "base64-decode": {
    title: "Base64 Decode Online Free — Decode Text, Files & Data URIs",
    metaDescription:
      "Decode Base64 online for free. Standard and URL-safe, data URIs, file download, hex inspector, batch decode, validation. Ultra Base64 Studio in your browser.",
    keywords: [
      "base64 decode",
      "base64 decoder",
      "decode base64",
      "base64 decode online",
      "base64 to text",
      "base64 to file",
      "data uri decode",
      "url safe base64 decode",
      "base64 online free",
      "decode base64 string",
      "base64 converter",
      "base64 tool",
      "base64 validator",
      "jwt base64 decode",
      "base64 decode file",
      "hex from base64",
    ],
    h1: "Base64 Decode Online — Free Ultra Base64 Decoder",
    tagline:
      "Decode Base64 strings and data URIs to UTF-8 text or downloadable files. Batch mode, validation, and hex inspector included.",
    intro:
      "ToolNest Base64 Decode opens Ultra Base64 Studio in decode mode. Paste standard or URL-safe Base64, full data URIs, or MIME-wrapped blocks and recover UTF-8 text or binary files instantly in your browser. Validate padding, swap output back to encode, batch-decode multiple lines, and inspect raw bytes — all without uploading secrets to a server.",
    features: [
      {
        title: "Client-side decoding",
        description: "Decode locally — tokens and private payloads stay on your device.",
      },
      {
        title: "Data URI support",
        description: "Automatically parses data:mime;base64,... and extracts MIME type and bytes.",
      },
      {
        title: "URL-safe & standard",
        description: "Handles JWT-style URL-safe Base64 and standard RFC 4648 alphabet.",
      },
      {
        title: "File download",
        description: "Download decoded binary as the correct file type when MIME is known.",
      },
      {
        title: "Batch decode",
        description: "Decode one Base64 string per line with per-line error messages.",
      },
      {
        title: "Hex inspector",
        description: "View decoded bytes as hex and classic dump for forensic debugging.",
      },
    ],
    steps: [
      { name: "Paste Base64", text: "Paste a Base64 string or data URI into the input area." },
      { name: "Decode", text: "Click Decode or enable Live mode. Fix padding errors using Validate." },
      { name: "Use output", text: "Copy UTF-8 text, download binary files, or inspect hex in the Inspector tab." },
    ],
    faqs: [
      {
        question: "Why does decode fail?",
        answer:
          "Common causes: wrong alphabet (URL-safe vs standard), missing padding, or non-Base64 characters. Use Validate for details.",
      },
      {
        question: "Can I decode data URIs?",
        answer: "Yes. Paste a full data:image/png;base64,... string and the tool extracts MIME and bytes automatically.",
      },
    ],
    relatedSlugs: ["base64-encode", "hash-generator", "json-formatter", "url-decode", "uuid-generator"],
    whyHeading: "Why decode Base64 with ToolNest?",
    howToHeading: "How to decode Base64 online",
  },
  "url-encode": {
    title: "URL Encode Online Free — RFC 3986 Percent Encoder",
    metaDescription:
      "URL encode online for free. RFC 3986 component, URI, path, query & form modes. UTF-8 Unicode, live conversion, batch, URL inspector, history, REST API. Ultra URL Studio — 100% in-browser.",
    keywords: [
      "url encode",
      "url encoder",
      "url encode online",
      "percent encode",
      "encodeURIComponent",
      "encodeURI",
      "url encoding",
      "query string encode",
      "form urlencoded",
      "rfc 3986 encode",
      "unicode url encode",
      "utf-8 url encode",
      "encode url online free",
      "url escape",
      "percent encoding",
    ],
    h1: "URL Encode Online — Free Percent Encoder",
    tagline:
      "Percent-encode text, URLs, and query strings in your browser. RFC 3986 compliant with component, URI, path, query, and form modes.",
    intro:
      "ToolNest URL Encode is an enterprise Ultra URL Studio for developers and marketers. Encode plain text, full URLs, path segments, or query key=value pairs with RFC 3986 compliance. UTF-8 and Unicode (emoji, CJK) are encoded as proper percent bytes. Live conversion, batch lines, URL inspector, validation, local history, file import/export, and REST API — all without uploading your data.",
    features: [
      { title: "100% private", description: "Encoding runs in your browser — nothing sent to a server unless you use the API." },
      { title: "Six encode modes", description: "Component, URI, path, query string, form-urlencoded, and strict RFC 3986." },
      { title: "UTF-8 & Unicode", description: "Emoji, accents, and CJK encoded as correct multi-byte percent sequences." },
      { title: "Live conversion", description: "See output update as you type with optional debounced live mode." },
      { title: "URL inspector", description: "Parse protocol, host, path, query params, and encoding health." },
      { title: "Batch processing", description: "Encode or decode one value per line — export results." },
      { title: "Smart assist", description: "Detects URLs, query strings, double-encoding, and invalid % sequences." },
      { title: "REST API", description: "POST /api/v1/url for server-side automation." },
    ],
    steps: [
      { name: "Paste input", text: "Enter text, a URL, or query string — or import a .txt file." },
      { name: "Choose mode", text: "Pick Component for values, URI for full URLs, Query for key=value pairs." },
      { name: "Copy or export", text: "Copy, download, share, or save to local history." },
    ],
    faqs: [
      { question: "What is the difference between encodeURI and encodeURIComponent?", answer: "encodeURI (URI mode) preserves URL structure characters like / ? & =. Component mode encodes everything except unreserved characters — use it for query values." },
      { question: "Does this support Unicode?", answer: "Yes. Non-ASCII characters are UTF-8 encoded byte-by-byte per RFC 3986." },
      { question: "Is URL encoding free?", answer: "Yes. ToolNest URL Encode is free with no signup for browser use." },
    ],
    relatedSlugs: ["url-decode", "base64-encode", "json-formatter", "hash-generator", "uuid-generator"],
    whyHeading: "Why encode URLs with ToolNest?",
    howToHeading: "How to URL encode online",
  },
  "url-decode": {
    title: "URL Decode Online Free — Percent Decoder & Query Parser",
    metaDescription:
      "URL decode online for free. Decode percent-encoding, form data (+ spaces), auto-detect mode, batch, URL inspector, double-encoding detection. Ultra URL Studio — 100% in-browser.",
    keywords: [
      "url decode",
      "url decoder",
      "url decode online",
      "percent decode",
      "decodeURIComponent",
      "decodeURI",
      "url decoding",
      "decode query string",
      "form urlencoded decode",
      "decode percent encoding",
      "unicode url decode",
      "decode url online free",
      "unescape url",
      "percent decoding",
    ],
    h1: "URL Decode Online — Free Percent Decoder",
    tagline:
      "Decode percent-encoded text, query strings, and form data in your browser. Auto-detect mode handles component, URI, and + encoding.",
    intro:
      "ToolNest URL Decode unwraps percent-encoding safely in your browser. Paste encoded text, query strings, or full URLs — auto-detect tries component, form (+), and URI decoders. Validates % sequences, flags double-encoding, parses URL structure, and supports batch decode with file export. Optional REST API for pipelines.",
    features: [
      { title: "100% private", description: "Decoding runs locally — your data stays on your device." },
      { title: "Auto-detect", description: "Tries component, form, and URI decoders automatically." },
      { title: "Form data support", description: "Treats + as space for application/x-www-form-urlencoded." },
      { title: "Validation", description: "Detects invalid % sequences and possible double-encoding." },
      { title: "URL inspector", description: "Break down protocol, host, path, and query parameters." },
      { title: "Batch decode", description: "Decode many lines at once — export as text." },
      { title: "Smart assist", description: "Suggests correct mode when input looks plain or double-encoded." },
      { title: "REST API", description: "POST /api/v1/url with action decode for automation." },
    ],
    steps: [
      { name: "Paste encoded text", text: "Paste percent-encoded text, a query string, or URL." },
      { name: "Pick decode mode", text: "Use Auto-detect or Form mode for + as space." },
      { name: "Copy result", text: "Copy decoded text or export to a file." },
    ],
    faqs: [
      { question: "Why does decode fail?", answer: "Common causes: invalid % sequences (incomplete hex), wrong mode, or non-encoded plain text. Use Validate for details." },
      { question: "What is double-encoding?", answer: "Encoding already-encoded text (e.g. %20 becomes %2520). Decode twice or use smart assist hints." },
      { question: "Are files uploaded?", answer: "No for the browser studio. File import reads locally. The optional API sends strings to your server." },
    ],
    relatedSlugs: ["url-encode", "base64-decode", "json-formatter", "hash-generator", "uuid-generator"],
    whyHeading: "Why decode URLs with ToolNest?",
    howToHeading: "How to URL decode online",
  },
  "case-converter": {
    title: "Case Converter Online Free — Upper, Lower, Title, camelCase & More",
    metaDescription:
      "Convert text case online for free. 19 modes: UPPERCASE, lowercase, Title Case, camelCase, snake_case, kebab-case, Unicode, batch, DOCX/PDF import, stats, API. Ultra Case Studio — 100% in-browser.",
    keywords: [
      "case converter",
      "case converter online",
      "uppercase converter",
      "lowercase converter",
      "title case converter",
      "sentence case",
      "camelCase converter",
      "snake_case converter",
      "kebab-case converter",
      "pascal case",
      "text case changer",
      "convert case online free",
      "toggle case",
      "capitalize text online",
      "programming case converter",
    ],
    h1: "Case Converter Online — Free Text Case Changer",
    tagline:
      "Transform text between 19 case styles in your browser. Unicode-aware, with trim, sort, dedupe, file import, and live preview.",
    intro:
      "ToolNest Case Converter is an enterprise Ultra Case Studio for writers, developers, and data teams. Switch between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE, kebab-case, Train-Case, dot.case, path/case, and more. Import TXT, CSV, DOCX, or PDF; batch-convert lines; view detailed statistics; undo/redo; save local history — all without uploading your text.",
    features: [
      { title: "100% private", description: "Conversion runs in your browser — text never leaves your device unless you use the API." },
      { title: "19 case modes", description: "Basic, programming, and special cases including alternating and random." },
      { title: "Unicode & multilingual", description: "Locale-aware casing for Turkish, German, French, Japanese, and more." },
      { title: "File import", description: "Extract text from TXT, CSV, DOCX (Word), and PDF files client-side." },
      { title: "Text utilities", description: "Trim whitespace, collapse spaces, sort lines, remove duplicates." },
      { title: "Live preview", description: "Output updates as you type with optional debounced live mode." },
      { title: "Statistics", description: "Words, characters, sentences, case ratios, reading time." },
      { title: "REST API", description: "POST /api/v1/case for automated pipelines." },
    ],
    steps: [
      { name: "Enter text", text: "Paste text, load a sample, or import TXT, CSV, DOCX, or PDF." },
      { name: "Pick a case", text: "Click a preset — Title, camelCase, snake_case, or any of 19 modes." },
      { name: "Copy or export", text: "Copy, download TXT/CSV, share, or save to history." },
    ],
    faqs: [
      { question: "Is the case converter free?", answer: "Yes. ToolNest Case Converter is free with no signup for browser use." },
      { question: "Does it support camelCase and snake_case?", answer: "Yes. Programming modes split words on spaces, underscores, hyphens, and camelCase boundaries." },
      { question: "Can I import Word or PDF files?", answer: "Yes. DOCX and PDF text extraction runs locally in your browser." },
    ],
    relatedSlugs: ["word-counter", "remove-duplicates", "reverse-text", "url-encode", "json-formatter", "hash-generator"],
    whyHeading: "Why convert case with ToolNest?",
    howToHeading: "How to convert text case online",
  },
  "reverse-text": {
    title: "Reverse Text Online Free — Backwards Text Generator",
    metaDescription:
      "Reverse text online for free. Reverse characters, words, lines, sentences, mirror, upside-down Unicode, RTL, palindrome checker, batch, DOCX/PDF import, API. Ultra Reverse Studio — 100% in-browser.",
    keywords: [
      "reverse text",
      "reverse text online",
      "backwards text",
      "reverse string",
      "flip text",
      "mirror text",
      "upside down text",
      "reverse words",
      "reverse lines",
      "palindrome checker",
      "backwards text generator",
      "reverse text generator free",
      "rtl text",
      "unicode reverse text",
    ],
    h1: "Reverse Text Online — Free Backwards Text Tool",
    tagline:
      "Flip, mirror, and reverse text in your browser. Characters, words, lines, upside-down Unicode, RTL, and palindrome detection.",
    intro:
      "ToolNest Reverse Text is an enterprise Ultra Reverse Studio for developers, writers, and puzzle fans. Reverse characters (grapheme-aware for emoji), word order, sentences, lines, or paragraphs. Mirror text per line, generate upside-down Unicode, apply RTL bidi overrides, and check palindromes. Import TXT, CSV, DOCX, or PDF; batch-process lines; view statistics; undo/redo — all without uploading your text.",
    features: [
      { title: "100% private", description: "Reversal runs in your browser — text never leaves your device unless you use the API." },
      { title: "8 reverse modes", description: "Characters, words, sentences, lines, paragraphs, mirror, upside-down, RTL." },
      { title: "Emoji-safe", description: "Grapheme segmentation keeps multi-codepoint emoji intact when reversing." },
      { title: "Palindrome checker", description: "Exact, ignore-case, ignore-spaces, and ignore-punctuation analysis." },
      { title: "Whitespace control", description: "Preserve spacing layout when reversing words; trim lines optionally." },
      { title: "File import", description: "Extract text from TXT, CSV, DOCX, and PDF locally." },
      { title: "Live preview", description: "Output updates as you type with debounced live mode." },
      { title: "REST API", description: "POST /api/v1/reverse with optional palindrome check." },
    ],
    steps: [
      { name: "Enter text", text: "Paste text, load a sample, or import a file." },
      { name: "Choose mode", text: "Pick reverse characters, words, lines, upside-down, or RTL." },
      { name: "Copy or export", text: "Copy, download TXT/CSV, or save to local history." },
    ],
    faqs: [
      { question: "Is reverse text free?", answer: "Yes. ToolNest Reverse Text is free with no signup for browser use." },
      { question: "Does it break emoji?", answer: "No. Grapheme-aware mode uses Intl.Segmenter to reverse complete emoji clusters." },
      { question: "Can it check palindromes?", answer: "Yes. Open the Palindrome tab for exact and normalized palindrome detection." },
    ],
    relatedSlugs: ["case-converter", "word-counter", "remove-duplicates", "text-diff", "url-encode", "json-formatter"],
    whyHeading: "Why reverse text with ToolNest?",
    howToHeading: "How to reverse text online",
  },
  "remove-duplicates": {
    title: "Remove Duplicates Online Free — Dedupe Lines, CSV & JSON",
    metaDescription:
      "Remove duplicate lines online for free. Dedupe words, CSV rows, JSON objects, emails, URLs — exact & fuzzy match, highlight duplicates, batch, import/export, API. Ultra Dedupe Studio — 100% in-browser.",
    keywords: [
      "remove duplicates",
      "remove duplicate lines",
      "dedupe text online",
      "duplicate line remover",
      "remove duplicate words",
      "dedupe csv online",
      "remove duplicate json",
      "unique lines tool",
      "duplicate email remover",
      "fuzzy duplicate match",
      "remove duplicates free",
      "text deduplication tool",
      "list dedupe online",
    ],
    h1: "Remove Duplicates Online — Free Text Dedupe Tool",
    tagline:
      "Remove duplicate lines, words, CSV rows, and JSON objects in your browser. Exact or fuzzy matching with live preview and duplicate highlighting.",
    intro:
      "ToolNest Remove Duplicates is an enterprise Ultra Dedupe Studio for cleaning lists, spreadsheets, and data exports. Dedupe lines, words, sentences, paragraphs, CSV rows, or JSON array objects. Extract unique emails, URLs, or numbers. Use exact or fuzzy matching, case-sensitive or insensitive modes, keep first or last occurrence, and sort before or after removal. Highlight duplicates, batch-process blocks, import TXT/CSV/JSON/DOCX/PDF — all client-side.",
    features: [
      { title: "100% private", description: "Deduplication runs in your browser — data never uploaded unless you use the API." },
      { title: "10 dedupe modes", description: "Lines, words, sentences, paragraphs, CSV, JSON, emails, URLs, numbers, custom regex." },
      { title: "Fuzzy matching", description: "Catch typos and variants like colour/color with adjustable similarity threshold." },
      { title: "Duplicate highlighting", description: "Visual breakdown of kept vs removed entries with occurrence counts." },
      { title: "Flexible rules", description: "Case, punctuation, trim, keep first/last, sort before or after." },
      { title: "File import", description: "Load TXT, CSV, JSON, DOCX, and PDF text locally." },
      { title: "Batch blocks", description: "Separate sections with --- and dedupe each independently." },
      { title: "REST API", description: "POST /api/v1/dedupe for automated data cleaning." },
    ],
    steps: [
      { name: "Paste or import", text: "Enter a list, CSV, JSON array, or import a file." },
      { name: "Choose mode & rules", text: "Pick lines, JSON, emails, etc. Set fuzzy/exact and keep first or last." },
      { name: "Export unique output", text: "Copy, download, or review highlights before exporting." },
    ],
    faqs: [
      { question: "Is duplicate removal free?", answer: "Yes. ToolNest Remove Duplicates is free with no signup for browser use." },
      { question: "What is fuzzy matching?", answer: "Fuzzy mode treats similar strings (e.g. 92% match) as duplicates — useful for typos and spelling variants." },
      { question: "Can I dedupe JSON arrays?", answer: "Yes. Paste a JSON array — dedupe full objects or by a specific key field like id." },
    ],
    relatedSlugs: ["case-converter", "reverse-text", "word-counter", "json-formatter", "url-encode", "text-diff"],
    whyHeading: "Why remove duplicates with ToolNest?",
    howToHeading: "How to remove duplicate lines online",
  },
  "uuid-generator": {
    title: "UUID Generator Online Free — v1 v4 v7 Bulk UUID Tool",
    metaDescription:
      "Generate UUIDs online for free. v1, v3, v4, v5, v6, v7, v8, Nil & Max UUID. Bulk up to 1 million, validate, parse timestamps, export TXT/CSV/JSON/XML, QR code, REST API. 100% in-browser.",
    keywords: [
      "uuid generator",
      "uuid generator online",
      "generate uuid",
      "uuid v4 generator",
      "uuid v7 generator",
      "bulk uuid generator",
      "guid generator",
      "random uuid",
      "uuid validator",
      "uuid parser",
      "nil uuid",
      "uuid v5 namespace",
      "uuid bulk export",
      "cryptographic uuid",
      "rfc 4122 uuid",
      "uuid api",
    ],
    h1: "UUID Generator Online — Free Ultra UUID Studio",
    tagline:
      "Generate UUID v1–v8 in your browser. Bulk up to 1 million, validate, parse, export, and automate via API.",
    intro:
      "ToolNest UUID Generator is an enterprise Ultra UUID Studio for developers, QA engineers, and architects. Generate cryptographically secure v4 UUIDs, time-sortable v7, deterministic v3/v5 from namespaces, legacy v1/v6 timestamps, custom v8, Nil and Max sentinels. Bulk-generate up to one million IDs with chunked processing, validate and parse existing UUIDs, extract timestamps from v1/v6/v7, detect collisions, analyze entropy, export TXT/CSV/JSON/XML, generate QR codes, save history and favorites — all client-side with optional REST API.",
    features: [
      { title: "All RFC versions", description: "v1, v3, v4, v5, v6, v7, v8 plus Nil and Max UUID constants." },
      { title: "Bulk generation", description: "Generate up to 1,000,000 UUIDs with responsive chunked processing." },
      { title: "Multiple formats", description: "Standard, uppercase, no hyphens, braces, and URN output." },
      { title: "Validate & parse", description: "Detect version, variant, timestamps, clock seq, and node fields." },
      { title: "Namespace v3/v5", description: "DNS, URL, OID, X.500 presets or custom namespace UUID + name." },
      { title: "Collision & entropy", description: "Analyze duplicate IDs and estimated entropy in generated sets." },
      { title: "Export & QR", description: "Download TXT, CSV, JSON, XML and QR-encode the first UUID." },
      { title: "REST API", description: "POST /api/v1/uuid for server-side automation (up to 10k per request)." },
    ],
    steps: [
      { name: "Pick version", text: "Choose v4 (random), v7 (sortable), v5 (deterministic), or another RFC version." },
      { name: "Set quantity & format", text: "Enter count, output format, and namespace/name if using v3 or v5." },
      { name: "Generate & export", text: "Copy, download, validate existing UUIDs, or call the REST API." },
    ],
    faqs: [
      { question: "Which UUID version should I use?", answer: "Use v4 for general random IDs. Use v7 when you need time-sortable primary keys. Use v5 for deterministic IDs from a namespace + name." },
      { question: "Is generation secure?", answer: "v4/v7 use crypto.getRandomValues in your browser. Data never leaves your device unless you use the optional API." },
      { question: "Can I generate millions of UUIDs?", answer: "Yes. The browser studio supports up to 1,000,000 UUIDs with chunked processing to keep the UI responsive." },
    ],
    relatedSlugs: ["hash-generator", "checksum-gen", "password-gen", "base64-encode", "json-formatter", "qr-generator"],
    whyHeading: "Why generate UUIDs with ToolNest?",
    howToHeading: "How to generate UUIDs online",
  },
  "hash-generator": {
    title: "Hash Generator Online Free — MD5 SHA-256 SHA-512 BLAKE3 HMAC",
    metaDescription:
      "Hash generator online for free. MD5, SHA-1, SHA-2, SHA-3, BLAKE2, BLAKE3, RIPEMD-160, Whirlpool, CRC32, Adler-32, HMAC. File & text hashing, verify, batch, export, API. 100% in-browser.",
    keywords: [
      "hash generator",
      "md5 generator",
      "sha256 generator",
      "sha512 hash",
      "sha3 hash",
      "blake3 hash",
      "hmac generator",
      "file hash online",
      "checksum calculator",
      "crc32 calculator",
      "whirlpool hash",
      "ripemd160",
      "hash verify",
      "hash compare",
      "online hash tool",
    ],
    h1: "Hash Generator Online — Free Ultra Hash Studio",
    tagline:
      "Hash text and files with MD5, SHA-1/2/3, BLAKE2/3, RIPEMD, Whirlpool, CRC32, Adler-32, and HMAC — all in your browser.",
    intro:
      "ToolNest Hash Generator is an enterprise Ultra Hash Studio powered by audited @noble/hashes implementations. Compute digests and HMACs for text and files without uploading secrets. Select multiple algorithms at once, verify checksums, batch-hash lines, detect duplicate file digests, export TXT/CSV/JSON/XML, and automate via REST API.",
    features: [
      { title: "18+ algorithms", description: "MD5, SHA-1, SHA-224/256/384/512, SHA3, BLAKE2b/s, BLAKE3, RIPEMD-160, Whirlpool, CRC32, Adler-32." },
      { title: "HMAC support", description: "Compute HMAC-MD5, HMAC-SHA256, HMAC-BLAKE3, and more with your secret key." },
      { title: "File hashing", description: "Drag-and-drop multiple files — duplicate digest detection across uploads." },
      { title: "Live generation", description: "Real-time hashing as you type with debounced updates." },
      { title: "Verify & compare", description: "Paste an expected checksum to validate against computed hashes." },
      { title: "Batch lines", description: "Hash hundreds of strings — one per line with full algorithm suite." },
      { title: "Export formats", description: "Download results as TXT, CSV, JSON, or XML." },
      { title: "REST API", description: "POST /api/v1/hash for CI/CD and backend integration." },
    ],
    steps: [
      { name: "Choose algorithms", text: "Pick SHA-256, MD5, BLAKE3, or use a quick preset for SHA-2 all." },
      { name: "Enter text or files", text: "Type text, drop files, or paste batch lines." },
      { name: "Copy or verify", text: "Copy digests, export, or verify against a known checksum." },
    ],
    faqs: [
      { question: "Is hashing done locally?", answer: "Yes. The browser studio processes everything on your device. The optional API sends strings to your server." },
      { question: "Is MD5 secure?", answer: "MD5 is legacy and broken for collisions — use SHA-256 or SHA-512 for security. MD5 remains useful for non-crypto checksums." },
      { question: "What is HMAC?", answer: "HMAC combines a secret key with a hash function to authenticate messages — used in API signatures and JWT-like schemes." },
    ],
    relatedSlugs: ["checksum-gen", "uuid-generator", "password-gen", "base64-encode", "json-formatter", "qr-generator"],
    whyHeading: "Why hash with ToolNest?",
    howToHeading: "How to generate hashes online",
  },
  "text-to-speech": {
    title: "Text to Speech Online Free — Natural AI Voice Generator",
    metaDescription:
      "Text to speech online for free. 300+ neural voices, 100+ languages, emotion & SSML, speed/pitch control, MP3/WebM export, PDF/DOCX import, subtitles, chapters, REST API.",
    keywords: [
      "text to speech",
      "text to speech online",
      "tts",
      "tts online free",
      "natural voice generator",
      "ai voice",
      "read text aloud",
      "text to mp3",
      "neural voice",
      "ssml text to speech",
      "pdf to speech",
      "multilingual tts",
    ],
    h1: "Text to Speech Online — Free AI Voice Generator",
    tagline:
      "Convert text to natural speech with 300+ neural voices. Preview in-browser, export MP3, import documents, generate subtitles.",
    intro:
      "ToolNest Text to Speech is an enterprise Ultra TTS Studio powered by Microsoft Edge neural voices. Choose from hundreds of voices across 100+ language locales. Control speed, pitch, volume, and emotion presets. Preview instantly with your browser, export broadcast-quality MP3 or WebM, import TXT/CSV/JSON/DOCX/PDF, read web pages, split long text into chapters, generate WebVTT subtitles, and automate via REST API.",
    features: [
      { title: "300+ neural voices", description: "Microsoft Edge neural voices across 100+ languages and accents." },
      { title: "Browser preview", description: "Instant local preview with Web Speech API before cloud export." },
      { title: "MP3 & WebM export", description: "Download high-quality audio files for podcasts, videos, and accessibility." },
      { title: "Emotion & SSML", description: "Cheerful, calm, whisper presets plus raw SSML for fine control." },
      { title: "Document import", description: "Read PDF, DOCX, TXT, CSV, and JSON text locally." },
      { title: "Chapters & bookmarks", description: "Navigate long documents and export by section." },
      { title: "Subtitles", description: "Generate estimated WebVTT caption files." },
      { title: "REST API", description: "POST /api/v1/tts for automated speech synthesis." },
    ],
    steps: [
      { name: "Enter text", text: "Paste text, import a document, or load a web page URL." },
      { name: "Pick a voice", text: "Browse neural voices by language, gender, and emotion." },
      { name: "Preview & export", text: "Preview in browser, then download MP3 or batch ZIP." },
    ],
    faqs: [
      { question: "Is text to speech free?", answer: "Yes. Browser preview is free. Cloud MP3 export uses ToolNest's TTS API at no signup cost for reasonable use." },
      { question: "How many languages?", answer: "300+ neural voices covering 100+ language locales including English, Spanish, French, German, Turkish, Japanese, Arabic, and more." },
      { question: "Can I read PDF files?", answer: "Yes. PDF text is extracted locally in your browser before synthesis." },
    ],
    relatedSlugs: ["speech-to-text", "word-counter", "text-to-pdf", "remove-duplicates", "case-converter", "json-formatter"],
    whyHeading: "Why use ToolNest Text to Speech?",
    howToHeading: "How to convert text to speech online",
  },
  "pdf-resize-kb": {
    title: "Resize PDF in KB Online Free — Target PDF File Size",
    metaDescription:
      "Resize PDF to an exact target file size in KB or MB online for free. Auto-tunes DPI and JPEG quality to hit your size, before/after compare, encrypted PDF unlock, 100% in-browser — no upload.",
    keywords: [
      "resize pdf in kb",
      "compress pdf to specific size",
      "pdf to 100kb",
      "pdf to 200kb",
      "pdf to 500kb",
      "reduce pdf to 1mb",
      "pdf size reducer in kb",
      "pdf target size",
      "compress pdf to exact size",
      "pdf file size limiter",
      "make pdf smaller to upload",
      "pdf compressor to kb",
      "resize pdf online free",
      "pdf size for email",
      "pdf compressor target kb",
    ],
    h1: "Resize PDF in KB — Target File Size Online",
    tagline:
      "Shrink a PDF to an exact KB / MB target in your browser. The engine sweeps DPI and JPEG quality to hit your size, then shows a before/after preview — no signup.",
    intro:
      "ToolNest Resize PDF in KB is a focused Ultra PDF size-targeting studio that runs 100% in your browser. Pick a target size in B, KB or MB (or use a preset like 100 KB / 200 KB / 500 KB / 1 MB), and the engine walks a ladder of DPI and JPEG quality values to find the smallest output that lands at or below your target. Pages are rasterized with pdfjs-dist and re-embedded as JPEG via pdf-lib, with optional grayscale for extra savings and optional output encryption. Encrypted PDFs can be unlocked in-browser. Side-by-side before/after compare, live progress per attempt, and a server-side REST API at POST /api/v1/pdf/compress with targetBytes for CI/CD automation.",
    features: [
      { title: "100% private", description: "All rasterization and re-encoding runs locally — your PDF never leaves the browser unless you call the API." },
      { title: "Exact target size", description: "Specify a target in B, KB or MB; the engine returns the smallest result that hits it, or the closest match if unreachable." },
      { title: "Smart parameter sweep", description: "Walks DPI 144→72 and JPEG quality 85%→32% to balance visual quality against file size — no manual tuning needed." },
      { title: "Quick presets", description: "One-click 100 KB, 200 KB, 500 KB, 1 MB and 2 MB targets for common upload and email limits." },
      { title: "Grayscale + encryption", description: "Toggle grayscale for smaller scans; optionally password-protect the output PDF." },
      { title: "Before/after compare", description: "Side-by-side PDF preview with exact byte savings and attempt count." },
      { title: "Encrypted PDF input", description: "Unlock password-protected PDFs before resizing — the password never leaves your device." },
      { title: "REST API", description: "POST /api/v1/pdf/compress with options.targetBytes for server-side automation in CI/CD pipelines." },
    ],
    steps: [
      { name: "Upload PDF", text: "Drag-and-drop or browse. Unlock encrypted PDFs if prompted." },
      { name: "Set target size", text: "Enter a target in KB / MB or pick a preset. Toggle grayscale or output password in Options." },
      { name: "Resize & download", text: "Preview before/after, then download the resized PDF. Try a larger target if the closest match is still over." },
    ],
    faqs: [
      { question: "Is resizing PDF to a target KB free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is also available for automation." },
      { question: "Will the output look the same?", answer: "Pages are rasterized to hit the target, so text may soften at aggressive targets. Use a larger target for sharper output." },
      { question: "What if the target is unreachable?", answer: "The engine returns the smallest achievable file and labels it 'Closest match'. Raise the target or enable grayscale for better reach." },
      { question: "Are my PDFs uploaded?", answer: "No for the browser studio. The optional API only processes PDFs you explicitly send to it." },
    ],
    relatedSlugs: ["pdf-compress", "pdf-merge", "pdf-split", "image-resize-kb", "pdf-rotate", "image-to-pdf"],
    whyHeading: "Why resize PDF to a target size with ToolNest?",
    howToHeading: "How to resize a PDF to a specific KB online",
  },
  "image-resize-kb": {
    title: "Resize Image in KB Online Free — Target Image File Size",
    metaDescription:
      "Resize image to an exact target file size in KB or MB online for free. Binary-search quality tuning for JPG, PNG, WebP & AVIF, before/after preview, transparency & EXIF control — 100% in-browser.",
    keywords: [
      "resize image in kb",
      "compress image to specific size",
      "image to 50kb",
      "image to 100kb",
      "image to 200kb",
      "image to 500kb",
      "reduce image to 1mb",
      "image size reducer in kb",
      "image target size",
      "compress image to exact size",
      "jpg to 100kb",
      "png to 200kb",
      "webp to 100kb",
      "make image smaller to upload",
      "image size for form upload",
    ],
    h1: "Resize Image in KB — Target File Size Online",
    tagline:
      "Shrink an image to an exact KB / MB target in your browser. Binary-search quality tuning across JPG, PNG, WebP and AVIF with a live before/after preview — no signup.",
    intro:
      "ToolNest Resize Image in KB is a focused Ultra Image size-targeting studio that runs 100% in your browser. Pick a target size in B, KB or MB (or use a preset like 50 KB / 100 KB / 200 KB / 500 KB / 1 MB), and the engine runs a binary search on encoder quality to land at or below your target. Supports JPG, PNG, WebP and AVIF (browser-permitting), preserves transparency for alpha formats, lets you flatten to a custom background, and auto-suggests the best output format based on the source. Side-by-side before/after preview with a 'Within target' badge, last-result history, and a server-side REST API at POST /api/v1/image/compress with targetBytes for CI/CD automation.",
    features: [
      { title: "100% private", description: "All encoding runs locally via Canvas — your image never leaves the browser unless you call the API." },
      { title: "Exact target size", description: "Specify a target in B, KB or MB; binary-search quality control hits the target or returns the closest possible match." },
      { title: "Modern formats", description: "Encode to AVIF and WebP when supported, with automatic fallback to JPG/PNG — feature-detected per browser." },
      { title: "Quick presets", description: "One-click 50 KB, 100 KB, 200 KB, 500 KB and 1 MB targets for common form-upload and email limits." },
      { title: "Transparency control", description: "Preserve PNG/WebP/AVIF alpha or flatten to a chosen background color for JPG output." },
      { title: "Auto format suggestion", description: "Recommends JPG/PNG/WebP/AVIF based on source alpha and MIME — switch with one click." },
      { title: "Before/after preview", description: "Side-by-side panels with a 'Within target' or 'Closest match' badge and savings percentage." },
      { title: "REST API", description: "POST /api/v1/image/compress with options.targetBytes for server-side automation in CI/CD pipelines." },
    ],
    steps: [
      { name: "Upload image", text: "Drag-and-drop or browse. JPG, PNG, WebP, AVIF, GIF, BMP & SVG accepted." },
      { name: "Set target size", text: "Enter a target in KB / MB or pick a preset. Choose output format and transparency in Settings." },
      { name: "Resize & download", text: "Preview before/after, then download the resized image. Try a larger target if the closest match is still over." },
    ],
    faqs: [
      { question: "Is resizing image to a target KB free?", answer: "Yes — the in-browser studio is free with no signup. The optional REST API is also available for automation." },
      { question: "Can I hit an exact file size?", answer: "For lossy formats (JPG/WebP/AVIF) the binary search lands at or below your target. PNG is lossless, so the engine returns the closest pass." },
      { question: "What if the target is unreachable?", answer: "The engine returns the smallest achievable file and labels it 'Closest match'. Raise the target, switch to a lossy format, or downscale first." },
      { question: "Are my images uploaded?", answer: "No for the browser studio. The optional API only processes images you explicitly send to it." },
    ],
    relatedSlugs: ["image-compress", "image-resize", "image-convert", "image-watermark", "img-metadata", "pdf-resize-kb"],
    whyHeading: "Why resize images to a target KB with ToolNest?",
    howToHeading: "How to resize an image to a specific KB online",
  },
  "pan-card-resizer": {
    title: "PAN Card Resizer Online Free — Photo, Signature & Document for NSDL / UTIITSL",
    metaDescription:
      "Free PAN card resizer — resize photo, signature and document for NSDL & UTIITSL PAN card applications. Exact cm/px dimensions, target KB with high quality, drag-to-crop, 3-step wizard, 100% in-browser — no upload.",
    keywords: [
      "pan card resizer",
      "pan card photo resize",
      "pan card signature resize",
      "nsdl pan card resizer",
      "utiitsl pan card resizer",
      "pan card photo size",
      "pan card signature size",
      "pan card document resize",
      "nsdl photo size 3.5 x 4.5 cm",
      "pan card photo 50kb",
      "pan card signature 20kb",
      "resize photo for pan card",
      "pan card photo resizer online free",
      "pan card signature resizer online",
      "nsdl pan photo resizer",
      "utiitsl pan photo resizer",
      "pan card application photo size",
      "pan card photo dimensions",
      "pan card form photo resize",
      "pan card pdf resize",
    ],
    h1: "PAN Card Resizer — Photo, Signature & Document for NSDL / UTIITSL",
    tagline:
      "Resize your photo, signature, and documents to exact NSDL / UTIITSL PAN card specifications. Drag-to-crop, exact cm/px dimensions, target KB with high quality — all in your browser, no signup.",
    intro:
      "ToolNest PAN Card Resizer is a focused studio that prepares your files exactly to Indian PAN card application standards. Pick NSDL or UTIITSL, choose Photo / Signature / Document, and the tool applies the official dimensions (e.g. NSDL photo 3.5 × 4.5 cm = 213 × 274 px, signature 3.5 × 1.5 cm = 213 × 97 px, both under 50 KB / 20 KB). A 3-step wizard walks you through Upload → Requirement → Editor. In the Editor, drag to crop with the aspect ratio locked to your preset, then the engine rasterizes, binary-searches JPEG quality for the highest value that still fits your KB target, and downloads. Scanned PDF documents are compressed via a high-quality-first DPI/quality ladder to land under your byte budget. A Custom Editor tab lets you specify any cm/px dimensions and target KB for other government forms, exams, visas, and employer submissions. 100% client-side via Canvas + pdf-lib + pdfjs-dist — your files never leave the browser.",
    features: [
      { title: "NSDL & UTIITSL presets", description: "Official photo, signature and document specs for both PAN card authorities — dimensions and max KB pre-configured." },
      { title: "Drag-to-crop editor", description: "Visual crop selection with aspect-ratio locked to your preset — pick exactly the right region of a group photo or wide scan." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels (e.g. 213 × 274) then binary-searched for the highest JPEG quality that fits your KB budget — high quality by default." },
      { title: "PDF document support", description: "Scanned Aadhaar, proof of identity, or any supporting document compressed to your KB target via a high-quality-first DPI/quality ladder." },
      { title: "Custom editor", description: "Manually enter any cm/px dimensions, DPI, format and target KB — works for exams, visas, government forms, employer submissions." },
      { title: "100% private", description: "All processing runs locally via Canvas + pdf-lib + pdfjs-dist. Your PAN documents never leave your browser." },
      { title: "Encrypted PDF input", description: "Unlock password-protected PDFs in-browser — the password never leaves your device." },
      { title: "3-step wizard", description: "Upload → Requirement → Editor keeps the flow simple and foolproof for first-time applicants." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo, signature image, or scanned PDF (max 10 MB)." },
      { name: "Requirement", text: "Pick NSDL or UTIITSL, choose Photo / Signature / Document, and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop (if selected-area mode), then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the PAN Card Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What are the official NSDL photo dimensions?", answer: "NSDL photo is 3.5 × 4.5 cm (213 × 274 px at 150 DPI), max 50 KB. Signature is 3.5 × 1.5 cm (213 × 97 px), max 20 KB." },
      { question: "What are the UTIITSL photo dimensions?", answer: "UTIITSL photo is 4.5 × 3.5 cm (274 × 213 px), max 50 KB. Signature is 5.0 × 2.0 cm (305 × 122 px), max 20 KB." },
      { question: "Will the output hit my KB target exactly?", answer: "The engine binary-searches JPEG quality for the highest value that fits at or below your target. If the target is unreachable at exact dimensions, you'll get the closest possible match." },
      { question: "Are my PAN documents uploaded?", answer: "No. Everything runs locally in your browser via Canvas + pdf-lib + pdfjs-dist. The optional API is not used here." },
      { question: "Can I resize scanned PDF documents?", answer: "Yes — the Document type supports PDF and uses a high-quality-first DPI/quality ladder to land under your KB budget." },
    ],
    relatedSlugs: ["passport-photo-resizer", "visa-photo-resizer", "exam-photo-resizer", "aadhaar-pdf-resizer", "resume-photo-resizer", "voter-id-photo-resizer", "driving-licence-photo-resizer", "income-tax-photo-resizer", "image-resize-kb", "pdf-resize-kb", "image-compress"],
    whyHeading: "Why use ToolNest PAN Card Resizer?",
    howToHeading: "How to resize photo, signature & document for PAN card online",
  },
  "passport-photo-resizer": {
    title: "Passport Photo Resizer Online Free — Indian, US, UK, Schengen, China",
    metaDescription:
      "Free passport photo resizer — Indian, US, UK, Schengen, China passport & visa photo specs. Exact 35×45mm / 2×2 inch dimensions, target KB with high quality, drag-to-crop, 100% in-browser — no upload.",
    keywords: [
      "passport photo resizer",
      "passport photo size",
      "indian passport photo size",
      "us passport photo size",
      "passport photo 2x2 inch",
      "passport photo 35x45mm",
      "schengen visa photo size",
      "china visa photo size",
      "uk passport photo size",
      "passport photo dimensions",
      "passport photo 50kb",
      "passport photo resizer online free",
      "resize photo for passport",
      "passport photo 51x51mm",
      "passport application photo size",
      "passport photo maker",
      "passport photo crop tool",
      "passport size photo converter",
    ],
    h1: "Passport Photo Resizer — Indian, US, UK, Schengen, China",
    tagline:
      "Resize your photo for Indian, US, UK, Schengen, China passport & visa applications. Official mm dimensions, target KB with high quality, drag-to-crop — 100% in your browser.",
    intro:
      "ToolNest Passport Photo Resizer prepares your photo to the exact specifications required by passport authorities worldwide. Pick a variant (Indian Passport 2×2 inch / 51×51mm, US Passport 51×51mm, UK 35×45mm, Schengen 35×45mm, China 33×48mm), upload your photo, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that still fits your KB target — high quality by default. A Custom mode lets you specify any cm/px dimensions, DPI, format and target KB for other country specs. 100% client-side via Canvas — your photo never leaves the browser. Works for fresh passport applications, renewals, and visa submissions.",
    features: [
      { title: "5 country presets", description: "Indian, US, UK, Schengen, China passport & visa specs pre-configured — dimensions and max KB ready to use." },
      { title: "Drag-to-crop editor", description: "Visual crop selection with aspect-ratio locked to the official spec — pick exactly the right region of any photo." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels (e.g. 301 × 301 for 51×51mm) then binary-searched for the highest JPEG quality that fits your KB budget." },
      { title: "Custom dimensions", description: "Manually enter any cm/px dimensions, DPI, format and target KB for any other country's passport or visa spec." },
      { title: "100% private", description: "All processing runs locally via Canvas. Your passport photo never leaves your browser." },
      { title: "3-step wizard", description: "Upload → Requirement → Editor keeps the flow simple and foolproof." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo (JPG / PNG / WebP, max 10 MB)." },
      { name: "Requirement", text: "Pick your country preset (or enable Custom for manual dimensions), and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop (if selected-area mode), then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the Passport Photo Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the Indian passport photo size?", answer: "Indian passport photo is 2×2 inch (51×51 mm), typically under 50 KB. The Indian Passport preset enforces this spec." },
      { question: "What is the US passport photo size?", answer: "US passport / visa photo is 2×2 inch (51×51 mm), 600×600px minimum, max 240 KB. The US Passport preset enforces this spec." },
      { question: "What is the Schengen visa photo size?", answer: "Schengen visa photo is 35×45 mm with a light background, max 240 KB. The Schengen Visa preset enforces this spec." },
      { question: "Will the output hit my KB target exactly?", answer: "The engine binary-searches JPEG quality for the highest value that fits at or below your target. If unreachable at exact dimensions, you'll get the closest possible match." },
      { question: "Are my photos uploaded?", answer: "No. Everything runs locally in your browser via Canvas. Nothing leaves your device." },
    ],
    relatedSlugs: ["visa-photo-resizer", "pan-card-resizer", "exam-photo-resizer", "resume-photo-resizer", "image-resize-kb", "image-compress", "social-resizer"],
    whyHeading: "Why use ToolNest Passport Photo Resizer?",
    howToHeading: "How to resize a photo for passport online",
  },
  "visa-photo-resizer": {
    title: "Visa Photo Resizer Online Free — US, Schengen, UK, China, Australia, Japan",
    metaDescription:
      "Free visa photo resizer — US, Schengen, UK, China, Australia, Japan visa photo specs. Official mm dimensions, target KB with high quality, drag-to-crop, 100% in-browser — no upload.",
    keywords: [
      "visa photo resizer",
      "visa photo size",
      "us visa photo size",
      "schengen visa photo size",
      "uk visa photo size",
      "china visa photo size",
      "australia visa photo size",
      "japan visa photo size",
      "visa photo 2x2 inch",
      "visa photo 35x45mm",
      "visa photo dimensions",
      "visa photo resizer online free",
      "resize photo for visa",
      "visa application photo size",
      "visa photo 51x51mm",
      "visa photo maker",
      "visa photo crop tool",
    ],
    h1: "Visa Photo Resizer — US, Schengen, UK, China, Australia, Japan",
    tagline:
      "Resize photo for US, Schengen, UK, China, Australia, Japan visa applications — official mm dimensions, target KB with high quality, drag-to-crop — 100% in your browser.",
    intro:
      "ToolNest Visa Photo Resizer prepares your photo to the exact specifications required by embassies and consulates. Pick a destination (US 51×51mm, Schengen 35×45mm, UK 35×45mm, China 33×48mm, Australia 35×45mm, Japan 45×45mm), upload your photo, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. A Custom mode lets you specify any cm/px dimensions and target KB for any other country's visa spec. 100% client-side via Canvas — your photo never leaves the browser.",
    features: [
      { title: "6 country presets", description: "US, Schengen, UK, China, Australia, Japan visa photo specs pre-configured — dimensions and max KB ready to use." },
      { title: "Drag-to-crop editor", description: "Visual crop selection with aspect-ratio locked to the official spec." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels then binary-searched for the highest JPEG quality that fits your KB budget." },
      { title: "Custom dimensions", description: "Manually enter any cm/px dimensions, DPI, format and target KB for any other country's visa spec." },
      { title: "100% private", description: "All processing runs locally via Canvas. Your visa photo never leaves your browser." },
      { title: "3-step wizard", description: "Upload → Requirement → Editor keeps the flow simple." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo (JPG / PNG / WebP, max 10 MB)." },
      { name: "Requirement", text: "Pick your destination preset (or enable Custom for manual dimensions), and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop (if selected-area mode), then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the Visa Photo Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the US visa photo size?", answer: "US visa photo is 2×2 inch (51×51 mm), 600×600px minimum, max 240 KB." },
      { question: "What is the Schengen visa photo size?", answer: "Schengen visa photo is 35×45 mm with a light background, max 240 KB." },
      { question: "What is the China visa photo size?", answer: "China visa photo is 33×48 mm with a white background, max 100 KB." },
      { question: "Will the output hit my KB target exactly?", answer: "The engine binary-searches JPEG quality for the highest value that fits at or below your target." },
      { question: "Are my photos uploaded?", answer: "No. Everything runs locally in your browser via Canvas." },
    ],
    relatedSlugs: ["passport-photo-resizer", "pan-card-resizer", "exam-photo-resizer", "resume-photo-resizer", "image-resize-kb", "image-compress"],
    whyHeading: "Why use ToolNest Visa Photo Resizer?",
    howToHeading: "How to resize a photo for visa online",
  },
  "exam-photo-resizer": {
    title: "Exam Photo & Signature Resizer Online Free — UPSC, SSC, NEET, Banking, Railway",
    metaDescription:
      "Free exam photo & signature resizer — UPSC, SSC, NEET, IBPS, SBI, railway RRB & state PSC exam applications. 3.5×4.5cm photo + 3.5×1.5cm signature, target KB, drag-to-crop, 100% in-browser.",
    keywords: [
      "exam photo resizer",
      "exam photo size",
      "upsc photo size",
      "ssc photo size",
      "neet photo size",
      "ibps photo size",
      "sbi po photo size",
      "rrb photo size",
      "exam signature size",
      "exam photo 3.5 x 4.5 cm",
      "exam signature 3.5 x 1.5 cm",
      "exam photo 50kb",
      "exam signature 20kb",
      "exam photo resizer online free",
      "resize photo for exam form",
      "exam form photo resize",
      "ssc cgl photo resizer",
      "ibps po photo resizer",
    ],
    h1: "Exam Photo & Signature Resizer — UPSC, SSC, NEET, Banking, Railway",
    tagline:
      "Resize photo & signature for UPSC, SSC, NEET, banking, railway & other exam applications — 3.5×4.5cm photo + 3.5×1.5cm signature, target KB, 100% in your browser.",
    intro:
      "ToolNest Exam Photo & Signature Resizer prepares your photo and signature to the exact specifications required by Indian exam conducting bodies. Pick an exam (UPSC, SSC CGL/CHSL, NEET, banking IBPS/SBI, railway RRB) or the signature preset, upload your photo or scan, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. A Custom mode lets you specify any cm/px dimensions and target KB for any other exam or form. 100% client-side via Canvas — your files never leave the browser.",
    features: [
      { title: "5 exam presets + signature", description: "UPSC, SSC, NEET, Banking (IBPS/SBI), Railway (RRB) photo specs + a dedicated signature preset — dimensions and max KB ready to use." },
      { title: "Drag-to-crop editor", description: "Visual crop selection with aspect-ratio locked to the official spec." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels then binary-searched for the highest JPEG quality that fits your KB budget." },
      { title: "Custom dimensions", description: "Manually enter any cm/px dimensions, DPI, format and target KB for any other exam or form." },
      { title: "100% private", description: "All processing runs locally via Canvas. Your exam photo never leaves your browser." },
      { title: "3-step wizard", description: "Upload → Requirement → Editor keeps the flow simple." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo or scanned signature (JPG / PNG / WebP, max 10 MB)." },
      { name: "Requirement", text: "Pick your exam preset (or enable Custom for manual dimensions), and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop (if selected-area mode), then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the Exam Photo Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the UPSC photo size?", answer: "UPSC photo is 3.5 × 4.5 cm (213 × 274 px at 150 DPI), max 40 KB. The UPSC preset enforces this spec." },
      { question: "What is the SSC photo size?", answer: "SSC photo is 3.5 × 4.5 cm, max 30 KB. The SSC preset enforces this spec." },
      { question: "What is the NEET photo size?", answer: "NEET photo is 3.5 × 4.5 cm, max 80 KB per NTA specs. The NEET preset enforces this spec." },
      { question: "What is the exam signature size?", answer: "Most exam signatures are 3.5 × 1.5 cm (213 × 97 px), max 20 KB. The Signature preset enforces this spec." },
      { question: "Are my files uploaded?", answer: "No. Everything runs locally in your browser via Canvas." },
    ],
    relatedSlugs: ["pan-card-resizer", "passport-photo-resizer", "resume-photo-resizer", "image-resize-kb", "image-compress", "social-resizer"],
    whyHeading: "Why use ToolNest Exam Photo Resizer?",
    howToHeading: "How to resize photo & signature for exam online",
  },
  "aadhaar-pdf-resizer": {
    title: "Aadhaar PDF Resizer Online Free — Compress to 100/200/300/500 KB",
    metaDescription:
      "Free Aadhaar PDF resizer — compress your Aadhaar PDF to under 100, 200, 300 or 500 KB for online form uploads. High-quality-first DPI/quality ladder, password-protected PDF support, 100% in-browser.",
    keywords: [
      "aadhaar pdf resizer",
      "aadhaar pdf compressor",
      "aadhaar pdf size",
      "aadhaar card pdf 100kb",
      "aadhaar card pdf 200kb",
      "aadhaar pdf compress online",
      "compress aadhaar pdf",
      "aadhaar pdf under 100kb",
      "aadhaar pdf under 200kb",
      "aadhaar pdf under 300kb",
      "aadhaar pdf for online form",
      "aadhaar pdf kyc",
      "resize aadhaar pdf online free",
      "aadhaar pdf password unlock",
      "uidai aadhaar pdf compress",
      "aadhaar pdf size reducer",
    ],
    h1: "Aadhaar PDF Resizer — Compress to 100/200/300/500 KB",
    tagline:
      "Compress your Aadhaar PDF to under 100/200/300/500 KB for online form uploads — high-quality-first DPI/quality ladder, password-protected PDF support, 100% in your browser.",
    intro:
      "ToolNest Aadhaar PDF Resizer compresses your downloaded Aadhaar PDF (from UIDAI) to a target KB limit required by online forms — banking KYC, government schemes, telecom, school admissions, and more. Pick a target size (100 / 200 / 300 / 500 KB or custom), upload your Aadhaar PDF, and the engine runs a high-quality-first DPI/quality ladder search to land under your KB budget while keeping text crisp. Password-protected Aadhaar PDFs (the default from UIDAI, password = first 4 letters of your name in capitals + year of birth) are supported — the password is entered in-browser and never leaves your device. 100% client-side via pdf-lib + pdfjs-dist.",
    features: [
      { title: "4 KB presets", description: "100 / 200 / 300 / 500 KB targets pre-configured for common upload limits — plus a Custom mode for any KB target." },
      { title: "High-quality-first ladder", description: "The engine tries high DPI + high JPEG quality first, then steps down only as needed to land under your KB budget — keeping text crisp." },
      { title: "Password-protected PDF support", description: "Unlock UIDAI password-protected Aadhaar PDFs in-browser — the password never leaves your device." },
      { title: "Custom target", description: "Manually enter any KB target and DPI for non-standard upload limits." },
      { title: "100% private", description: "All processing runs locally via pdf-lib + pdfjs-dist. Your Aadhaar PDF never leaves your browser." },
      { title: "3-step wizard", description: "Upload → Requirement → Editor keeps the flow simple." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your Aadhaar PDF (max 10 MB). If password-protected, enter the password when prompted." },
      { name: "Requirement", text: "Pick a KB target preset (100 / 200 / 300 / 500 KB) or enable Custom for a manual KB target and DPI." },
      { name: "Editor", text: "Click Process & Download. The engine runs the high-quality-first DPI/quality ladder to land under your KB budget." },
    ],
    faqs: [
      { question: "Is the Aadhaar PDF Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the UIDAI Aadhaar PDF password?", answer: "The default password is the first 4 letters of your name in capitals (as on the Aadhaar) followed by your year of birth (YYYY). For example, RAHUL born 1990 → RAHU1990." },
      { question: "Will my Aadhaar PDF hit the KB target exactly?", answer: "The engine tries a high-quality-first DPI/quality ladder to land at or below your target. If unreachable, you'll get the closest possible match." },
      { question: "Is my Aadhaar PDF uploaded?", answer: "No. Everything runs locally in your browser via pdf-lib + pdfjs-dist. The password and PDF never leave your device." },
      { question: "Can I resize other PDFs (PAN, marksheets, etc.)?", answer: "Yes — this tool compresses any PDF. For PAN-related PDFs, see our PAN Card Resizer as well." },
    ],
    relatedSlugs: ["pan-card-resizer", "pdf-resize-kb", "pdf-compress", "image-resize-kb", "image-compress"],
    whyHeading: "Why use ToolNest Aadhaar PDF Resizer?",
    howToHeading: "How to compress Aadhaar PDF online",
  },
  "resume-photo-resizer": {
    title: "Resume Photo Resizer Online Free — Passport Size for Resume, CV, LinkedIn",
    metaDescription:
      "Free resume photo resizer — passport 35×45mm / 2×2 inch for resume, CV, LinkedIn & job applications. Target KB with high quality, drag-to-crop, 100% in-browser — no upload.",
    keywords: [
      "resume photo resizer",
      "resume photo size",
      "cv photo size",
      "passport size photo for resume",
      "resume photo 35x45mm",
      "resume photo 2x2 inch",
      "linkedin photo size",
      "resume photo dimensions",
      "resume photo 100kb",
      "resume photo resizer online free",
      "resize photo for resume",
      "resume photo maker",
      "cv photo resizer",
      "job application photo size",
      "passport photo for cv",
    ],
    h1: "Resume Photo Resizer — Passport Size for Resume, CV, LinkedIn",
    tagline:
      "Resize photo for resume, CV, LinkedIn & job application portals — passport 35×45mm / 2×2 inch, target KB with high quality, drag-to-crop — 100% in your browser.",
    intro:
      "ToolNest Resume Photo Resizer prepares your photo for resumes, CVs, LinkedIn profiles, and job application portals. Pick a variant (passport 35×45mm, US 2×2 inch, LinkedIn 8×8cm square, or a compact CV corner 25×30mm), upload your photo, drag to crop with the aspect ratio locked to the chosen spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. A Custom mode lets you specify any cm/px dimensions, DPI, format and target KB for any other resume or portal spec. 100% client-side via Canvas — your photo never leaves the browser.",
    features: [
      { title: "4 resume presets", description: "Passport 35×45mm, US 2×2 inch, LinkedIn 8×8cm, compact CV 25×30mm — dimensions and max KB ready to use." },
      { title: "Drag-to-crop editor", description: "Visual crop selection with aspect-ratio locked to the chosen spec." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels then binary-searched for the highest JPEG quality that fits your KB budget." },
      { title: "Custom dimensions", description: "Manually enter any cm/px dimensions, DPI, format and target KB for any other resume or portal spec." },
      { title: "100% private", description: "All processing runs locally via Canvas. Your photo never leaves your browser." },
      { title: "3-step wizard", description: "Upload → Requirement → Editor keeps the flow simple." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo (JPG / PNG / WebP, max 10 MB)." },
      { name: "Requirement", text: "Pick a preset (or enable Custom for manual dimensions), and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop (if selected-area mode), then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the Resume Photo Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the standard resume photo size?", answer: "Indian / European resumes use 35×45 mm passport size. US resumes use 2×2 inch (51×51 mm). LinkedIn uses an 8×8 cm square." },
      { question: "Will the output hit my KB target exactly?", answer: "The engine binary-searches JPEG quality for the highest value that fits at or below your target." },
      { question: "Are my photos uploaded?", answer: "No. Everything runs locally in your browser via Canvas." },
      { question: "Can I use this for LinkedIn profile photos?", answer: "Yes — pick the LinkedIn Square preset (8×8 cm, 100 KB)." },
    ],
    relatedSlugs: ["passport-photo-resizer", "visa-photo-resizer", "pan-card-resizer", "exam-photo-resizer", "image-resize-kb", "image-compress", "social-resizer"],
    whyHeading: "Why use ToolNest Resume Photo Resizer?",
    howToHeading: "How to resize a photo for resume online",
  },
  "voter-id-photo-resizer": {
    title: "Voter ID Photo Resizer Online Free — EPIC, Form 6/7/8, Overseas Elector",
    metaDescription:
      "Free Voter ID photo resizer — EPIC, Form 6 new voter registration, Form 7/8 correction & Overseas Elector applications. 35×45mm photo + 35×15mm signature, target KB, drag-to-crop, 100% in-browser.",
    keywords: [
      "voter id photo resizer",
      "voter id photo size",
      "epic photo size",
      "form 6 photo size",
      "form 8 photo size",
      "voter id signature size",
      "voter id photo 35x45mm",
      "voter id photo 50kb",
      "voter id signature 20kb",
      "election commission photo size",
      "voter id photo resizer online free",
      "resize photo for voter id",
      "voter id application photo size",
      "voter id photo dimensions",
      "form 6 photo resizer",
      "form 8 photo resizer",
      "overseas elector photo size",
      "voter card photo resize",
    ],
    h1: "Voter ID Photo Resizer — EPIC, Form 6/7/8, Overseas Elector",
    tagline:
      "Resize photo & signature for Voter ID (EPIC), Form 6/7/8 & Overseas Elector applications — Election Commission of India specs, target KB, drag-to-crop, 100% in your browser.",
    intro:
      "ToolNest Voter ID Photo Resizer prepares your photo and signature to the exact specifications required by the Election Commission of India (ECI) for voter registration. Pick a variant (EPIC photo 35×45mm, Form 6 photo, Form 8 photo, voter signature 35×15mm, Overseas Electors photo), upload your photo or scanned signature, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target — high quality by default. A Custom mode lets you specify any cm/px dimensions and target KB for any state-specific voter form. 100% client-side via Canvas — your files never leave the browser.",
    features: [
      { title: "5 ECI presets", description: "EPIC, Form 6, Form 8, Overseas Elector photo + voter signature — dimensions and max KB ready to use." },
      { title: "Advanced editor", description: "Drag-to-crop with 8 handles, aspect-ratio lock, straighten, rotate/flip, grid overlays, brightness/contrast/saturation/warmth/tint/sharpen/vignette, undo/redo, keyboard shortcuts, fullscreen." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels then binary-searched for the highest JPEG quality that fits your KB budget — high quality by default." },
      { title: "Enhancement presets", description: "One-click Auto fix, ID Photo, Brighten, Studio, Vivid, B&W, Warm, Cool — tune your photo before export." },
      { title: "Custom dimensions", description: "Manually enter any cm/px dimensions, DPI, format and target KB for any state-specific voter form." },
      { title: "100% private", description: "All processing runs locally via Canvas. Your voter photo never leaves your browser." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo or scanned signature (JPG / PNG / WebP, max 10 MB)." },
      { name: "Requirement", text: "Pick an ECI preset (EPIC / Form 6 / Form 8 / Signature / Overseas Elector) or enable Custom, and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop, straighten, apply enhancement presets or fine adjustments, then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the Voter ID Photo Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the Voter ID (EPIC) photo size?", answer: "EPIC photo is 35×45 mm, max 50 KB. The EPIC Photo preset enforces this spec." },
      { question: "What is the Form 6 photo size?", answer: "Form 6 (new voter registration) photo is 35×45 mm, max 50 KB. The Form 6 Photo preset enforces this spec." },
      { question: "What is the voter signature size?", answer: "Most voter forms accept a 35×15 mm signature, max 20 KB. The Voter Signature preset enforces this spec." },
      { question: "Will the output hit my KB target exactly?", answer: "The engine binary-searches JPEG quality for the highest value that fits at or below your target." },
      { question: "Are my files uploaded?", answer: "No. Everything runs locally in your browser via Canvas." },
    ],
    relatedSlugs: ["driving-licence-photo-resizer", "pan-card-resizer", "passport-photo-resizer", "exam-photo-resizer", "income-tax-photo-resizer", "image-resize-kb", "image-compress"],
    whyHeading: "Why use ToolNest Voter ID Photo Resizer?",
    howToHeading: "How to resize photo & signature for Voter ID online",
  },
  "driving-licence-photo-resizer": {
    title: "Driving Licence Photo Resizer Online Free — LL/DL, Sarathi Parivahan, RTO",
    metaDescription:
      "Free driving licence photo resizer — Learner (LL) & Permanent (DL) licence, Sarathi Parivahan & RTO applications. 30×40mm / 35×45mm photo + 35×15mm signature, target KB, drag-to-crop, 100% in-browser.",
    keywords: [
      "driving licence photo resizer",
      "driving licence photo size",
      "ll photo size",
      "dl photo size",
      "sarathi parivahan photo size",
      "rto photo size",
      "driving licence signature size",
      "driving licence photo 30x40mm",
      "driving licence photo 35x45mm",
      "driving licence photo 50kb",
      "driving licence signature 20kb",
      "driving licence photo resizer online free",
      "resize photo for driving licence",
      "learner licence photo size",
      "permanent licence photo size",
      "sarathi photo resizer",
      "rto photo resizer",
      "dl photo dimensions",
    ],
    h1: "Driving Licence Photo Resizer — LL/DL, Sarathi Parivahan, RTO",
    tagline:
      "Resize photo & signature for Learner / Permanent driving licence (LL/DL), Sarathi Parivahan & RTO applications — official cm dimensions, target KB, drag-to-crop, 100% in your browser.",
    intro:
      "ToolNest Driving Licence Photo Resizer prepares your photo and signature to the exact specifications required by RTOs and the Sarathi Parivahan portal for Learner's Licence (LL) and Permanent Driving Licence (DL) applications. Pick a variant (LL/DL photo 30×40mm, passport 35×45mm, Sarathi portal photo, DL signature 35×15mm, LL test photo), upload your photo or scanned signature, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. A Custom mode lets you specify any cm/px dimensions and target KB for any state RTO spec. 100% client-side via Canvas — your files never leave the browser.",
    features: [
      { title: "5 RTO presets", description: "LL/DL photo 30×40mm, passport 35×45mm, Sarathi Parivahan, DL signature, LL test photo — dimensions and max KB ready to use." },
      { title: "Advanced editor", description: "Drag-to-crop with 8 handles, aspect-ratio lock, straighten, rotate/flip, grid overlays, brightness/contrast/saturation/warmth/tint/sharpen/vignette, undo/redo, keyboard shortcuts, fullscreen." },
      { title: "Exact dimensions + target KB", description: "Output is resized to exact pixels then binary-searched for the highest JPEG quality that fits your KB budget." },
      { title: "Enhancement presets", description: "One-click Auto fix, ID Photo, Brighten, Studio, Vivid, B&W, Warm, Cool — tune your photo before export." },
      { title: "Custom dimensions", description: "Manually enter any cm/px dimensions, DPI, format and target KB for any state RTO spec." },
      { title: "100% private", description: "All processing runs locally via Canvas. Your licence photo never leaves your browser." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo or scanned signature (JPG / PNG / WebP, max 10 MB)." },
      { name: "Requirement", text: "Pick an RTO preset (LL/DL / Passport / Sarathi / Signature / LL Test) or enable Custom, and choose Resize Original or Resize Selected Area." },
      { name: "Editor", text: "Drag to crop, straighten, apply enhancement presets or fine adjustments, then click Process & Download. The engine hits your exact dimensions and KB target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the Driving Licence Photo Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the LL/DL photo size?", answer: "Standard RTO photo is 30×40 mm, max 50 KB. Most RTOs also accept a passport 35×45 mm photo. Both presets are available." },
      { question: "What is the Sarathi Parivahan photo size?", answer: "Sarathi portal photo is 35×45 mm, max 30 KB. The Sarathi Parivahan preset enforces this spec." },
      { question: "What is the DL signature size?", answer: "DL signature is 35×15 mm, max 20 KB. The DL Signature preset enforces this spec." },
      { question: "Will the output hit my KB target exactly?", answer: "The engine binary-searches JPEG quality for the highest value that fits at or below your target." },
      { question: "Are my files uploaded?", answer: "No. Everything runs locally in your browser via Canvas." },
    ],
    relatedSlugs: ["voter-id-photo-resizer", "pan-card-resizer", "passport-photo-resizer", "exam-photo-resizer", "income-tax-photo-resizer", "image-resize-kb", "image-compress"],
    whyHeading: "Why use ToolNest Driving Licence Photo Resizer?",
    howToHeading: "How to resize photo & signature for driving licence online",
  },
  "income-tax-photo-resizer": {
    title: "ITR Photo & Document Resizer Online Free — Income Tax Portal, PDF under 1/2/5 MB",
    metaDescription:
      "Free ITR photo & document resizer — Income Tax Return portal profile photo, signature & PDF document compression (under 1/2/5 MB). Target KB, drag-to-crop, password-protected PDF support, 100% in-browser.",
    keywords: [
      "itr photo resizer",
      "itr photo size",
      "income tax photo size",
      "itr signature size",
      "itr document resizer",
      "itr pdf compress",
      "income tax portal photo size",
      "itr profile photo",
      "itr signature resizer",
      "itr pdf under 1mb",
      "itr pdf under 2mb",
      "itr pdf under 5mb",
      "form 16 pdf compress",
      "aadhaar pdf for itr",
      "itr document upload size",
      "income tax return photo resizer",
      "itr photo 35x45mm",
      "itr signature 35x15mm",
    ],
    h1: "ITR Photo & Document Resizer — Income Tax Portal, PDF under 1/2/5 MB",
    tagline:
      "Resize photo, signature & documents for the Income Tax Return (ITR) portal — profile photo, signature, and PDF document compression (under 1/2/5 MB), target KB, drag-to-crop, 100% in your browser.",
    intro:
      "ToolNest ITR Photo & Document Resizer prepares your photo, signature, and supporting documents for the Income Tax Return (ITR) e-filing portal. Pick a variant (profile photo 35×45mm, signature 35×15mm, or PDF document compression to under 1/2/5 MB), upload your image or PDF, drag to crop with the aspect ratio locked to the official spec (for images), and the engine either binary-searches JPEG quality for the highest value that fits your KB target (images) or runs a high-quality-first DPI/quality ladder (PDFs). Password-protected PDFs are supported — the password is entered in-browser and never leaves your device. A Custom mode lets you specify any cm/px dimensions, KB target, or DPI. 100% client-side via Canvas + pdf-lib + pdfjs-dist — your files never leave the browser.",
    features: [
      { title: "5 ITR presets", description: "Profile photo 35×45mm, signature 35×15mm, and PDF document compression to under 1 / 2 / 5 MB — dimensions and max KB ready to use." },
      { title: "Smart file-type routing", description: "Upload a photo → see photo presets. Upload a PDF → see PDF compression presets. The tool auto-filters variants by file type." },
      { title: "Advanced editor (images)", description: "Drag-to-crop with 8 handles, aspect-ratio lock, straighten, rotate/flip, grid overlays, brightness/contrast/saturation/warmth/tint/sharpen/vignette, undo/redo, keyboard shortcuts, fullscreen." },
      { title: "PDF compression ladder (PDFs)", description: "High-quality-first DPI/quality ladder search to land under your KB/MB budget while keeping text crisp — works for Form 16, Aadhaar, PAN, 26AS, salary slips, receipts." },
      { title: "Password-protected PDF support", description: "Unlock password-protected PDFs in-browser — the password never leaves your device." },
      { title: "Custom dimensions / target", description: "Manually enter any cm/px dimensions, DPI, format and KB target, or any PDF KB/MB target." },
      { title: "100% private", description: "All processing runs locally via Canvas + pdf-lib + pdfjs-dist. Your ITR documents never leave your browser." },
    ],
    steps: [
      { name: "Upload", text: "Drag-and-drop or browse for your photo, scanned signature, or PDF document (max 10 MB). If password-protected, enter the password when prompted." },
      { name: "Requirement", text: "Pick an ITR preset (Profile Photo / Signature / PDF under 1 MB / 2 MB / 5 MB) or enable Custom. Variants auto-filter to match your uploaded file type." },
      { name: "Editor", text: "For images: drag to crop, straighten, apply enhancement presets or fine adjustments, then Process & Download. For PDFs: pick DPI and click Process & Download. The engine hits your target with the highest quality that fits." },
    ],
    faqs: [
      { question: "Is the ITR Photo & Document Resizer free?", answer: "Yes — completely free with no signup. All processing runs in your browser." },
      { question: "What is the ITR profile photo size?", answer: "ITR portal profile photo is 35×45 mm, max 50 KB. The Profile Photo preset enforces this spec." },
      { question: "What is the ITR signature size?", answer: "ITR signature is 35×15 mm, max 20 KB. The Signature preset enforces this spec." },
      { question: "What PDF size limits does the ITR portal accept?", answer: "The ITR e-filing portal typically accepts document attachments up to 5 MB per file. We offer 1 / 2 / 5 MB presets plus Custom for any other limit." },
      { question: "Can I compress Form 16 / Aadhaar / 26AS PDFs?", answer: "Yes — upload the PDF, pick a PDF preset (under 1/2/5 MB), and the engine runs a high-quality-first DPI/quality ladder to land under your budget." },
      { question: "Are my ITR documents uploaded?", answer: "No. Everything runs locally in your browser via Canvas + pdf-lib + pdfjs-dist. The password and PDF never leave your device." },
    ],
    relatedSlugs: ["aadhaar-pdf-resizer", "pan-card-resizer", "voter-id-photo-resizer", "driving-licence-photo-resizer", "pdf-resize-kb", "pdf-compress", "image-resize-kb"],
    whyHeading: "Why use ToolNest ITR Photo & Document Resizer?",
    howToHeading: "How to resize photo, signature & documents for ITR online",
  },
  "password-gen": {
    title: "Password Generator Online Free — Secure, Diceware, Wi-Fi & PIN Generator",
    metaDescription:
      "Free online password generator with cryptographic Web Crypto RNG, Diceware passphrases, pronounceable passwords, PIN & Wi-Fi QR generator, bulk generation, entropy & crack-time meter, HIBP breach check, QR codes, TXT/CSV/JSON/PDF export, history, favorites & REST API — 100% in-browser.",
    keywords: [
      "password generator",
      "random password generator",
      "strong password generator",
      "secure password generator",
      "diceware password generator",
      "passphrase generator",
      "memorable password generator",
      "pronounceable password generator",
      "pin generator",
      "wifi password generator",
      "wifi qr code generator",
      "bulk password generator",
      "password entropy calculator",
      "password strength meter",
      "have i been pwned",
      "hibp password check",
      "breach password check",
      "password generator with qr",
      "password generator export csv",
      "password generator api",
      "cryptographically secure password",
      "web crypto password",
      "password generator 1password alternative",
      "bitwarden password generator alternative",
      "dashlane password generator alternative",
      "lastpass password generator alternative",
      "nordpass password generator alternative",
      "password generator free no signup",
      "password generator offline",
      "password generator in browser",
      "password generator hindi",
      "password generator spanish",
      "password generator german",
      "password generator french",
      "password generator multilingual",
      "exclude similar characters",
      "exclude ambiguous characters",
      "wpa2 password generator",
      "wpa3 password generator",
      "password generator 1024 characters",
    ],
    h1: "Password Generator Online — Secure, Diceware, Wi-Fi, PIN & Bulk Generator",
    tagline:
      "Generate cryptographically-secure passwords, Diceware passphrases, pronounceable passwords, PINs and Wi-Fi passwords with QR codes — all in your browser, free, no signup.",
    intro:
      "ToolNest Password Generator is a world-class Ultra Password Studio that runs entirely in your browser using the Web Crypto API (`crypto.getRandomValues`) with rejection sampling for a uniform distribution — no `Math.random()` shortcut, no modulo bias. Five modes: Random (full charset pool 1–1024 chars), Passphrase (Diceware-style memorable words with optional number/symbol suffix), Pronounceable (CV-CVC syllable pattern), PIN (1–32 digits), and Wi-Fi (WPA-2/3 friendly charset, ≤63 chars, generates a scannable Wi-Fi QR for guests). Customize uppercase, lowercase, numbers, symbols, custom characters; exclude visually similar (l 1 I O 0) and ambiguous ({ } [ ] / \\) characters; guarantee one character from each enabled set; bulk generate up to 10,000 passwords at once. The strength meter reports bits of entropy, pool size, score (0–4 zxcvbn-style bucket), and an estimated offline-GPU crack time (10¹⁰ guesses/sec). HIBP k-anonymity breach check (SHA-1 prefix search — your password never leaves the browser). QR codes for both raw passwords and Wi-Fi QR payloads (WIFI:T:WPA;S:SSID;P:password;;). AI recommendations analyse your settings and suggest length/charset/passphrase improvements. Export TXT, CSV (with per-password entropy), JSON, and PDF (jsPDF). Local history (last 50), favorites, eight UI languages (English, Spanish, German, French, Turkish, Hindi, Portuguese, Japanese), dark/light mode, full keyboard accessibility, and a server-side REST API at POST /api/v1/password for CI/CD pipelines.",
    features: [
      { title: "Cryptographically secure", description: "Web Crypto `crypto.getRandomValues` with rejection sampling guarantees a uniform distribution — no modulo bias, no `Math.random()`." },
      { title: "Five generation modes", description: "Random, Diceware passphrase (memorable words), pronounceable (CV-CVC syllables), PIN (digits), Wi-Fi (WPA-2/3 friendly ≤63 chars)." },
      { title: "Up to 1024 characters", description: "Slider 1–256 plus a numeric input up to 1024 — for service tokens, API secrets, and long random keys." },
      { title: "Diceware passphrase", description: "Built-in curated memorable wordlist (~9.5 bits/word), customizable word count, separator, capitalization, number & symbol suffix." },
      { title: "Wi-Fi QR generator", description: "Generates WPA-2/3 friendly passwords and a scannable Wi-Fi QR (WIFI: URI scheme) — guests just scan to connect." },
      { title: "Bulk generation", description: "Generate up to 10,000 passwords at once with per-password entropy & score, then export to TXT/CSV/JSON/PDF." },
      { title: "Entropy & crack-time meter", description: "Reports bits of entropy, pool size, strength score (0–4), and estimated offline-GPU crack time at 10¹⁰ guesses/sec." },
      { title: "HIBP breach check", description: "K-anonymity SHA-1 prefix search against Have I Been Pwned — only the first 5 hex chars leave the browser, never the password itself." },
      { title: "AI recommendations", description: "Analyzes your settings and suggests length, charset, or passphrase improvements with one-click apply." },
      { title: "QR codes", description: "Generates QR for raw passwords (scan to import into a password manager) and Wi-Fi QR (scan to join network) via the `qrcode` library." },
      { title: "Export to TXT/CSV/JSON/PDF", description: "Bulk or single export — CSV includes per-password entropy, PDF uses jsPDF with monospaced wrapping for long passwords." },
      { title: "REST API", description: "POST /api/v1/password with options + count returns passwords with entropy, score, crackLabel, optional breach check and AI recommendations." },
    ],
    steps: [
      { name: "Pick a mode", text: "Choose Random, Passphrase, Pronounceable, PIN or Wi-Fi — each tuned for its use case." },
      { name: "Tune options", text: "Set length / word count, toggle charsets, exclusions, separator, SSID. AI recommendations update live." },
      { name: "Generate & share", text: "Copy, scan QR, check breaches, bulk-generate, export to TXT/CSV/JSON/PDF, or call the REST API." },
    ],
    faqs: [
      { question: "Is this password generator free?", answer: "Yes — the in-browser studio is free with no signup. The REST API is also available for automation." },
      { question: "Are passwords sent anywhere?", answer: "No. All generation runs locally via Web Crypto. The optional breach check sends only the first 5 chars of a SHA-1 hash (k-anonymity)." },
      { question: "How is randomness generated?", answer: "We use `crypto.getRandomValues` with rejection sampling to eliminate modulo bias — the same primitive password managers use." },
      { question: "How much entropy do I need?", answer: "Aim for 80+ bits for high-value accounts, 128+ for cold storage / service tokens. A 20-char random password with all 4 charsets is ~131 bits." },
      { question: "What's the best mode for humans?", answer: "Passphrases — 5–7 memorable words give 45–63 bits of entropy and are far easier to remember and type than random symbols." },
      { question: "Can I generate Wi-Fi QR codes?", answer: "Yes — switch to Wi-Fi mode, enter your SSID, generate a WPA-2/3 password, and a scannable QR appears automatically." },
    ],
    relatedSlugs: ["qr-generator", "uuid-generator", "hash-generator", "checksum-gen", "base64-encode", "pdf-protect"],
    whyHeading: "Why generate passwords with ToolNest?",
    howToHeading: "How to generate a strong password online",
  },
  "qr-generator": {
    title: "QR Code Generator Online Free — Custom Logo, Wi-Fi, vCard & Bulk QR",
    metaDescription:
      "Free QR code generator with 30+ types — URL, Wi-Fi, vCard, email, SMS, WhatsApp, crypto, social, calendar. Custom colors, gradients, logos, rounded modules, frames, bulk CSV/ZIP, PNG/SVG/PDF/WEBP export, scan test, history & REST API — 100% in-browser.",
    keywords: [
      "qr code generator",
      "free qr code generator",
      "qr code maker",
      "custom qr code",
      "qr code with logo",
      "wifi qr code generator",
      "vcard qr code",
      "bulk qr code generator",
      "qr code png download",
      "qr code svg",
      "qr code pdf",
      "dynamic qr code",
      "qr code designer",
      "gradient qr code",
      "rounded qr code",
      "qr code error correction",
      "whatsapp qr code",
      "bitcoin qr code",
      "upi qr code",
      "google maps qr code",
      "calendar qr code generator",
      "qr code monkey alternative",
      "qr tiger alternative",
      "canva qr alternative",
      "bitly qr alternative",
      "qr code generator no signup",
      "qr code generator offline",
      "qr code generator in browser",
      "qr code bulk csv",
      "qr code api",
      "instagram qr code",
      "telegram qr code",
      "zoom qr code",
      "app store qr code",
      "transparent qr code",
      "scan me qr code",
      "qr code frame template",
      "qr code hindi",
      "qr code spanish",
      "qr code multilingual",
    ],
    h1: "QR Code Generator Online — Custom Logo, Wi-Fi, vCard & 30+ Types",
    tagline:
      "Create beautiful, scannable QR codes in your browser — 30+ content types, custom colors, gradients, logos, frames, bulk CSV/ZIP, PNG/SVG/PDF export, scan test & REST API.",
    intro:
      "ToolNest QR Code Generator is a world-class Ultra QR Studio that runs entirely in your browser using qrcode + a custom matrix renderer. Choose from 30+ content types: URL, plain text, Wi-Fi (WPA/WEP/open), vCard contact, email (mailto:), SMS, phone (tel:), WhatsApp, Telegram, Zoom, Google Meet, Google Maps, GPS geo, Instagram/Facebook/X/LinkedIn/TikTok/YouTube, calendar events (iCalendar), Bitcoin/Ethereum wallets, UPI payments, PDF/image/video/audio/menu/form/API links, App Store & Google Play. Design with custom foreground/background colors, linear gradients, transparent background, square/rounded/dots module styles, square/rounded/circle finder eyes, border/card/banner frames with custom text, logo overlay (auto-bumps error correction to H), and L/M/Q/H error correction. Live preview updates as you type; stats show QR version, byte capacity, module count and scannability rating. Export PNG, SVG, WEBP, JPG, PDF, or EPS; bulk-generate from CSV (label,content) into a ZIP; test scanability with the browser BarcodeDetector API; copy encoded payload; AI design recommendations; six design presets (Classic, Modern Indigo, Dark Mode, Scan Me Banner, Forest, Sunset). Local history (50 entries), favorites, eight UI languages, dark/light mode, full keyboard accessibility, and a server-side REST API at POST /api/v1/qr/generate for CI/CD automation.",
    features: [
      { title: "30+ content types", description: "URL, text, Wi-Fi, vCard, email, SMS, phone, WhatsApp, Telegram, Zoom, Meet, Maps, geo, 6 social networks, calendar, Bitcoin, Ethereum, UPI, media links, App Store & Play Store." },
      { title: "Custom matrix renderer", description: "Square, rounded, and dot modules; square, rounded, and circle finder eyes — not just basic black squares." },
      { title: "Brand styling", description: "Custom colors, linear gradients, transparent background, logo overlay with auto error-correction bump, border/card/banner frames." },
      { title: "Error correction L/M/Q/H", description: "Choose 7–30% redundancy — use H when embedding logos for reliable scanning." },
      { title: "Bulk CSV → ZIP", description: "Import label,content CSV and download hundreds of styled PNGs in one ZIP archive." },
      { title: "Multi-format export", description: "PNG, SVG (vector modules), WEBP, JPG, PDF (print-ready via jsPDF), EPS — up to 2048px." },
      { title: "Live scan test", description: "BarcodeDetector API verifies the generated QR decodes to the expected payload in supported browsers." },
      { title: "AI design tips", description: "Analyzes capacity, logo size, error correction, and export size — one-click apply for optimal scannability." },
      { title: "Six design presets", description: "Classic, Modern Indigo, Dark Mode, Scan Me Banner, Forest, and Sunset — starting points for any brand." },
      { title: "100% private", description: "QR generation runs locally in your browser. The optional REST API only processes data you explicitly send." },
      { title: "History & favorites", description: "Last 50 generated QR codes saved locally with thumbnails — re-download anytime." },
      { title: "REST API", description: "POST /api/v1/qr/generate with type, content, design, format — PNG/SVG/WEBP/JPG/PDF for automation pipelines." },
    ],
    steps: [
      { name: "Pick content type", text: "Choose URL, Wi-Fi, vCard, social, crypto, calendar, or 20+ other types — each with a tailored form." },
      { name: "Design & brand", text: "Apply a preset or customize colors, gradient, modules, eyes, frame, logo, error correction, and export size." },
      { name: "Export & share", text: "Download PNG/SVG/PDF, bulk-generate from CSV, run scan test, copy payload, or call the REST API." },
    ],
    faqs: [
      { question: "Is this QR generator free?", answer: "Yes — the in-browser studio is free with no signup. The REST API is also available for automation." },
      { question: "Are QR codes generated locally?", answer: "Yes. All browser generation runs on your device via qrcode + canvas. Nothing is uploaded unless you use the API." },
      { question: "Can I add my logo?", answer: "Yes — upload PNG/JPG and keep logo under 25% of QR area. Error correction auto-bumps to H for reliable scanning." },
      { question: "Which export format for print?", answer: "Use PNG at 512–2048px or PDF for print-ready output. SVG gives vector modules for large-format signage." },
      { question: "How does bulk generation work?", answer: "Prepare a CSV with label,content columns, import it, and download a ZIP of PNGs using your current design settings." },
      { question: "Wi-Fi QR — how do guests connect?", answer: "Enter SSID and password, generate the QR, and guests scan with their phone camera — no typing needed." },
    ],
    relatedSlugs: ["password-gen", "uuid-generator", "hash-generator", "base64-encode", "checksum-gen", "pdf-merge"],
    whyHeading: "Why generate QR codes with ToolNest?",
    howToHeading: "How to create a QR code online",
  },
};

export function getToolSeoConfig(slug: string): ToolSeoConfig | null {
  return TOOL_SEO[slug] ?? null;
}
