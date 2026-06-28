import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "text/plain": "txt",
  "application/json": "json",
  "text/csv": "csv",
};

/** Safe download name — keeps existing extensions (.pdf, .zip, .png, …). */
export function sanitizeFilename(name: string, fallbackExt = "pdf"): string {
  const base = (name.trim() || "download").replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-");
  if (/\.[a-z0-9]{2,8}$/i.test(base)) return base;
  return `${base}.${fallbackExt}`;
}

function extensionForMime(type: string): string | undefined {
  return MIME_EXTENSIONS[type.toLowerCase()];
}

/** Match filename extension to blob MIME (fixes .zip.pdf, missing ext, etc.). */
export function resolveDownloadFilename(filename: string, blob: Blob): string {
  const mimeExt = blob.type ? extensionForMime(blob.type) : undefined;
  let safe = sanitizeFilename(filename, mimeExt ?? "pdf");

  if (mimeExt === "zip") {
    safe = safe.replace(/\.pdf$/i, "");
    if (!/\.zip$/i.test(safe)) {
      const stem = safe.replace(/\.[a-z0-9]{2,8}$/i, "") || safe;
      safe = `${stem}.zip`;
    }
  } else if (mimeExt === "pdf") {
    safe = safe.replace(/\.zip$/i, "");
    if (!/\.pdf$/i.test(safe)) {
      const stem = safe.replace(/\.[a-z0-9]{2,8}$/i, "") || safe;
      safe = `${stem}.pdf`;
    }
  }

  return safe;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const name = resolveDownloadFilename(filename, blob);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
