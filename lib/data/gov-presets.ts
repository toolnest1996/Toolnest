/**
 * Preset configurations for government-service photo / signature / document
 * resizers. Each preset lists one or more "variants" — official dimension +
 * max-KB specs for a specific application. The generic GovPhotoResizer
 * component reads these and drives a 3-step wizard + the PanCardEditor.
 */

export interface GovVariant {
  label: string;
  /** Width in centimeters (0 for PDF-only presets) */
  cmW: number;
  /** Height in centimeters (0 for PDF-only presets) */
  cmH: number;
  /** Max file size in KB */
  maxKb: number;
  /** Resolution used to convert cm → pixels */
  dpi: number;
  hint: string;
}

export interface GovPreset {
  slug: string;
  name: string;
  tagline: string;
  intro: string;
  /** If true, the tool accepts PDF uploads and compresses them via the PDF ladder. */
  supportsDocument: boolean;
  /** If true, the tool ONLY accepts PDFs (no image uploads). Implies supportsDocument. */
  pdfOnly: boolean;
  /** If true, the tool also offers a manual "Custom" mode. */
  supportsCustom: boolean;
  variants: GovVariant[];
}

/** cm → px helper (1 inch = 2.54 cm). */
export function cmToPx(cm: number, dpi: number): number {
  return Math.round((cm / 2.54) * dpi);
}

