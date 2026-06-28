"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  GripVertical,
  History,
  ImagePlus,
  Layers,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Settings2,
  Shuffle,
  Trash2,
  Undo2,
  UploadCloud,
  Wand2,
  X,
  ScanLine,
  Shield,
  FolderOpen,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  applyMergePreset,
  autoTitleFromDocuments,
  buildMergedPdf,
  buildQueueFromDocuments,
  dedupeQueuePages,
  findDuplicateDocuments,
  nextRotation,
  parsePageRange,
  parsePdf,
  PdfEncryptedError,
  renderThumb,
  reorder,
  smartMergeSuggestions,
  type MergeOutputOptions,
  type MergePreset,
  type PdfDocument,
  type QueuePage,
} from "./pdf-merge-utils";

type Tab = "documents" | "pages" | "preview" | "api";

const SETTINGS_KEY = "toolnest-pdf-merge-settings";

const PRESETS: { id: MergePreset; label: string; hint: string }[] = [
  { id: "append", label: "Append order", hint: "Document order → all pages" },
  { id: "interleave", label: "Interleave", hint: "Page 1 from each, then page 2…" },
  { id: "reverse-docs", label: "Reverse documents", hint: "Last PDF first" },
  { id: "reverse-pages", label: "Reverse pages", hint: "Flip page sequence" },
  { id: "reverse-queue", label: "Reverse queue", hint: "Flip current queue" },
];

