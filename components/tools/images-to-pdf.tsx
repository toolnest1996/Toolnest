"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDrop, Field, inputClass } from "./shared";
import { downloadBlob, sanitizeFilename } from "@/lib/utils";

export function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageMode, setPageMode] = useState<"fit" | "a4">("fit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const pdf = await PDFDocument.create();
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let img;
        if (file.type.includes("png")) {
          img = await pdf.embedPng(bytes);
        } else if (file.type.includes("jpeg") || file.type.includes("jpg")) {
          img = await pdf.embedJpg(bytes);
        } else {
          // Convert other formats (webp, etc.) to PNG via canvas.
          const bmp = await createImageBitmap(file);
          const canvas = document.createElement("canvas");
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          canvas.getContext("2d")!.drawImage(bmp, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          const pngBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
          img = await pdf.embedPng(pngBytes);
        }

        if (pageMode === "a4") {
          const page = pdf.addPage([595.28, 841.89]);
          const margin = 30;
          const maxW = page.getWidth() - margin * 2;
          const maxH = page.getHeight() - margin * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, {
            x: (page.getWidth() - w) / 2,
            y: (page.getHeight() - h) / 2,
            width: w,
            height: h,
          });
        } else {
          const page = pdf.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
      }
      const out = await pdf.save();
      const base =
        files.length === 1
          ? files[0].name.replace(/\.[^.]+$/, "")
          : "images";
      downloadBlob(
        new Blob([out as BlobPart], { type: "application/pdf" }),
        sanitizeFilename(base),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <FileDrop files={files} onFiles={setFiles} accept="image/*" multiple hint="Add images in the order you want them in the PDF." />
      <Field label="Page size">
        <select value={pageMode} onChange={(e) => setPageMode(e.target.value as "fit" | "a4")} className={inputClass()}>
          <option value="fit">Fit to image</option>
          <option value="a4">A4 (centered)</option>
        </select>
      </Field>
      {error && <p className="text-sm text-error">{error}</p>}
      <Button variant="gradient" onClick={generate} disabled={busy || files.length === 0}>
        <FileDown className="h-4 w-4" />
        {busy ? "Building..." : `Create PDF (${files.length} page${files.length === 1 ? "" : "s"})`}
      </Button>
    </div>
  );
}
