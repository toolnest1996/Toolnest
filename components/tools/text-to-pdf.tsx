"use client";

import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob, sanitizeFilename } from "@/lib/utils";

export function TextToPdf({ fromFile = false }: { fromFile?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadFile = async (file: File) => {
    setText(await file.text());
  };

  const generate = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      const margin = 50;
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const maxWidth = pageWidth - margin * 2;
      const lineHeight = fontSize * 1.5;

      const wrap = (line: string): string[] => {
        if (line === "") return [""];
        const words = line.split(" ");
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      const allLines = text.split("\n").flatMap(wrap);

      let page = pdf.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      for (const line of allLines) {
        if (y < margin) {
          page = pdf.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.05, 0.05, 0.1),
        });
        y -= lineHeight;
      }

      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        sanitizeFilename(fromFile ? "document" : "toolnest"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {fromFile && (
        <input
          type="file"
          accept=".txt,text/plain"
          onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white"
        />
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste the text you want to turn into a PDF..."
        className="min-h-[260px] w-full rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary"
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <Button variant="gradient" onClick={generate} disabled={busy || !text.trim()}>
        <FileDown className="h-4 w-4" />
        {busy ? "Generating..." : "Download PDF"}
      </Button>
    </div>
  );
}