export function PdfMerge() {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<QueuePage[][]>([]);

  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [queue, setQueue] = useState<QueuePage[]>([]);
  const [pageRanges, setPageRanges] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("documents");
  const [dragging, setDragging] = useState(false);
  const [dragDoc, setDragDoc] = useState<string | null>(null);
  const [dragPage, setDragPage] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [merging, setMerging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const [zoomPage, setZoomPage] = useState<QueuePage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastSize, setLastSize] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [outputName, setOutputName] = useState("merged");
  const [compress, setCompress] = useState(true);
  const [pdfTitle, setPdfTitle] = useState("Merged PDF — ToolNest");
  const [pdfAuthor, setPdfAuthor] = useState("ToolNest.io");
  const [pdfSubject, setPdfSubject] = useState("");
  const [pdfKeywords, setPdfKeywords] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [pageNumbers, setPageNumbers] = useState(true);
  const [watermark, setWatermark] = useState("");
  const [fitToA4, setFitToA4] = useState(false);
  const [blankBetweenDocs, setBlankBetweenDocs] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);

  const docMap = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);
  const includedPages = useMemo(() => queue.filter((p) => p.included), [queue]);

  const outputOptions: MergeOutputOptions = useMemo(
    () => ({
      title: pdfTitle,
      author: pdfAuthor,
      subject: pdfSubject,
      keywords: pdfKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      compress,
      password: pdfPassword,
      pageNumbers,
      watermark,
      fitToA4,
    }),
    [pdfTitle, pdfAuthor, pdfSubject, pdfKeywords, compress, pdfPassword, pageNumbers, watermark, fitToA4],
  );

  const duplicateFiles = useMemo(() => findDuplicateDocuments(documents), [documents]);
  const smartTips = useMemo(() => smartMergeSuggestions(documents, queue), [documents, queue]);

  const stats = useMemo(() => {
    const totalPages = documents.reduce((s, d) => s + d.pageCount, 0);
    const totalBytes = documents.reduce((s, d) => s + d.size, 0);
    const estOut = Math.round(totalBytes * (includedPages.length / Math.max(totalPages, 1)) * (compress ? 0.85 : 1));
    return {
      files: documents.length,
      totalPages,
      selectedPages: includedPages.length,
      totalBytes,
      estOut,
    };
  }, [documents, includedPages.length, compress]);

  const filteredQueue = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((p) => {
      const label =
        p.kind === "blank"
          ? "blank"
          : p.kind === "cover"
            ? "cover"
            : `${p.fileName} page ${(p.pageIndex ?? 0) + 1}`;
      return label.toLowerCase().includes(q);
    });
  }, [queue, pageSearch]);

  const pushUndo = useCallback((snapshot: QueuePage[]) => {
    undoStack.current = [...undoStack.current.slice(-24), snapshot.map((p) => ({ ...p }))];
    setCanUndo(true);
  }, []);

  const updateQueue = useCallback(
    (updater: (prev: QueuePage[]) => QueuePage[], trackUndo = true) => {
      setQueue((prev) => {
        if (trackUndo) pushUndo(prev);
        return updater(prev);
      });
    },
    [pushUndo],
  );

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev) {
      setQueue(prev);
      setCanUndo(undoStack.current.length > 0);
      toast.success("Undone");
    }
  };

  const loadThumbnails = useCallback(async (items: QueuePage[], docs: PdfDocument[]) => {
    const bytesMap = new Map(docs.map((d) => [d.id, d.bytes]));
    for (const item of items) {
      if (item.kind !== "page" || item.thumb || !item.sourceId) continue;
      const bytes = bytesMap.get(item.sourceId);
      if (!bytes || item.pageIndex === undefined) continue;
      try {
        const thumb = await renderThumb(bytes, item.pageIndex);
        setQueue((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumb } : p)));
      } catch {
        /* skip */
      }
    }
  }, []);

  const appendQueueItems = (newDocs: PdfDocument[], prevDocs: PdfDocument[]) => {
    const newItems: QueuePage[] = [];
    for (const doc of newDocs) {
      const indices = parsePageRange(pageRanges[doc.id] ?? "", doc.pageCount);
      const pages = indices.length ? indices : Array.from({ length: doc.pageCount }, (_, i) => i);
      for (const pageIndex of pages) {
        newItems.push({
          id: crypto.randomUUID(),
          included: true,
          kind: "page",
          sourceId: doc.id,
          pageIndex,
          rotation: 0,
          fileName: doc.name,
        });
      }
    }

    updateQueue((prev) => {
      let next = [...prev, ...newItems];
      if (blankBetweenDocs && prevDocs.length > 0 && newDocs.length > 0) {
        const withBlanks: QueuePage[] = [];
        let lastSource: string | undefined;
        for (const item of next) {
          if (item.kind === "page" && item.sourceId && lastSource && item.sourceId !== lastSource) {
            withBlanks.push({
              id: crypto.randomUUID(),
              included: true,
              kind: "blank",
              rotation: 0,
              fileName: "Blank page",
            });
          }
          withBlanks.push(item);
          if (item.kind === "page" && item.sourceId) lastSource = item.sourceId;
        }
        next = withBlanks;
      }
      return next;
    }, false);

    void loadThumbnails(newItems, [...prevDocs, ...newDocs]);
  };

  const addFiles = async (fileList: FileList | File[], passwordForNext?: string) => {
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (!pdfs.length) {
      toast.error("Please select valid PDF files");
      return;
    }
    setLoadingFiles(true);
    setError("");
    const loaded: PdfDocument[] = [];
    try {
      for (const file of pdfs) {
        try {
          loaded.push(await parsePdf(file, passwordForNext));
        } catch (e) {
          if (e instanceof PdfEncryptedError) {
            setPendingUnlock({ file, password: "" });
            toast.info(`"${file.name}" requires a password`);
            if (loaded.length) {
              setDocuments((prev) => {
                appendQueueItems(loaded, prev);
                return [...prev, ...loaded];
              });
            }
            return;
          }
          throw e;
        }
      }
      setDocuments((prev) => {
        appendQueueItems(loaded, prev);
        return [...prev, ...loaded];
      });
      toast.success(`${loaded.length} PDF${loaded.length === 1 ? "" : "s"} added`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read PDF";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingFiles(false);
    }
  };

  const unlockPending = async () => {
    if (!pendingUnlock?.password.trim()) {
      toast.error("Enter the PDF password");
      return;
    }
    const { file, password } = pendingUnlock;
    setPendingUnlock(null);
    await addFiles([file], password);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.outputName === "string") setOutputName(s.outputName);
      if (typeof s.pdfTitle === "string") setPdfTitle(s.pdfTitle);
      if (typeof s.pdfAuthor === "string") setPdfAuthor(s.pdfAuthor);
      if (typeof s.compress === "boolean") setCompress(s.compress);
      if (typeof s.pageNumbers === "boolean") setPageNumbers(s.pageNumbers);
      if (typeof s.fitToA4 === "boolean") setFitToA4(s.fitToA4);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ outputName, pdfTitle, pdfAuthor, compress, pageNumbers, fitToA4 }),
    );
  }, [outputName, pdfTitle, pdfAuthor, compress, pageNumbers, fitToA4]);

  useEffect(() => {
    if (documents.length && queue.some((q) => q.kind === "page" && !q.thumb)) {
      void loadThumbnails(queue, documents);
    }
  }, [documents, queue, loadThumbnails]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyPreset = (preset: MergePreset) => {
    const next = applyMergePreset(preset, documents, queue);
    updateQueue(() => next);
    void loadThumbnails(next, documents);
    toast.success(PRESETS.find((p) => p.id === preset)?.label ?? "Preset applied");
  };

  const applyDocPageRange = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const range = pageRanges[docId] ?? "";
    const indices = parsePageRange(range, doc.pageCount);
    if (!indices.length) {
      toast.error("Invalid page range");
      return;
    }
    updateQueue((prev) => {
      const without = prev.filter((p) => p.sourceId !== docId);
      const newPages: QueuePage[] = indices.map((pageIndex) => ({
        id: crypto.randomUUID(),
        included: true,
        kind: "page" as const,
        sourceId: docId,
        pageIndex,
        rotation: 0,
        fileName: doc.name,
      }));
      void loadThumbnails(newPages, documents);
      return [...without, ...newPages];
    });
    toast.success(`Applied range: ${indices.length} pages`);
  };

  const addCoverImage = async (file: File) => {
    const bytes = await file.arrayBuffer();
    const type = file.type.includes("png") ? "png" : "jpg";
    const cover: QueuePage = {
      id: crypto.randomUUID(),
      included: true,
      kind: "cover",
      rotation: 0,
      fileName: file.name,
      coverBytes: bytes,
      coverType: type as "png" | "jpg",
    };
    updateQueue((prev) => [cover, ...prev]);
    toast.success("Cover page added at start");
  };

  const removeDocument = (id: string) => {
    pushUndo(queue);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setQueue((prev) => prev.filter((p) => p.sourceId !== id));
  };

  const duplicateDocument = (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;
    const copy: PdfDocument = {
      ...doc,
      id: crypto.randomUUID(),
      name: `${doc.name.replace(/\.pdf$/i, "")} (copy).pdf`,
      contentHash: doc.contentHash,
    };
    const pages: QueuePage[] = Array.from({ length: copy.pageCount }, (_, i) => ({
      id: crypto.randomUUID(),
      included: true,
      kind: "page" as const,
      sourceId: copy.id,
      pageIndex: i,
      rotation: 0,
      fileName: copy.name,
    }));
    pushUndo(queue);
    setDocuments((prev) => [...prev, copy]);
    setQueue((prev) => [...prev, ...pages]);
    void loadThumbnails(pages, [...documents, copy]);
    toast.success("Document duplicated");
  };

  const moveDocument = (id: string, dir: -1 | 1) => {
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      return reorder(prev, idx, target);
    });
  };

  const removeDuplicatePages = () => {
    updateQueue((prev) => dedupeQueuePages(prev));
    toast.success("Duplicate pages removed");
  };

  const applyAutoTitle = () => {
    setPdfTitle(autoTitleFromDocuments(documents));
    toast.success("Title generated from filenames");
  };

  const syncQueueFromDocuments = () => {
    const items = buildQueueFromDocuments(documents, pageRanges);
    updateQueue(() => items);
    void loadThumbnails(items, documents);
    toast.success("Page order synced from documents");
  };

  const addBlankPage = (afterId?: string) => {
    const blank: QueuePage = {
      id: crypto.randomUUID(),
      included: true,
      kind: "blank",
      rotation: 0,
      fileName: "Blank page",
    };
    if (!afterId) {
      updateQueue((prev) => [...prev, blank]);
      return;
    }
    updateQueue((prev) => {
      const idx = prev.findIndex((p) => p.id === afterId);
      if (idx < 0) return [...prev, blank];
      const next = [...prev];
      next.splice(idx + 1, 0, blank);
      return next;
    });
  };

  const duplicatePage = (id: string) => {
    updateQueue((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: crypto.randomUUID(), thumb: prev[idx].thumb };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const rotateAllIncluded = () => {
    updateQueue((prev) =>
      prev.map((p) => (p.included && p.kind === "page" ? { ...p, rotation: nextRotation(p.rotation) } : p)),
    );
    toast.success("Rotated all included pages 90°");
  };

  const togglePage = (id: string) => {
    setQueue((prev) => prev.map((p) => (p.id === id ? { ...p, included: !p.included } : p)));
  };

  const rotatePage = (id: string) => {
    setQueue((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: nextRotation(p.rotation) } : p)),
    );
  };

  const removePage = (id: string) => {
    updateQueue((prev) => prev.filter((p) => p.id !== id));
  };

  const selectAllPages = (val: boolean) => {
    updateQueue((prev) => prev.map((p) => ({ ...p, included: val })));
  };

  const clearAll = () => {
    setDocuments([]);
    setQueue([]);
    setPageRanges({});
    setLastSize(null);
    setError("");
    undoStack.current = [];
    setCanUndo(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const runMerge = async (download: boolean) => {
    if (includedPages.length === 0) {
      toast.error("Select at least one page to merge");
      return null;
    }
    const setter = download ? setMerging : setPreviewing;
    setter(true);
    setProgress(0);
    setError("");
    try {
      const out = await buildMergedPdf(includedPages, docMap, outputOptions, setProgress);
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      setLastSize(blob.size);
      if (download) {
        downloadBlob(blob, outputName || "merged");
        toast.success(`Merged ${includedPages.length} pages · ${formatBytes(blob.size)}`);
      }
      return blob;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Merge failed";
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
    const blob = await runMerge(false);
    if (blob) {
      setPreviewUrl(URL.createObjectURL(blob));
      setTab("preview");
      toast.success("Live preview ready");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Documents", value: stats.files, color: "text-primary" },
          { label: "Total pages", value: stats.totalPages, color: "text-foreground" },
          { label: "In merge", value: stats.selectedPages, color: "text-emerald-500" },
          { label: "Input", value: formatBytes(stats.totalBytes), color: "text-violet-400" },
          { label: "Est. output", value: formatBytes(stats.estOut), color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !loadingFiles && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-10",
          dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-card-hover",
          loadingFiles && "pointer-events-none opacity-70",
        )}
      >
        {loadingFiles ? (
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
        ) : (
          <UploadCloud className="mb-3 h-10 w-10 text-primary" />
        )}
        <p className="font-display text-lg font-semibold">
          {loadingFiles ? "Analyzing PDFs..." : "Ultra PDF Merge Studio"}
        </p>
        <p className="mt-1 max-w-lg text-sm text-muted">
          Drag & drop · folder batch · encrypted PDF unlock · page studio · interleave · fit A4 · API merge
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {documents.length > 0 && (
        <>
          {duplicateFiles.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm" role="alert">
              <p className="font-medium text-amber-600 dark:text-amber-400">Duplicate files detected</p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {duplicateFiles.map((d) => (
                  <li key={d.name}>
                    {d.name} — same content as {d.duplicateOf}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {smartTips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium text-primary">
                <ScanLine className="h-4 w-4" />
                Smart merge assist
              </p>
              <ul className="list-inside list-disc text-muted">
                {smartTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Toolbar row 1 */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loadingFiles}>
              <Plus className="h-4 w-4" /> PDFs
            </Button>
            <Button variant="outline" size="sm" onClick={() => folderRef.current?.click()} disabled={loadingFiles}>
              <FolderOpen className="h-4 w-4" /> Folder
            </Button>
            <input
              ref={folderRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => coverRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Cover
            </Button>
            <input
              ref={coverRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addCoverImage(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => addBlankPage()}>
              <FileText className="h-4 w-4" /> Blank
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectAllPages(true)}>
              <Check className="h-4 w-4" /> All
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectAllPages(false)}>
              <X className="h-4 w-4" /> None
            </Button>
            <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
            <Button variant="outline" size="sm" onClick={removeDuplicatePages}>
              <Sparkles className="h-4 w-4" /> Dedupe pages
            </Button>
            <Button variant="outline" size="sm" onClick={syncQueueFromDocuments}>
              <RefreshCw className="h-4 w-4" /> Sync
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="text-error hover:text-error">
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          </div>

          {/* Presets */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
              <Wand2 className="h-3.5 w-3.5" /> Smart merge presets
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  title={p.hint}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                showSettings ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground",
              )}
            >
              <Settings2 className="h-4 w-4" /> Output & security
            </button>
            <Button variant="outline" size="sm" onClick={() => void generatePreview()} disabled={previewing || merging}>
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Live preview
            </Button>
            <Button variant="outline" size="sm" onClick={rotateAllIncluded}>
              <RotateCw className="h-4 w-4" /> Rotate all 90°
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("reverse-queue")}>
              <Shuffle className="h-4 w-4" /> Reverse queue
            </Button>
          </div>

          {showSettings && (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Output filename">
                <input value={outputName} onChange={(e) => setOutputName(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="PDF title">
                <input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="Author">
                <input value={pdfAuthor} onChange={(e) => setPdfAuthor(e.target.value)} className={inputClass()} />
              </Field>
              <Field label="Subject">
                <input value={pdfSubject} onChange={(e) => setPdfSubject(e.target.value)} className={inputClass()} placeholder="Optional document subject" />
              </Field>
              <Field label="Keywords" hint="Comma-separated">
                <input value={pdfKeywords} onChange={(e) => setPdfKeywords(e.target.value)} className={inputClass()} placeholder="merge, report, 2026" />
              </Field>
              <Field label="Password protect (optional)" hint="Encrypt output PDF">
                <input
                  type="password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  className={inputClass()}
                  placeholder="Leave empty for no lock"
                />
              </Field>
              <Field label="Watermark text (optional)">
                <input value={watermark} onChange={(e) => setWatermark(e.target.value)} className={inputClass()} placeholder="CONFIDENTIAL" />
              </Field>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} className="accent-[var(--primary)]" />
                  Add page numbers (footer)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} className="accent-[var(--primary)]" />
                  Compress output
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fitToA4} onChange={(e) => setFitToA4(e.target.checked)} className="accent-[var(--primary)]" />
                  Fit all pages to A4 (center & scale)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={blankBetweenDocs} onChange={(e) => setBlankBetweenDocs(e.target.checked)} className="accent-[var(--primary)]" />
                  Blank between new uploads
                </label>
                <Button variant="outline" size="sm" onClick={applyAutoTitle} type="button">
                  Auto title from files
                </Button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(
              [
                ["documents", "Documents", Layers],
                ["pages", "Page Studio", Zap],
                ["preview", "Live Preview", Eye],
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

          {tab === "documents" && (
            <ul className="space-y-3">
              {documents.map((doc, idx) => (
                <li
                  key={doc.id}
                  draggable
                  onDragStart={() => setDragDoc(doc.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragDoc || dragDoc === doc.id) return;
                    setDocuments((prev) => {
                      const from = prev.findIndex((d) => d.id === dragDoc);
                      const to = prev.findIndex((d) => d.id === doc.id);
                      if (from < 0 || to < 0) return prev;
                      return reorder(prev, from, to);
                    });
                    setDragDoc(null);
                  }}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted" />
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{doc.name}</p>
                      <p className="text-xs text-muted">
                        {doc.pageCount} pages · {formatBytes(doc.size)} · #{idx + 1}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => moveDocument(doc.id, -1)} className="rounded p-1.5 text-muted hover:bg-card-hover" title="Up">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => moveDocument(doc.id, 1)} className="rounded p-1.5 text-muted hover:bg-card-hover" title="Down">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => duplicateDocument(doc.id)} className="rounded p-1.5 text-muted hover:bg-card-hover" title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeDocument(doc.id)} className="rounded p-1.5 text-muted hover:text-error" title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Field label="Page range" hint={`1-${doc.pageCount} or 1-3, 5, 8`}>
                        <input
                          value={pageRanges[doc.id] ?? ""}
                          onChange={(e) => setPageRanges((r) => ({ ...r, [doc.id]: e.target.value }))}
                          placeholder={`All (1-${doc.pageCount})`}
                          className={inputClass()}
                        />
                      </Field>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => applyDocPageRange(doc.id)} className="shrink-0">
                      <History className="h-4 w-4" /> Apply range
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "pages" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  placeholder="Filter pages by filename or number..."
                  className={cn(inputClass(), "pl-10")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredQueue.map((page) => {
                  const idx = queue.findIndex((p) => p.id === page.id);
                  return (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => setDragPage(page.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragPage || dragPage === page.id) return;
                        updateQueue((prev) => {
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
                        page.kind !== "page" && "border-dashed",
                      )}
                    >
                      <div className="absolute left-2 top-2 z-10 flex gap-1">
                        <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{idx + 1}</span>
                        {page.kind === "cover" && (
                          <span className="rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] text-white">Cover</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setZoomPage(page)}
                        className="absolute right-2 top-2 z-10 rounded bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        title="Zoom"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="relative aspect-[3/4] bg-muted/20">
                        {page.kind === "blank" ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                            <FileText className="h-8 w-8" />
                            <span className="text-xs">Blank A4</span>
                          </div>
                        ) : page.kind === "cover" ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-violet-400">
                            <ImagePlus className="h-8 w-8" />
                            <span className="max-w-[90%] truncate text-[10px]">{page.fileName}</span>
                          </div>
                        ) : page.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={page.thumb}
                            alt=""
                            className="h-full w-full object-contain"
                            style={{ transform: `rotate(${page.rotation}deg)` }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted" />
                          </div>
                        )}
                        {page.rotation !== 0 && page.kind === "page" && (
                          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                            {page.rotation}°
                          </span>
                        )}
                      </div>
                      <div className="border-t border-border p-2">
                        <p className="truncate text-[10px] text-muted">
                          {page.kind === "blank"
                            ? "Blank"
                            : page.kind === "cover"
                              ? "Cover image"
                              : `${page.fileName} · p.${(page.pageIndex ?? 0) + 1}`}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => togglePage(page.id)}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-medium",
                              page.included ? "bg-emerald-500/15 text-emerald-500" : "bg-muted/30 text-muted",
                            )}
                          >
                            {page.included ? "In" : "Out"}
                          </button>
                          <div className="flex gap-0.5">
                            {page.kind === "page" && (
                              <button type="button" onClick={() => rotatePage(page.id)} className="rounded p-1 text-muted hover:text-foreground" title="Rotate">
                                <RotateCw className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button type="button" onClick={() => duplicatePage(page.id)} className="rounded p-1 text-muted hover:text-foreground" title="Duplicate">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => addBlankPage(page.id)} className="rounded p-1 text-muted hover:text-foreground" title="Blank after">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => removePage(page.id)} className="rounded p-1 text-muted hover:text-error" title="Remove">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "preview" && (
            <div className="rounded-xl border border-border bg-card p-2">
              {previewUrl ? (
                <iframe src={previewUrl} title="Merged PDF preview" className="h-[min(70vh,720px)] w-full rounded-lg bg-white" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
                  <Eye className="h-10 w-10" />
                  <p className="text-sm">Click &ldquo;Live preview&rdquo; to render merged PDF here before downloading</p>
                  <Button variant="outline" size="sm" onClick={() => void generatePreview()} disabled={previewing}>
                    Generate preview
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Enterprise REST API — POST /api/v1/pdf/merge
              </p>
              <p className="text-sm text-muted">
                Automate PDF merging in CI/CD or backend workflows. Send base64-encoded PDFs; receive merged PDF as
                base64. Browser studio stays fully offline — API is optional for server-side batch jobs.
              </p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs leading-relaxed">{`POST /api/v1/pdf/merge
Content-Type: application/json

{
  "files": [
    { "name": "a.pdf", "base64": "JVBERi0x..." },
    { "name": "b.pdf", "base64": "JVBERi0x..." }
  ],
  "pages": [
    { "fileIndex": 0, "pageIndex": 0 },
    { "fileIndex": 1, "pageIndex": 0, "rotation": 90 }
  ],
  "options": {
    "title": "Merged Report",
    "compress": true,
    "fitToA4": true,
    "pageNumbers": true
  }
}`}</pre>
              <p className="text-xs text-muted">Limits: 20 files · 50 MB total per request</p>
            </div>
          )}
        </>
      )}

      {pendingUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 id="unlock-title" className="font-display text-lg font-semibold">Unlock PDF</h3>
            <p className="mt-1 text-sm text-muted">
              <strong>{pendingUnlock.file.name}</strong> is password-protected. Enter the password to add it to the merge queue.
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
              <Button variant="gradient" onClick={() => void unlockPending()}>
                Unlock & add
              </Button>
              <Button variant="outline" onClick={() => setPendingUnlock(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {zoomPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoomPage(null)}>
          <div className="max-h-[90vh] max-w-3xl overflow-auto rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">
                {zoomPage.kind === "page"
                  ? `${zoomPage.fileName} — page ${(zoomPage.pageIndex ?? 0) + 1}`
                  : zoomPage.kind === "cover"
                    ? "Cover page"
                    : "Blank page"}
              </p>
              <button type="button" onClick={() => setZoomPage(null)} className="rounded p-1 hover:bg-card-hover">
                <X className="h-5 w-5" />
              </button>
            </div>
            {zoomPage.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zoomPage.thumb} alt="" className="mx-auto max-h-[70vh] object-contain" style={{ transform: `rotate(${zoomPage.rotation}deg)` }} />
            ) : (
              <p className="py-12 text-center text-muted">No preview available</p>
            )}
          </div>
        </div>
      )}

      {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {(merging || previewing) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>{merging ? "Building PDF..." : "Rendering preview..."}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {lastSize !== null && !merging && (
        <p className="text-center text-sm text-emerald-500">
          Last output: {formatBytes(lastSize)} · {includedPages.length} pages
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="gradient"
          disabled={includedPages.length === 0 || merging || loadingFiles}
          onClick={() => void runMerge(true)}
        >
          {merging ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {progress}%
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Ultra PDF ({includedPages.length} pg)
            </>
          )}
        </Button>
        <Button variant="outline" disabled={includedPages.length === 0 || previewing} onClick={() => void generatePreview()}>
          <Eye className="h-4 w-4" /> Preview first
        </Button>
      </div>
    </div>
  );
}
