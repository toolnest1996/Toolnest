"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileArchive,
  FileText,
  GripVertical,
  Loader2,
  Maximize2,
  RefreshCw,
  RotateCw,
  Scissors,
  Search,
  Settings2,
  Shield,
  ScanLine,
  Trash2,
  Undo2,
  UploadCloud,
  Wand2,
  X,
  Zap,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  estimateOutputCount,
  executeBatchSplit,
  executeSplit,
  extractBookmarkGroups,
  nextRotation,
  parsePdf,
  renderThumb,
  reorder,
  smartSplitSuggestions,
  zipSplitFiles,
  type BookmarkGroup,
  type SplitMode,
  type SplitOutputOptions,
  type SplitPage,
} from "./pdf-split-utils";
import { PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";

type Tab = "pages" | "plan" | "preview" | "batch" | "api";

const SETTINGS_KEY = "toolnest-pdf-split-settings";

const MODES: { id: SplitMode; label: string; hint: string }[] = [
  { id: "every-page", label: "Every page", hint: "One PDF file per selected page (ZIP)" },
  { id: "extract", label: "Extract selection", hint: "Single PDF with chosen pages" },
  { id: "by-ranges", label: "By ranges", hint: "Multiple PDFs — e.g. 1-3; 4-8; 9-12" },
  { id: "every-n", label: "Every N pages", hint: "Chunk PDF into groups of N pages" },
  { id: "by-bookmarks", label: "By bookmarks", hint: "Split at top-level PDF outline sections" },
];

const SELECTION_PRESETS = [
  { id: "all", label: "All pages" },
  { id: "none", label: "None" },
  { id: "odd", label: "Odd pages" },
  { id: "even", label: "Even pages" },
  { id: "first", label: "First half" },
  { id: "second", label: "Second half" },
  { id: "invert", label: "Invert" },
] as const;

function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "") || "document";
}

