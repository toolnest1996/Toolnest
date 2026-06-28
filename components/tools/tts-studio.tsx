"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Download,
  Globe,
  Heart,
  History,
  Layers,
  Loader2,
  Mic,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Square,
  Subtitles,
  UploadCloud,
  Volume2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { extractTextFromFile } from "./case-converter-utils";
import {
  analyzeTtsInput,
  applyPronunciationDictionary,
  buildLocaleOptions,
  chunkText,
  DEFAULT_TTS_OPTIONS,
  EMOTION_PRESETS,
  estimateDurationSec,
  fetchCloudVoices,
  fetchUrlText,
  filterEdgeVoices,
  formatVoiceDisplayName,
  generateWebVTT,
  getBrowserVoices,
  groupVoicesByLocale,
  loadDictionary,
  loadFavorites,
  loadHistory,
  loadBookmarks,
  localeLabel,
  pauseBrowser,
  pickDefaultVoiceForLocale,
  QUICK_LOCALE_PICKS,
  resumeBrowser,
  resolveExportVoice,
  saveBookmarks,
  saveDictionary,
  saveHistory,
  SETTINGS_KEY,
  speakBrowser,
  splitChapters,
  stopBrowser,
  synthesizeCloud,
  toggleFavorite,
  TTS_SAMPLES,
  type EdgeVoiceDto,
  type BrowserVoiceDto,
  type PronunciationEntry,
  type TtsBookmark,
  type TtsOptions,
  type VoiceGenderFilter,
} from "./tts-utils";

