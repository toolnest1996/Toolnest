"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const loading = () => (
  <div className="flex items-center justify-center py-16">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

function lazy<T extends ComponentType>(loader: () => Promise<{ default: T }>) {
  return dynamic(loader, { loading, ssr: false });
}

const Base64Encode = lazy(() =>
  import("./base64-studio").then((m) => ({
    default: function Base64EncodeTool() {
      return <m.Base64Studio defaultOperation="encode" />;
    },
  })),
);

const Base64Decode = lazy(() =>
  import("./base64-studio").then((m) => ({
    default: function Base64DecodeTool() {
      return <m.Base64Studio defaultOperation="decode" />;
    },
  })),
);

const UrlEncode = lazy(() =>
  import("./url-encode-studio").then((m) => ({
    default: function UrlEncodeTool() {
      return <m.UrlEncodeStudio defaultOperation="encode" />;
    },
  })),
);

const UrlDecode = lazy(() =>
  import("./url-encode-studio").then((m) => ({
    default: function UrlDecodeTool() {
      return <m.UrlEncodeStudio defaultOperation="decode" />;
    },
  })),
);

const TxtToPdf = lazy(() =>
  import("./text-to-pdf").then((m) => ({
    default: function TxtToPdfTool() {
      return <m.TextToPdf fromFile />;
    },
  })),
);

const ImageCompress = lazy(() =>
  import("./image-compressor").then((m) => ({
    default: m.ImageCompressor,
  })),
);

const SvgToPng = lazy(() =>
  import("./image-studio").then((m) => ({
    default: function SvgToPngTool() {
      return <m.ImageStudio accept=".svg,image/svg+xml" defaultFormat="image/png" />;
    },
  })),
);

const SocialResizer = lazy(() =>
  import("./image-studio").then((m) => ({
    default: function SocialResizerTool() {
      return <m.ImageStudio showSocialPresets />;
    },
  })),
);

const UuidGenerator = lazy(() =>
  import("./uuid-generator-studio").then((m) => ({
    default: m.UuidGeneratorStudio,
  })),
);

const HashGenerator = lazy(() =>
  import("./hash-generator-studio").then((m) => ({
    default: m.HashGeneratorStudio,
  })),
);

const WordToPdf = lazy(() =>
  import("./word-to-pdf").then((m) => ({
    default: m.WordToPdf,
  })),
);

const TextToSpeech = lazy(() =>
  import("./tts-studio").then((m) => ({
    default: m.TtsStudio,
  })),
);