export function PdfSplit() {
  const inputRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<SplitPage[][]>([]);

  const [source, setSource] = useState<PdfDocument | null>(null);
  const [batchSources, setBatchSources] = useState<PdfDocument[]>([]);
  const [bookmarkGroups, setBookmarkGroups] = useState<BookmarkGroup[]>([]);
  const [pages, setPages] = useState<SplitPage[]>([]);
  const [tab, setTab] = useState<Tab>("pages");
  const [dragging, setDragging] = useState(false);
  const [dragPage, setDragPage] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const [zoomPage, setZoomPage] = useState<SplitPage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [mode, setMode] = useState<SplitMode>("every-page");
  const [rangeGroups, setRangeGroups] = useState("1-3; 4-6");
  const [everyN, setEveryN] = useState(5);
  const [filePrefix, setFilePrefix] = useState("");
  const [compress, setCompress] = useState(true);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfAuthor, setPdfAuthor] = useState("ToolNest.io");
  const [pdfSubject, setPdfSubject] = useState("");
  const [pdfKeywords, setPdfKeywords] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [pageNumbers, setPageNumbers] = useState(false);
  const [watermark, setWatermark] = useState("");
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [fitToA4, setFitToA4] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  const included = useMemo(() => pages.filter((p) => p.included), [pages]);

  const outputOptions: SplitOutputOptions = useMemo(
    () => ({
      filePrefix: filePrefix || (source ? baseName(source.name) : "split"),
      sourceBaseName: source ? baseName(source.name) : "split",
      compress,
      password: pdfPassword,
      pageNumbers,
      watermark,
      title: pdfTitle,
      author: pdfAuthor,
      subject: pdfSubject,
      keywords: pdfKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      preserveMetadata,
      fitToA4,
    }),
    [filePrefix, source, compress, pdfPassword, pageNumbers, watermark, pdfTitle, pdfAuthor, pdfSubject, pdfKeywords, preserveMetadata, fitToA4],
  );

  const estOutputs = useMemo(
    () =>
      source
        ? estimateOutputCount(
            mode,
            included.length,
            rangeGroups,
            source.pageCount,
            everyN,
            mode === "by-bookmarks" ? bookmarkGroups.length : 0,
          )
        : 0,
    [mode, included.length, rangeGroups, source, everyN, bookmarkGroups.length],
  );

  const smartTips = useMemo(
    () =>
      source
        ? smartSplitSuggestions(source.pageCount, included.length, mode, estOutputs, source.size)
        : [],
    [source, included.length, mode, estOutputs],
  );

  const stats = useMemo(
    () => ({
      totalPages: source?.pageCount ?? 0,
      selected: included.length,
      size: source?.size ?? 0,
      outputs: estOutputs,
    }),
    [source, included.length, estOutputs],
  );

  const filteredPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => `page ${p.pageIndex + 1}`.includes(q));
  }, [pages, pageSearch]);

  const pushUndo = useCallback((snapshot: SplitPage[]) => {
    undoStack.current = [...undoStack.current.slice(-24), snapshot.map((p) => ({ ...p }))];
    setCanUndo(true);
  }, []);

  const updatePages = useCallback(
    (updater: (prev: SplitPage[]) => SplitPage[], trackUndo = true) => {
      setPages((prev) => {
        if (trackUndo) pushUndo(prev);
        return updater(prev);
      });
    },
    [pushUndo],
  );

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev) {
      setPages(prev);
      setCanUndo(undoStack.current.length > 0);
      toast.success("Undone");
    }
  };

  const loadThumbs = useCallback(async (items: SplitPage[], bytes: ArrayBuffer) => {
    for (const item of items) {
      if (item.thumb) continue;
      try {
        const thumb = await renderThumb(bytes, item.pageIndex);
        setPages((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumb } : p)));
      } catch {
        /* skip */
      }
    }
  }, []);

  const loadPdf = async (file: File, password?: string) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a PDF file");
      return;
    }
    setLoadingFile(true);
    setError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    try {
      const doc = await parsePdf(file, password);
      const initial: SplitPage[] = Array.from({ length: doc.pageCount }, (_, i) => ({
        id: crypto.randomUUID(),
        pageIndex: i,
        included: true,
        rotation: 0,
      }));
      setSource(doc);
      setPages(initial);
      setFilePrefix(baseName(doc.name));
      setRangeGroups(`1-${Math.min(3, doc.pageCount)}${doc.pageCount > 3 ? `; 4-${doc.pageCount}` : ""}`);
      undoStack.current = [];
      setCanUndo(false);
      void loadThumbs(initial, doc.bytes);
      const groups = await extractBookmarkGroups(doc.bytes);
      setBookmarkGroups(groups);
      if (groups.length) toast.success(`${doc.pageCount} pages · ${groups.length} bookmark sections`);
      else toast.success(`${doc.pageCount} pages loaded`);
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        toast.info(`"${file.name}" requires a password`);
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to read PDF";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingFile(false);
    }
  };

  const unlockPending = async () => {
    if (!pendingUnlock?.password.trim()) {
      toast.error("Enter the PDF password");
      return;
    }
    const { file, password } = pendingUnlock;
    setPendingUnlock(null);
    await loadPdf(file, password);
  };

  const addBatchFiles = async (fileList: FileList | File[]) => {
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (!pdfs.length) {
      toast.error("No PDF files found");
      return;
    }
    setLoadingFile(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const file of pdfs) {
        try {
          loaded.push(await parsePdf(file));
        } catch (e) {
          if (e instanceof PdfEncryptedError) {
            toast.error(`"${file.name}" is encrypted — unlock in Studio tab first`);
            continue;
          }
          throw e;
        }
      }
      setBatchSources((prev) => [...prev, ...loaded]);
      toast.success(`${loaded.length} PDF(s) added to batch queue`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch load failed");
    } finally {
      setLoadingFile(false);
    }
  };

  const runBatchSplit = async () => {
    if (!batchSources.length) {
      toast.error("Add PDFs to batch queue");
      return;
    }
    setBatchRunning(true);
    setProgress(0);
    try {
      const files = await executeBatchSplit(
        batchSources.map((d) => ({ name: d.name, bytes: d.bytes, pageCount: d.pageCount })),
        mode,
        rangeGroups,
        everyN,
        outputOptions,
        setProgress,
      );
      if (!files.length) {
        toast.error("No output — check split mode settings");
        return;
      }
      const zip = await zipSplitFiles(files, "batch-split");
      downloadBlob(zip, "batch-split.zip");
      toast.success(`Batch complete · ${files.length} files in ZIP`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch split failed");
    } finally {
      setBatchRunning(false);
      setProgress(0);
    }
  };

  const rotateAllIncluded = () => {
    updatePages((prev) =>
      prev.map((p) => (p.included ? { ...p, rotation: nextRotation(p.rotation) } : p)),
    );
    toast.success("Rotated all included pages 90°");
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.compress === "boolean") setCompress(s.compress);
      if (typeof s.pageNumbers === "boolean") setPageNumbers(s.pageNumbers);
      if (typeof s.preserveMetadata === "boolean") setPreserveMetadata(s.preserveMetadata);
      if (typeof s.fitToA4 === "boolean") setFitToA4(s.fitToA4);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ compress, pageNumbers, preserveMetadata, fitToA4 }),
    );
  }, [compress, pageNumbers, preserveMetadata, fitToA4]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applySelectionPreset = (id: (typeof SELECTION_PRESETS)[number]["id"]) => {
    if (!source) return;
    updatePages((prev) =>
      prev.map((p) => {
        let included = p.included;
        if (id === "all") included = true;
        else if (id === "none") included = false;
        else if (id === "odd") included = p.pageIndex % 2 === 0;
        else if (id === "even") included = p.pageIndex % 2 === 1;
        else if (id === "first") included = p.pageIndex < Math.ceil(source.pageCount / 2);
        else if (id === "second") included = p.pageIndex >= Math.ceil(source.pageCount / 2);
        else if (id === "invert") included = !p.included;
        return { ...p, included };
      }),
    );
    toast.success("Selection updated");
  };

  const clearAll = () => {
    setSource(null);
    setPages([]);
    setBatchSources([]);
    setBookmarkGroups([]);
    setError("");
    undoStack.current = [];
    setCanUndo(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const runSplit = async (download: boolean) => {
    if (!source || included.length === 0) {
      toast.error("Select at least one page");
      return null;
    }
    const setter = download ? setSplitting : setPreviewing;
    setter(true);
    setProgress(0);
    setError("");
    try {
      const files = await executeSplit(
        source.bytes,
        pages,
        mode === "extract" ? "extract" : mode,
        rangeGroups,
        everyN,
        outputOptions,
        setProgress,
      );
      if (!files.length) {
        toast.error(download ? "Nothing to download — check selection and ranges" : "Nothing to preview — check selection and ranges");
        return null;
      }
      if (download) {
        if (files.length === 1) {
          downloadBlob(
            new Blob([files[0].data as BlobPart], { type: "application/pdf" }),
            files[0].name,
          );
          toast.success(`Split complete · ${formatBytes(files[0].data.length)}`);
        } else {
          const zip = await zipSplitFiles(files, `${outputOptions.filePrefix}-split`);
          downloadBlob(zip, `${outputOptions.filePrefix}-split.zip`);
          toast.success(`Downloaded ${files.length} PDFs as ZIP · ${formatBytes(zip.size)}`);
        }
      }
      return files[0];
    } catch (e) {
      const msg = e instanceof Error ? e.message : download ? "Split failed" : "Preview failed";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setter(false);
      setProgress(0);
    }
  };

  const generatePreview = async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const first = await runSplit(false);
    if (first) {
      setPreviewUrl(URL.createObjectURL(new Blob([first.data as BlobPart], { type: "application/pdf" })));
      setTab("preview");
      toast.success(`Preview: ${first.name}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total pages", value: stats.totalPages, color: "text-foreground" },
          { label: "Selected", value: stats.selected, color: "text-emerald-500" },
          { label: "File size", value: source ? formatBytes(stats.size) : "—", color: "text-violet-400" },
          { label: "Output files", value: stats.outputs, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !loadingFile && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void loadPdf(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-10",
          dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-card-hover",
          loadingFile && "pointer-events-none opacity-70",
        )}
      >
        {loadingFile ? (
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
        ) : (
          <UploadCloud className="mb-3 h-10 w-10 text-primary" />
        )}
        <p className="font-display text-lg font-semibold">
          {loadingFile ? "Reading PDF..." : source ? "Replace PDF or drop a new file" : "Ultra PDF Split Studio"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {source ? `${source.name} · ${source.pageCount} pages` : "Split by page, range, bookmarks, or batch — ZIP · 100% in-browser"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadPdf(f);
            e.target.value = "";
          }}
        />
      </div>

      {source && (
        <>
          {smartTips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium text-primary">
                <ScanLine className="h-4 w-4" />
                Smart split assist
              </p>
              <ul className="list-inside list-disc text-muted">
                {smartTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <RefreshCw className="h-4 w-4" /> Replace PDF
            </Button>
            <Button variant="outline" size="sm" onClick={rotateAllIncluded}>
              <RotateCw className="h-4 w-4" /> Rotate all
            </Button>
            <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="text-error hover:text-error">
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                showSettings ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground",
              )}
            >
              <Settings2 className="h-4 w-4" /> Output settings
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
              <Wand2 className="h-3.5 w-3.5" /> Page selection presets
            </div>
            <div className="flex flex-wrap gap-2">
              {SELECTION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applySelectionPreset(p.id)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {showSettings && (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Filename prefix">
                <input value={filePrefix} onChange={(e) => setFilePrefix(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="PDF title (metadata)">
                <input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} className={inputClass()} placeholder="Optional" />
              </Field>
              <Field label="Author">
                <input value={pdfAuthor} onChange={(e) => setPdfAuthor(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="Subject">
                <input value={pdfSubject} onChange={(e) => setPdfSubject(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="Keywords" hint="Comma-separated">
                <input value={pdfKeywords} onChange={(e) => setPdfKeywords(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="Password (optional)">
                <input type="password" value={pdfPassword} onChange={(e) => setPdfPassword(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="Watermark (optional)">
                <input value={watermark} onChange={(e) => setWatermark(e.target.value)} className={inputClass()} />
              </Field>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} className="accent-[var(--primary)]" />
                  Add page numbers
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} className="accent-[var(--primary)]" />
                  Compress output
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={preserveMetadata} onChange={(e) => setPreserveMetadata(e.target.checked)} className="accent-[var(--primary)]" />
                  Preserve source metadata
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fitToA4} onChange={(e) => setFitToA4(e.target.checked)} className="accent-[var(--primary)]" />
                  Fit pages to A4
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(
              [
                ["pages", "Page Studio", Zap],
                ["plan", "Split Plan", Scissors],
                ["preview", "Preview", Eye],
                ["batch", "Batch", Layers],
                ["api", "API", Shield],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                  tab === key ? "bg-primary text-white shadow-sm" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {tab === "pages" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  placeholder="Filter pages..."
                  className={cn(inputClass(), "pl-10")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredPages.map((page) => {
                  const idx = pages.findIndex((p) => p.id === page.id);
                  return (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => setDragPage(page.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragPage || dragPage === page.id) return;
                        updatePages((prev) => {
                          const from = prev.findIndex((p) => p.id === dragPage);
                          const to = prev.findIndex((p) => p.id === page.id);
                          if (from < 0 || to < 0) return prev;
                          return reorder(prev, from, to);
                        });
                        setDragPage(null);
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-card transition-all",
                        page.included ? "border-border" : "border-border/50 opacity-45",
                      )}
                    >
                      <GripVertical className="absolute right-2 top-2 z-10 h-4 w-4 cursor-grab text-muted opacity-0 group-hover:opacity-100" />
                      <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {page.pageIndex + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomPage(page)}
                        className="absolute right-2 top-8 z-10 rounded bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="aspect-[3/4] bg-muted/20">
                        {page.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={page.thumb} alt="" className="h-full w-full object-contain" style={{ transform: `rotate(${page.rotation}deg)` }} />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted" />
                          </div>
                        )}
                      </div>
                      <div className="border-t border-border p-2">
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, included: !p.included } : p)))}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-medium",
                              page.included ? "bg-emerald-500/15 text-emerald-500" : "bg-muted/30 text-muted",
                            )}
                          >
                            {page.included ? "In" : "Out"}
                          </button>
                          <div className="flex gap-0.5">
                            <button type="button" onClick={() => setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, rotation: nextRotation(p.rotation) } : p)))} className="rounded p-1 text-muted hover:text-foreground">
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-muted">Queue #{idx + 1}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "plan" && (
            <div className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6">
              <Field label="Split mode">
                <div className="grid gap-2 sm:grid-cols-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        mode === m.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                      )}
                    >
                      <p className="font-medium">{m.label}</p>
                      <p className="mt-0.5 text-xs text-muted">{m.hint}</p>
                    </button>
                  ))}
                </div>
              </Field>

              {mode === "by-ranges" && (
                <Field label="Range groups" hint="Semicolon separates each output PDF — e.g. 1-3; 4-8; 9-12">
                  <textarea
                    value={rangeGroups}
                    onChange={(e) => setRangeGroups(e.target.value)}
                    rows={3}
                    className={cn(inputClass(), "h-auto py-2")}
                  />
                </Field>
              )}

              {mode === "every-n" && (
                <Field label={`Pages per file: ${everyN}`}>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, source.pageCount)}
                    value={everyN}
                    onChange={(e) => setEveryN(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </Field>
              )}

              <p className="rounded-lg bg-muted/20 px-4 py-3 text-sm text-muted">
                {mode === "every-page" && `Will create ${included.length} PDF file(s) and download as ZIP.`}
                {mode === "extract" && "Will create 1 PDF containing all selected pages in queue order."}
                {mode === "by-ranges" && `Will create up to ${estOutputs} PDF file(s) from range groups (ZIP if multiple).`}
                {mode === "every-n" && `Will create ${estOutputs} PDF chunk(s) with ${everyN} pages each (ZIP).`}
                {mode === "by-bookmarks" &&
                  (bookmarkGroups.length
                    ? `Will create up to ${bookmarkGroups.length} PDF(s) from outline: ${bookmarkGroups.map((g) => g.title).slice(0, 4).join(", ")}${bookmarkGroups.length > 4 ? "…" : ""}`
                    : "No top-level bookmarks found in this PDF — try another mode.")}
              </p>
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
              <p className="text-sm text-muted">
                Split multiple PDFs with the same mode and settings. Encrypted files must be unlocked in Studio first.
              </p>
              <Button variant="outline" size="sm" onClick={() => batchRef.current?.click()}>
                <UploadCloud className="h-4 w-4" /> Add PDFs to batch
              </Button>
              <input
                ref={batchRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void addBatchFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {batchSources.length > 0 && (
                <ul className="space-y-2">
                  {batchSources.map((d) => (
                    <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="truncate">{d.name}</span>
                      <span className="text-muted">{d.pageCount} pg · {formatBytes(d.size)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="gradient" disabled={!batchSources.length || batchRunning} onClick={() => void runBatchSplit()}>
                {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                Batch split & ZIP ({batchSources.length} PDFs)
              </Button>
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-primary" />
                REST API — POST /api/v1/pdf/split
              </p>
              <p className="text-sm text-muted">
                Server-side split for automation. Send a base64 PDF; receive split files or a ZIP. Studio remains fully offline.
              </p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs leading-relaxed">{`POST /api/v1/pdf/split
{
  "pdf": "JVBERi0x...",
  "mode": "by-ranges",
  "rangeGroups": "1-5; 6-10",
  "options": { "compress": true, "preserveMetadata": true }
}`}</pre>
              <p className="text-xs text-muted">Limit: 50 MB per PDF · modes: every-page, extract, by-ranges, every-n, by-bookmarks</p>
            </div>
          )}

          {tab === "preview" && (
            <div className="rounded-xl border border-border bg-card p-2">
              {previewUrl ? (
                <iframe src={previewUrl} title="Split preview" className="h-[min(70vh,720px)] w-full rounded-lg bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-muted">
                  <Eye className="h-10 w-10" />
                  <p className="text-sm">Generate a preview of the first output file</p>
                  <Button variant="outline" size="sm" onClick={() => void generatePreview()}>
                    Generate preview
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {pendingUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold">Unlock PDF</h3>
            <p className="mt-1 text-sm text-muted">
              <strong>{pendingUnlock.file.name}</strong> is password-protected.
            </p>
            <div className="mt-4">
              <Field label="PDF password">
                <input
                  type="password"
                  value={pendingUnlock.password}
                  onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })}
                  className={inputClass()}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && void unlockPending()}
                />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gradient" onClick={() => void unlockPending()}>Unlock</Button>
              <Button variant="outline" onClick={() => setPendingUnlock(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {zoomPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoomPage(null)}>
          <div className="max-h-[90vh] max-w-3xl overflow-auto rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Page {zoomPage.pageIndex + 1}</p>
              <button type="button" onClick={() => setZoomPage(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {zoomPage.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zoomPage.thumb} alt="" className="mx-auto max-h-[70vh] object-contain" style={{ transform: `rotate(${zoomPage.rotation}deg)` }} />
            ) : (
              <p className="py-12 text-center text-muted">Loading preview...</p>
            )}
          </div>
        </div>
      )}

      {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {(splitting || previewing || batchRunning) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>{splitting ? "Splitting..." : "Building preview..."}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {source && (
        <div className="flex flex-wrap gap-3">
          <Button variant="gradient" disabled={included.length === 0 || splitting} onClick={() => void runSplit(true)}>
            {splitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {progress}%
              </>
            ) : (
              <>
                {estOutputs > 1 ? <FileArchive className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                Split & Download {estOutputs > 1 ? `(ZIP · ${estOutputs} files)` : ""}
              </>
            )}
          </Button>
          <Button variant="outline" disabled={previewing || splitting} onClick={() => void generatePreview()}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
        </div>
      )}
    </div>
  );
}