export const GOV_PRESETS: Record<string, GovPreset> = {
  "passport-photo-resizer": {
    slug: "passport-photo-resizer",
    name: "Passport Photo Resizer",
    tagline:
      "Resize your photo for Indian, US, UK, Schengen, China passport & visa applications. Official mm dimensions, target KB with high quality, drag-to-crop — 100% in your browser.",
    intro:
      "ToolNest Passport Photo Resizer prepares your photo to the exact specifications required by passport authorities worldwide. Pick a variant (Indian Passport 2×2 inch, US Passport 51×51mm, Schengen 35×45mm, China 33×48mm, UK 35×45mm), upload your photo, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that still fits your KB target — high quality by default. 100% client-side via Canvas — your photo never leaves the browser. Works for fresh passport applications, renewals, and visa submissions.",
    supportsDocument: false,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      {
        label: "Indian Passport",
        cmW: 5.1,
        cmH: 5.1,
        maxKb: 50,
        dpi: 150,
        hint: "2×2 inch (51×51 mm) — white background, recent, color",
      },
      {
        label: "US Passport / Visa",
        cmW: 5.1,
        cmH: 5.1,
        maxKb: 240,
        dpi: 150,
        hint: "2×2 inch (51×51 mm) — white background, 600×600px minimum",
      },
      {
        label: "UK Passport",
        cmW: 3.5,
        cmH: 4.5,
        maxKb: 50,
        dpi: 150,
        hint: "35×45 mm — light grey/cream background",
      },
      {
        label: "Schengen Visa",
        cmW: 3.5,
        cmH: 4.5,
        maxKb: 240,
        dpi: 150,
        hint: "35×45 mm — neutral expression, light background",
      },
      {
        label: "China Visa",
        cmW: 3.3,
        cmH: 4.8,
        maxKb: 100,
        dpi: 150,
        hint: "33×48 mm — white background only",
      },
    ],
  },

  "visa-photo-resizer": {
    slug: "visa-photo-resizer",
    name: "Visa Photo Resizer",
    tagline:
      "Resize photo for US, Schengen, UK, China, Australia, Japan visa applications — official mm dimensions, target KB with high quality, drag-to-crop — 100% in your browser.",
    intro:
      "ToolNest Visa Photo Resizer prepares your photo to the exact specifications required by embassies and consulates. Pick a destination (US 51×51mm, Schengen 35×45mm, UK 35×45mm, China 33×48mm, Australia 35×45mm, Japan 45×45mm), upload your photo, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. 100% client-side via Canvas — your photo never leaves the browser.",
    supportsDocument: false,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      { label: "US Visa", cmW: 5.1, cmH: 5.1, maxKb: 240, dpi: 150, hint: "51×51 mm (2×2 in) — white background" },
      { label: "Schengen Visa", cmW: 3.5, cmH: 4.5, maxKb: 240, dpi: 150, hint: "35×45 mm — light background" },
      { label: "UK Visa", cmW: 3.5, cmH: 4.5, maxKb: 50, dpi: 150, hint: "35×45 mm — light grey/cream background" },
      { label: "China Visa", cmW: 3.3, cmH: 4.8, maxKb: 100, dpi: 150, hint: "33×48 mm — white background only" },
      { label: "Australia Visa", cmW: 3.5, cmH: 4.5, maxKb: 500, dpi: 150, hint: "35×45 mm — neutral background" },
      { label: "Japan Visa", cmW: 4.5, cmH: 4.5, maxKb: 100, dpi: 150, hint: "45×45 mm — white background" },
    ],
  },

  "exam-photo-resizer": {
    slug: "exam-photo-resizer",
    name: "Exam Photo & Signature Resizer",
    tagline:
      "Resize photo & signature for UPSC, SSC, NEET, banking, railway & other exam applications — 3.5×4.5cm photo + 3.5×1.5cm signature, target KB, 100% in your browser.",
    intro:
      "ToolNest Exam Photo & Signature Resizer prepares your photo and signature to the exact specifications required by Indian exam conducting bodies. Pick an exam (UPSC, SSC CGL/CHSL, NEET, banking IBPS/SBI, railway RRB, state PSC) or the signature preset, upload your photo or scan, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. 100% client-side via Canvas — your files never leave the browser.",
    supportsDocument: false,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      { label: "UPSC Photo", cmW: 3.5, cmH: 4.5, maxKb: 40, dpi: 150, hint: "35×45 mm — recent color photo" },
      { label: "SSC Photo", cmW: 3.5, cmH: 4.5, maxKb: 30, dpi: 150, hint: "35×45 mm — recent color photo" },
      { label: "NEET Photo", cmW: 3.5, cmH: 4.5, maxKb: 80, dpi: 150, hint: "35×45 mm — recent color, NTA specs" },
      { label: "Banking (IBPS/SBI)", cmW: 4.5, cmH: 3.5, maxKb: 50, dpi: 150, hint: "45×35 mm — recent color" },
      { label: "Railway (RRB)", cmW: 3.5, cmH: 4.5, maxKb: 40, dpi: 150, hint: "35×45 mm — recent color" },
      { label: "Signature", cmW: 3.5, cmH: 1.5, maxKb: 20, dpi: 150, hint: "35×15 mm — black ink on white paper" },
    ],
  },

  "aadhaar-pdf-resizer": {
    slug: "aadhaar-pdf-resizer",
    name: "Aadhaar PDF Resizer",
    tagline:
      "Compress your Aadhaar PDF to under 100/200/300/500 KB for online form uploads — high-quality-first DPI/quality ladder, password-protected PDF support, 100% in your browser.",
    intro:
      "ToolNest Aadhaar PDF Resizer compresses your downloaded Aadhaar PDF (from UIDAI) to a target KB limit required by online forms — banking KYC, government schemes, telecom, school admissions, and more. Pick a target size (100 / 200 / 300 / 500 KB or custom), upload your Aadhaar PDF, and the engine runs a high-quality-first DPI/quality ladder search to land under your KB budget while keeping text crisp. Password-protected Aadhaar PDFs are supported — the password is entered in-browser and never leaves your device. 100% client-side via pdf-lib + pdfjs-dist.",
    supportsDocument: true,
    pdfOnly: true,
    supportsCustom: true,
    variants: [
      { label: "Under 100 KB", cmW: 0, cmH: 0, maxKb: 100, dpi: 150, hint: "Strictest target — aggressive DPI/quality" },
      { label: "Under 200 KB", cmW: 0, cmH: 0, maxKb: 200, dpi: 150, hint: "Common KYC upload limit" },
      { label: "Under 300 KB", cmW: 0, cmH: 0, maxKb: 300, dpi: 150, hint: "Government form default" },
      { label: "Under 500 KB", cmW: 0, cmH: 0, maxKb: 500, dpi: 200, hint: "Higher quality, larger forms" },
    ],
  },

  "resume-photo-resizer": {
    slug: "resume-photo-resizer",
    name: "Resume Photo Resizer",
    tagline:
      "Resize photo for resume, CV, LinkedIn & job applications — passport 35×45mm / 2×2 inch, target KB with high quality, drag-to-crop — 100% in your browser.",
    intro:
      "ToolNest Resume Photo Resizer prepares your photo for resumes, CVs, LinkedIn profiles, and job application portals. Pick a variant (passport 35×45mm, US 2×2 inch, LinkedIn 8×8cm square), upload your photo, drag to crop with the aspect ratio locked to the chosen spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. 100% client-side via Canvas — your photo never leaves the browser.",
    supportsDocument: false,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      { label: "Passport (35×45mm)", cmW: 3.5, cmH: 4.5, maxKb: 100, dpi: 150, hint: "Indian / European resume standard" },
      { label: "Passport (2×2 inch)", cmW: 5.1, cmH: 5.1, maxKb: 100, dpi: 150, hint: "US resume standard" },
      { label: "LinkedIn Square", cmW: 8.0, cmH: 8.0, maxKb: 100, dpi: 150, hint: "8×8 cm — LinkedIn profile photo" },
      { label: "CV Small", cmW: 2.5, cmH: 3.0, maxKb: 50, dpi: 150, hint: "25×30 mm — compact resume corner" },
    ],
  },

  "voter-id-photo-resizer": {
    slug: "voter-id-photo-resizer",
    name: "Voter ID Photo Resizer",
    tagline:
      "Resize photo & signature for Voter ID (EPIC), Form 6 new voter registration, Form 7/8 correction — Election Commission of India specs, target KB, drag-to-crop, 100% in your browser.",
    intro:
      "ToolNest Voter ID Photo Resizer prepares your photo and signature to the exact specifications required by the Election Commission of India (ECI) for voter registration. Pick a variant (EPIC photo, Form 6 photo, Form 6/8 signature, Overseas Electors photo), upload your photo or scanned signature, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. A Custom mode lets you specify any cm/px dimensions and target KB for any other state-specific voter form. 100% client-side via Canvas — your files never leave the browser.",
    supportsDocument: false,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      { label: "EPIC Photo", cmW: 3.5, cmH: 4.5, maxKb: 50, dpi: 150, hint: "35×45 mm — Voter ID card photo" },
      { label: "Form 6 Photo", cmW: 3.5, cmH: 4.5, maxKb: 50, dpi: 150, hint: "35×45 mm — new voter registration" },
      { label: "Form 8 Photo", cmW: 3.5, cmH: 4.5, maxKb: 50, dpi: 150, hint: "35×45 mm — correction / transfer" },
      { label: "Voter Signature", cmW: 3.5, cmH: 1.5, maxKb: 20, dpi: 150, hint: "35×15 mm — black ink on white paper" },
      { label: "Overseas Elector", cmW: 3.5, cmH: 4.5, maxKb: 100, dpi: 150, hint: "35×45 mm — NRI voter registration" },
    ],
  },

  "driving-licence-photo-resizer": {
    slug: "driving-licence-photo-resizer",
    name: "Driving Licence Photo Resizer",
    tagline:
      "Resize photo & signature for Learner / Permanent driving licence (LL/DL), Sarathi Parivahan & RTO applications — official cm dimensions, target KB, drag-to-crop, 100% in your browser.",
    intro:
      "ToolNest Driving Licence Photo Resizer prepares your photo and signature to the exact specifications required by RTOs and the Sarathi Parivahan portal for Learner's Licence (LL) and Permanent Driving Licence (DL) applications. Pick a variant (LL/DL photo 30×40mm, passport 35×45mm, signature 35×15mm, Sarathi portal photo), upload your photo or scanned signature, drag to crop with the aspect ratio locked to the official spec, and the engine binary-searches JPEG quality for the highest value that fits your KB target. A Custom mode lets you specify any cm/px dimensions and target KB for any state RTO spec. 100% client-side via Canvas — your files never leave the browser.",
    supportsDocument: false,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      { label: "LL/DL Photo (30×40mm)", cmW: 3.0, cmH: 4.0, maxKb: 50, dpi: 150, hint: "30×40 mm — standard RTO photo" },
      { label: "Passport Photo (35×45mm)", cmW: 3.5, cmH: 4.5, maxKb: 50, dpi: 150, hint: "35×45 mm — accepted by most RTOs" },
      { label: "Sarathi Parivahan", cmW: 3.5, cmH: 4.5, maxKb: 30, dpi: 150, hint: "35×45 mm — Sarathi portal upload" },
      { label: "DL Signature", cmW: 3.5, cmH: 1.5, maxKb: 20, dpi: 150, hint: "35×15 mm — black ink on white paper" },
      { label: "LL Test Photo", cmW: 3.5, cmH: 4.5, maxKb: 40, dpi: 150, hint: "35×45 mm — learner licence test" },
    ],
  },

  "income-tax-photo-resizer": {
    slug: "income-tax-photo-resizer",
    name: "ITR Photo & Document Resizer",
    tagline:
      "Resize photo, signature & documents for the Income Tax Return (ITR) portal — profile photo, signature, and PDF document compression (under 1/2/5 MB), target KB, drag-to-crop, 100% in your browser.",
    intro:
      "ToolNest ITR Photo & Document Resizer prepares your photo, signature, and supporting documents for the Income Tax Return (ITR) e-filing portal. Pick a variant (profile photo 35×45mm, signature 35×15mm, or PDF document compression to under 1/2/5 MB), upload your image or PDF, drag to crop with the aspect ratio locked to the official spec (for images), and the engine either binary-searches JPEG quality for the highest value that fits your KB target (images) or runs a high-quality-first DPI/quality ladder (PDFs). Password-protected PDFs are supported — the password is entered in-browser and never leaves your device. A Custom mode lets you specify any cm/px dimensions, KB target, or DPI. 100% client-side via Canvas + pdf-lib + pdfjs-dist — your files never leave the browser.",
    supportsDocument: true,
    pdfOnly: false,
    supportsCustom: true,
    variants: [
      { label: "Profile Photo", cmW: 3.5, cmH: 4.5, maxKb: 50, dpi: 150, hint: "35×45 mm — ITR profile photo" },
      { label: "Signature", cmW: 3.5, cmH: 1.5, maxKb: 20, dpi: 150, hint: "35×15 mm — black ink on white paper" },
      { label: "Document PDF · under 1 MB", cmW: 0, cmH: 0, maxKb: 1024, dpi: 150, hint: "Form 16 / Aadhaar / PAN PDF → < 1 MB" },
      { label: "Document PDF · under 2 MB", cmW: 0, cmH: 0, maxKb: 2048, dpi: 150, hint: "Salary slip / 26AS / receipt → < 2 MB" },
      { label: "Document PDF · under 5 MB", cmW: 0, cmH: 0, maxKb: 5120, dpi: 200, hint: "Larger attachments → < 5 MB" },
    ],
  },
};

/** Live (implemented) slugs — used by implementations.ts and dynamic-tool.tsx. */
export const GOV_LIVE_SLUGS = Object.keys(GOV_PRESETS);

/** All government-services tool slugs (live + coming soon), for category listings. */
export const GOV_ALL_SLUGS = GOV_LIVE_SLUGS;