const TOOL_MAP: Record<string, ComponentType> = {
  "pdf-merge": lazy(() => import("./pdf-merge").then((m) => ({ default: m.PdfMerge }))),
  "pdf-split": lazy(() => import("./pdf-split").then((m) => ({ default: m.PdfSplit }))),
  "pdf-compress": lazy(() => import("./pdf-compress").then((m) => ({ default: m.PdfCompress }))),
  "pdf-rotate": lazy(() => import("./pdf-rotate").then((m) => ({ default: m.PdfRotate }))),
  "pdf-watermark": lazy(() => import("./text-to-pdf").then((m) => ({ default: m.TextToPdf }))),
  "pdf-page-numbers": lazy(() => import("./text-to-pdf").then((m) => ({ default: m.TextToPdf }))),
  "pdf-metadata": lazy(() => import("./text-to-pdf").then((m) => ({ default: m.TextToPdf }))),
  "word-counter": lazy(() => import("./word-counter").then((m) => ({ default: m.WordCounter }))),
  "text-diff": lazy(() => import("./text-diff").then((m) => ({ default: m.TextDiff }))),
  "text-to-speech": TextToSpeech,
  "text-to-pdf": lazy(() => import("./text-to-pdf").then((m) => ({ default: m.TextToPdf }))),
  "txt-to-pdf": TxtToPdf,
  "json-formatter": lazy(() => import("./json-formatter").then((m) => ({ default: m.JsonFormatter }))),
  "base64-encode": Base64Encode,
  "base64-decode": Base64Decode,
  "url-encode": UrlEncode,
  "url-decode": UrlDecode,
  "case-converter": lazy(() => import("./case-converter-studio").then((m) => ({ default: m.CaseConverterStudio }))),
  "reverse-text": lazy(() => import("./reverse-text-studio").then((m) => ({ default: m.ReverseTextStudio }))),
  "remove-duplicates": lazy(() =>
    import("./remove-duplicates-studio").then((m) => ({ default: m.RemoveDuplicatesStudio })),
  ),
  "uuid-generator": UuidGenerator,
  "hash-generator": HashGenerator,
  "password-gen": lazy(() => import("./password-generator").then((m) => ({ default: m.PasswordGenerator }))),
  "qr-generator": lazy(() => import("./qr-generator").then((m) => ({ default: m.QrGenerator }))),
  "checksum-gen": lazy(() => import("./checksum-generator").then((m) => ({ default: m.ChecksumGenerator }))),
  "color-palette": lazy(() => import("./color-palette").then((m) => ({ default: m.ColorPalette }))),
  "gradient-gen": lazy(() => import("./gradient-generator").then((m) => ({ default: m.GradientGenerator }))),
  "favicon-gen": lazy(() => import("./favicon-generator").then((m) => ({ default: m.FaviconGenerator }))),
  "image-compress": ImageCompress,
  "image-resize": lazy(() => import("./image-resize").then((m) => ({ default: m.ImageResize }))),
  "image-crop": lazy(() => import("./image-crop").then((m) => ({ default: m.ImageCrop }))),
  "image-convert": lazy(() => import("./image-studio").then((m) => ({ default: m.ImageStudio }))),
  "image-rotate": lazy(() => import("./image-studio").then((m) => ({ default: m.ImageStudio }))),
  "image-editor": lazy(() => import("./image-studio").then((m) => ({ default: m.ImageStudio }))),
  "image-watermark": lazy(() => import("./image-studio").then((m) => ({ default: m.ImageStudio }))),
  "svg-to-png": SvgToPng,
  "social-resizer": SocialResizer,
  "color-picker": lazy(() => import("./color-picker").then((m) => ({ default: m.ColorPicker }))),
  "image-merger": lazy(() => import("./image-merger").then((m) => ({ default: m.ImageMerger }))),
  "image-to-pdf": lazy(() => import("./images-to-pdf").then((m) => ({ default: m.ImagesToPdf }))),
  "img-metadata": lazy(() => import("./image-studio").then((m) => ({ default: m.ImageStudio }))),
  "youtube-thumbnail": lazy(() => import("./youtube-thumbnail").then((m) => ({ default: m.YoutubeThumbnail }))),
  "pdf-to-word": lazy(() => import("./pdf-to-word").then((m) => ({ default: m.PdfToWord }))),
  "pdf-to-excel": lazy(() => import("./pdf-to-excel").then((m) => ({ default: m.PdfToExcel }))),
  "word-to-pdf": WordToPdf,
  "image-resize-kb": lazy(() => import("./image-resize-kb").then((m) => ({ default: m.ImageResizeKb }))),
  "pdf-resize-kb": lazy(() => import("./pdf-resize-kb").then((m) => ({ default: m.PdfResizeKb }))),
  "pan-card-resizer": lazy(() => import("./pan-card-resizer").then((m) => ({ default: m.PanCardResizer }))),
  "passport-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function PassportPhotoResizer() {
        return <m.GovPhotoResizer slug="passport-photo-resizer" />;
      },
    })),
  ),
  "visa-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function VisaPhotoResizer() {
        return <m.GovPhotoResizer slug="visa-photo-resizer" />;
      },
    })),
  ),
  "exam-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function ExamPhotoResizer() {
        return <m.GovPhotoResizer slug="exam-photo-resizer" />;
      },
    })),
  ),
  "aadhaar-pdf-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function AadhaarPdfResizer() {
        return <m.GovPhotoResizer slug="aadhaar-pdf-resizer" />;
      },
    })),
  ),
  "resume-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function ResumePhotoResizer() {
        return <m.GovPhotoResizer slug="resume-photo-resizer" />;
      },
    })),
  ),
  "voter-id-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function VoterIdPhotoResizer() {
        return <m.GovPhotoResizer slug="voter-id-photo-resizer" />;
      },
    })),
  ),
  "driving-licence-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function DrivingLicencePhotoResizer() {
        return <m.GovPhotoResizer slug="driving-licence-photo-resizer" />;
      },
    })),
  ),
  "income-tax-photo-resizer": lazy(() =>
    import("./gov-photo-resizer").then((m) => ({
      default: function IncomeTaxPhotoResizer() {
        return <m.GovPhotoResizer slug="income-tax-photo-resizer" />;
      },
    })),
  ),
};

export function hasTool(slug: string): boolean {
  return slug in TOOL_MAP;
}

export function DynamicTool({ slug }: { slug: string }) {
  const Comp = TOOL_MAP[slug];
  if (!Comp) return null;
  return <Comp />;
}

/** @deprecated Use hasTool + DynamicTool */
export function getToolComponent(slug: string) {
  return hasTool(slug) ? true : null;
}