type Tab = "studio" | "voices" | "chapters" | "subtitles" | "dictionary" | "batch" | "library" | "api";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export function TtsStudio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const voicesSynced = useRef(false);
  const voicesLoaded = useRef(false);
  const skipSettingsSave = useRef(true);
  const fallbackToastShown = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState("");
  const [options, setOptions] = useState<TtsOptions>({ ...DEFAULT_TTS_OPTIONS });
  const [tab, setTab] = useState<Tab>("studio");
  const [edgeVoices, setEdgeVoices] = useState<EdgeVoiceDto[]>([]);
  const [browserVoices, setBrowserVoices] = useState<BrowserVoiceDto[]>([]);
  const [browserVoiceURI, setBrowserVoiceURI] = useState("");
  const [voiceQuery, setVoiceQuery] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<VoiceGenderFilter>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<ReturnType<typeof loadHistory>>([]);
  const [dictionary, setDictionary] = useState<PronunciationEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<TtsBookmark[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [highlightChar, setHighlightChar] = useState(-1);
  const [urlInput, setUrlInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [batchTexts, setBatchTexts] = useState("");
  const cancelSpeak = useRef<(() => void) | null>(null);

  const docKey = useMemo(() => String(text.length > 0 ? text.slice(0, 64) : "empty"), [text]);
  const processedText = useMemo(
    () => applyPronunciationDictionary(text, dictionary),
    [text, dictionary],
  );
  const analysis = useMemo(() => analyzeTtsInput(text), [text]);
  const chapters = useMemo(() => (text.trim() ? splitChapters(text) : []), [text]);
  const estSec = useMemo(() => estimateDurationSec(processedText, options.rate), [processedText, options.rate]);
  const vtt = useMemo(() => (processedText.trim() ? generateWebVTT(processedText, options.rate) : ""), [processedText, options.rate]);

  const filteredVoices = useMemo(
    () => filterEdgeVoices(edgeVoices, localeFilter, genderFilter, voiceQuery),
    [edgeVoices, localeFilter, genderFilter, voiceQuery],
  );

  const cloudVoiceGroups = useMemo(() => {
    const groups = groupVoicesByLocale(filteredVoices);
    const current = edgeVoices.find((v) => v.id === options.voiceId);
    if (current && !filteredVoices.some((v) => v.id === current.id)) {
      return [{ locale: current.locale, label: localeLabel(current.locale), voices: [current] }, ...groups];
    }
    return groups;
  }, [filteredVoices, edgeVoices, options.voiceId]);

  const localeOptions = useMemo(() => buildLocaleOptions(edgeVoices), [edgeVoices]);

  const visibleVoiceGroups = useMemo(() => {
    if (localeFilter !== "all" || voiceQuery.trim().length >= 2) return cloudVoiceGroups;
    const slice = cloudVoiceGroups.slice(0, 12);
    const current = edgeVoices.find((v) => v.id === options.voiceId);
    if (!current) return slice;
    const currentGroup = cloudVoiceGroups.find((g) => g.locale === current.locale);
    if (currentGroup && !slice.some((g) => g.locale === currentGroup.locale)) {
      return [currentGroup, ...slice];
    }
    return slice;
  }, [cloudVoiceGroups, localeFilter, voiceQuery, edgeVoices, options.voiceId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setOptions((o) => ({ ...o, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
    setFavorites(loadFavorites());
    setHistory(loadHistory());
    setDictionary(loadDictionary());
    setBookmarks(loadBookmarks("empty"));
    skipSettingsSave.current = false;
  }, []);

  useEffect(() => {
    setBookmarks(loadBookmarks(docKey));
  }, [docKey]);

  useEffect(() => {
    if (skipSettingsSave.current) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    if (!mounted) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncBrowserVoices = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const next = getBrowserVoices();
        setBrowserVoices((prev) => {
          if (
            prev.length === next.length &&
            prev.every((voice, index) => voice.voiceURI === next[index]?.voiceURI)
          ) {
            return prev;
          }
          return next;
        });
      }, 150);
    };

    syncBrowserVoices();
    window.speechSynthesis.onvoiceschanged = syncBrowserVoices;
    return () => {
      if (timer) clearTimeout(timer);
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [mounted]);

  useEffect(() => {
    if (voicesLoaded.current) return;
    voicesLoaded.current = true;
    setLoadingVoices(true);
    fetchCloudVoices()
      .then(({ voices, source }) => {
        setEdgeVoices(voices);
        if (source === "fallback" && !fallbackToastShown.current) {
          fallbackToastShown.current = true;
          toast.info(`Loaded ${voices.length} cached voices (live list unavailable)`);
        }
      })
      .catch(() => toast.error("Could not load cloud voices"))
      .finally(() => setLoadingVoices(false));
  }, []);

  useEffect(() => {
    if (!edgeVoices.length || voicesSynced.current) return;
    voicesSynced.current = true;
    setOptions((current) => {
      const valid = edgeVoices.some((v) => v.id === current.voiceId);
      if (valid) return current;
      const fallback =
        edgeVoices.find((v) => v.id === DEFAULT_TTS_OPTIONS.voiceId) ?? edgeVoices[0]!;
      return { ...current, voiceId: fallback.id, lang: fallback.locale };
    });
  }, [edgeVoices]);

  const applyLocalePick = (locale: string) => {
    setLocaleFilter(locale);
    const voice = pickDefaultVoiceForLocale(edgeVoices, locale);
    if (voice) {
      setOptions((o) => ({ ...o, voiceId: voice.id, lang: voice.locale }));
      toast.success(`${localeLabel(locale)} · ${formatVoiceDisplayName(voice)}`);
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      stopBrowser();
    };
  }, [audioUrl]);

  const updateOption = <K extends keyof TtsOptions>(key: K, value: TtsOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  const loadFile = async (file: File) => {
    setLoadingFile(true);
    try {
      const { text: imported, format } = await extractTextFromFile(file);
      setText(imported);
      setFileName(`${file.name} (${format})`);
      toast.success(`Imported ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoadingFile(false);
    }
  };

  const loadFromUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      const extracted = await fetchUrlText(urlInput.trim());
      setText(extracted);
      toast.success("Page text loaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "URL fetch failed");
    }
  };

  const previewSpeak = useCallback(
    (slice?: string) => {
      const content = slice ?? processedText;
      if (!content.trim()) return;
      stopBrowser();
      setSpeaking(true);
      setPaused(false);
      cancelSpeak.current = speakBrowser(content, options, browserVoiceURI, {
        onEnd: () => {
          setSpeaking(false);
          setPaused(false);
        },
        onError: (m) => {
          toast.error(m);
          setSpeaking(false);
        },
        onBoundary: (i) => setHighlightChar(i),
      });
    },
    [processedText, options, browserVoiceURI],
  );

  const handleExport = async (slice?: string) => {
    const content = slice ?? processedText;
    if (!content.trim()) return;
    setExporting(true);
    try {
      const { options: exportOptions, switched, reason } = resolveExportVoice(content, options, edgeVoices);
      if (switched) {
        toast.info(reason ?? "Using a matching voice for this export");
      }
      const { blob, ext } = await synthesizeCloud(content, exportOptions);
      if (blob.size === 0) {
        throw new Error("Audio file is empty — choose a voice matching your text language.");
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      downloadBlob(blob, `speech.${ext}`);
      setHistory(saveHistory(content.slice(0, 500), exportOptions.voiceId));
      toast.success(`Exported ${formatBytes(blob.size)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportLong = async () => {
    const parts = chunkText(processedText);
    if (!parts.length) return;
    if (parts.length === 1) {
      await handleExport();
      return;
    }
    setExporting(true);
    try {
      const { options: exportOptions, switched, reason } = resolveExportVoice(processedText, options, edgeVoices);
      if (switched) {
        toast.info(reason ?? "Using a matching voice for this export");
      }
      const zip = new JSZip();
      for (let i = 0; i < parts.length; i++) {
        const { blob, ext } = await synthesizeCloud(parts[i]!, exportOptions);
        if (blob.size === 0) throw new Error(`Part ${i + 1} is empty — check voice language.`);
        zip.file(`part-${String(i + 1).padStart(2, "0")}.${ext}`, blob);
      }
      const z = await zip.generateAsync({ type: "blob" });
      downloadBlob(z, "speech-chapters.zip");
      toast.success(`ZIP with ${parts.length} parts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch export failed");
    } finally {
      setExporting(false);
    }
  };

  const runBatchExport = async () => {
    const items = batchTexts.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) {
      toast.error("Add batch items separated by ---");
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < items.length; i++) {
        const { options: exportOptions } = resolveExportVoice(items[i]!, options, edgeVoices);
        const { blob, ext } = await synthesizeCloud(items[i]!, exportOptions);
        if (blob.size === 0) throw new Error(`Batch item ${i + 1} is empty — check voice language.`);
        zip.file(`batch-${i + 1}.${ext}`, blob);
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "tts-batch.zip");
      toast.success(`Batch ZIP · ${items.length} files`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setExporting(false);
    }
  };

  const addBookmark = () => {
    const label = `Bookmark at char ${highlightChar >= 0 ? highlightChar : text.length}`;
    const next = [
      ...bookmarks,
      { id: crypto.randomUUID(), label, offset: highlightChar >= 0 ? highlightChar : 0, at: Date.now() },
    ];
    setBookmarks(next);
    saveBookmarks(docKey, next);
    toast.success("Bookmark added");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Words" value={analysis.wordCount} />
        <Stat label="Est. time" value={`${estSec}s`} />
        <Stat label="Voices" value={edgeVoices.length || "—"} />
        <Stat label="Locales" value={localeOptions.length || "—"} />
        <Stat label="Engine" value={options.engine} />
        <Stat label="Detected" value={analysis.detected} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void loadFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center sm:p-8",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
        )}
      >
        {loadingFile ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="mb-2 h-8 w-8 text-primary" />}
        <p className="font-display text-lg font-semibold">Ultra Text to Speech Studio</p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          320+ neural voices · 140+ locales · emotion & SSML · browser preview · MP3/WebM export · PDF/DOCX/URL import ·
          subtitles & chapters
        </p>
        {fileName && <p className="mt-2 text-xs text-primary">{fileName}</p>}
        <input ref={fileRef} type="file" accept=".txt,.csv,.json,.md,.docx,.pdf,text/*,application/json,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TTS_SAMPLES.map((s) => (
          <button key={s.id} type="button" onClick={() => setText(s.text)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:border-primary/40">
            {s.label}
          </button>
        ))}
      </div>

      {analysis.suggestions.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-primary">
            <Wand2 className="h-4 w-4" />
            Smart assist
          </p>
          <ul className="list-inside list-disc text-muted">
            {analysis.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {(
          [
            ["studio", Mic],
            ["voices", Volume2],
            ["chapters", Layers],
            ["subtitles", Subtitles],
            ["dictionary", Sparkles],
            ["batch", Layers],
            ["library", History],
            ["api", Globe],
          ] as const
        ).map(([id, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium capitalize", tab === id ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground")}>
            <Icon className="h-3.5 w-3.5" />
            {id}
          </button>
        ))}
      </div>

      {tab === "studio" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {(["browser", "cloud"] as const).map((e) => (
                <button key={e} type="button" onClick={() => updateOption("engine", e)} className={cn("rounded-md px-3 py-1.5 text-sm capitalize", options.engine === e ? "bg-primary text-white" : "text-muted")}>
                  {e} {e === "browser" ? "preview" : "export"}
                </button>
              ))}
            </div>
            <Button variant="gradient" onClick={() => previewSpeak()} disabled={speaking || !processedText.trim()}>
              <Play className="h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline" onClick={() => { if (paused) { resumeBrowser(); setPaused(false); } else { pauseBrowser(); setPaused(true); } }} disabled={!speaking}>
              <Pause className="h-4 w-4" />
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="outline" onClick={() => { stopBrowser(); setSpeaking(false); setPaused(false); }}>
              <Square className="h-4 w-4" />
              Stop
            </Button>
            <Button variant="outline" onClick={() => handleExport()} disabled={exporting || !processedText.trim()}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export MP3
            </Button>
            <Button variant="outline" onClick={exportLong} disabled={exporting || !processedText.trim()}>
              <Download className="h-4 w-4" />
              Long text ZIP
            </Button>
            <Button variant="outline" onClick={addBookmark}>
              <Bookmark className="h-4 w-4" />
              Bookmark
            </Button>
            <Button variant="outline" onClick={() => setShowSettings((s) => !s)} className={cn(showSettings && "border-primary text-primary")}>
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Field label={`Language (${localeOptions.length})`}>
              <select
                value={localeFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setLocaleFilter(next);
                  if (next !== "all") {
                    const voice = pickDefaultVoiceForLocale(edgeVoices, next);
                    if (voice) {
                      setOptions((o) => ({ ...o, voiceId: voice.id, lang: voice.locale }));
                    }
                  }
                }}
                className={inputClass()}
              >
                <option value="all">All languages ({edgeVoices.length} voices)</option>
                {localeOptions.map((o) => (
                  <option key={o.locale} value={o.locale}>
                    {o.label} ({o.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Cloud voice (${filteredVoices.length})`}>
              {!mounted || loadingVoices ? (
                <div className={`${inputClass()} flex items-center text-sm text-muted`}>Loading voices…</div>
              ) : (
                <select
                  value={options.voiceId}
                  onChange={(e) => {
                    updateOption("voiceId", e.target.value);
                    const v = edgeVoices.find((x) => x.id === e.target.value);
                    if (v) {
                      updateOption("lang", v.locale);
                      setLocaleFilter(v.locale);
                    }
                  }}
                  className={inputClass()}
                  disabled={filteredVoices.length === 0}
                >
                  {visibleVoiceGroups.map((group) => (
                    <optgroup key={group.locale} label={group.label}>
                      {group.voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {formatVoiceDisplayName(v)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Export format">
              <select value={options.exportFormat} onChange={(e) => updateOption("exportFormat", e.target.value as TtsOptions["exportFormat"])} className={inputClass()}>
                <option value="mp3">MP3</option>
                <option value="webm">WebM (Opus)</option>
              </select>
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Quick languages</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_LOCALE_PICKS.filter((p) => edgeVoices.some((v) => v.locale === p.locale)).map((pick) => (
                <button
                  key={pick.locale}
                  type="button"
                  onClick={() => applyLocalePick(pick.locale)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs",
                    options.lang === pick.locale ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                  )}
                >
                  {pick.label}
                </button>
              ))}
            </div>
          </div>

          {mounted && (
            <Field label="Browser preview voice">
              <select
                value={browserVoiceURI}
                onChange={(e) => setBrowserVoiceURI(e.target.value)}
                className={inputClass()}
              >
                <option value="">Auto ({options.lang})</option>
                {browserVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex flex-wrap gap-2">
            {EMOTION_PRESETS.map((e) => (
              <button key={e.id} type="button" onClick={() => updateOption("emotion", e.id)} className={cn("rounded-lg border px-3 py-1.5 text-xs", options.emotion === e.id ? "border-primary bg-primary/10" : "border-border")}>
                {e.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Speed ${options.rate.toFixed(1)}×`}>
              <input type="range" min={0.5} max={2} step={0.05} value={options.rate} onChange={(e) => updateOption("rate", Number(e.target.value))} className="w-full accent-primary" />
            </Field>
            <Field label={`Pitch ${options.pitch.toFixed(1)}`}>
              <input type="range" min={0.5} max={2} step={0.05} value={options.pitch} onChange={(e) => updateOption("pitch", Number(e.target.value))} className="w-full accent-primary" />
            </Field>
            <Field label={`Volume ${options.volume.toFixed(1)}`}>
              <input type="range" min={0} max={1.5} step={0.05} value={options.volume} onChange={(e) => updateOption("volume", Number(e.target.value))} className="w-full accent-primary" />
            </Field>
          </div>

          {showSettings && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={options.useSsml} onChange={(e) => updateOption("useSsml", e.target.checked)} />
                Use raw SSML (cloud export)
              </label>
              {options.useSsml && (
                <textarea value={options.ssmlRaw} onChange={(e) => updateOption("ssmlRaw", e.target.value)} rows={4} className={`${inputClass()} font-mono text-xs`} placeholder="<speak>...</speak>" />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com/article" className={`${inputClass()} flex-1`} />
            <Button variant="outline" onClick={loadFromUrl}>Load URL</Button>
          </div>

          <Field label="Text to speak">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              className={`${inputClass()} min-h-[280px] resize-y py-2 text-sm leading-relaxed`}
              placeholder="Enter or paste text, import PDF/DOCX, or load a web page…"
              aria-label="Text to speech input"
            />
          </Field>

          {audioUrl && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-sm font-medium">Last export</p>
              <audio ref={audioRef} src={audioUrl} controls className="w-full" />
            </div>
          )}
        </>
      )}

      {tab === "voices" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {edgeVoices.length} neural voices across {localeOptions.length} locales — US/UK/India English, Bengali, Hindi, Arabic, Urdu, and 130+ more.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Search">
              <input value={voiceQuery} onChange={(e) => setVoiceQuery(e.target.value)} className={inputClass()} placeholder="Jenny, Bengali, en-US, …" />
            </Field>
            <Field label="Language / region">
              <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className={inputClass()}>
                <option value="all">All ({edgeVoices.length})</option>
                {localeOptions.map((o) => (
                  <option key={o.locale} value={o.locale}>
                    {o.label} ({o.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gender">
              <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value as VoiceGenderFilter)} className={inputClass()}>
                <option value="all">All</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="child">Child</option>
              </select>
            </Field>
          </div>
          {loadingVoices ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted">{filteredVoices.length} voices shown</p>
              <ul className="max-h-[520px] space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                {filteredVoices.map((v) => (
                  <li
                    key={v.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50",
                      options.voiceId === v.id && "bg-primary/10",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        updateOption("voiceId", v.id);
                        updateOption("lang", v.locale);
                        setLocaleFilter(v.locale);
                        toast.success(formatVoiceDisplayName(v));
                      }}
                      className="flex-1 text-left text-sm"
                    >
                      <span className="font-medium">{formatVoiceDisplayName(v)}</span>{" "}
                      <span className="text-muted">
                        · {localeLabel(v.locale)} ({v.locale})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFavorites(toggleFavorite(v.id))}
                      className="ml-2 text-muted hover:text-primary"
                      aria-label="Favorite"
                    >
                      <Heart className={cn("h-4 w-4", favorites.includes(v.id) && "fill-primary text-primary")} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "chapters" && (
        <div className="space-y-3">
          {chapters.length === 0 ? (
            <p className="text-sm text-muted">Add text with blank lines or # headings for chapters.</p>
          ) : (
            chapters.map((ch) => (
              <div key={ch.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{ch.title}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => previewSpeak(ch.text)}><Play className="h-3 w-3" /> Preview</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExport(ch.text)}><Download className="h-3 w-3" /> Export</Button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-muted">{ch.text}</p>
              </div>
            ))
          )}
          {bookmarks.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Bookmarks</p>
              <ul className="space-y-1">
                {bookmarks.map((b) => (
                  <li key={b.id}>
                    <button type="button" className="text-sm text-primary hover:underline" onClick={() => previewSpeak(text.slice(b.offset))}>
                      {b.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "subtitles" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Estimated WebVTT cues from sentence timing (~150 WPM adjusted by speed).</p>
          <textarea readOnly value={vtt} rows={12} className={`${inputClass()} font-mono text-xs`} />
          <Button variant="outline" disabled={!vtt} onClick={() => downloadBlob(new Blob([vtt], { type: "text/vtt" }), "subtitles.vtt")}>
            <Download className="h-4 w-4" />
            Download VTT
          </Button>
        </div>
      )}

      {tab === "dictionary" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Replace words before synthesis (simple find/replace pronunciation hints).</p>
          {dictionary.map((entry, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <input value={entry.word} onChange={(e) => { const d = [...dictionary]; d[i] = { ...entry, word: e.target.value }; setDictionary(d); }} className={inputClass()} placeholder="Word" />
              <input value={entry.speakAs} onChange={(e) => { const d = [...dictionary]; d[i] = { ...entry, speakAs: e.target.value }; setDictionary(d); }} className={inputClass()} placeholder="Speak as" />
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDictionary([...dictionary, { word: "", speakAs: "" }])}>Add entry</Button>
            <Button variant="gradient" onClick={() => { saveDictionary(dictionary); toast.success("Dictionary saved"); }}>Save</Button>
          </div>
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Separate items with <code className="rounded bg-muted px-1">---</code> — each exported as MP3 in a ZIP.</p>
          <textarea value={batchTexts} onChange={(e) => setBatchTexts(e.target.value)} rows={8} className={`${inputClass()} text-sm`} />
          <Button variant="gradient" onClick={runBatchExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export batch ZIP
          </Button>
        </div>
      )}

      {tab === "library" && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Favorite voices</p>
          <p className="text-xs text-muted">{favorites.length ? favorites.join(", ") : "None — star voices in Voices tab."}</p>
          <p className="text-sm font-medium">History</p>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => { setText(h.text); updateOption("voiceId", h.voiceId); setTab("studio"); }} className="w-full rounded-lg border border-border p-3 text-left text-xs hover:border-primary/40">
                  <span className="text-muted">{new Date(h.at).toLocaleString()} · {h.voiceId}</span>
                  <p className="truncate">{h.text}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "api" && (
        <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 text-xs">{`POST /api/v1/tts
GET  /api/v1/tts/voices
POST /api/v1/tts/extract  { "url": "https://..." }

{
  "text": "Hello world",
  "voice": "en-US-JennyNeural",
  "lang": "en-US",
  "format": "mp3",
  "emotion": "cheerful",
  "rate": 1,
  "pitch": 1,
  "volume": 1
}`}</pre>
      )}
    </div>
  );
}
