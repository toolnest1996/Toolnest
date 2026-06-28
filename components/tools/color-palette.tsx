"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Copy, Check, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Swatch {
  hex: string;
  locked: boolean;
}

function randomHex(): string {
  const n = Math.floor(Math.random() * 0xffffff);
  return `#${n.toString(16).padStart(6, "0")}`;
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export function ColorPalette() {
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [copied, setCopied] = useState("");

  const generate = useCallback(() => {
    setSwatches((prev) =>
      prev.length
        ? prev.map((s) => (s.locked ? s : { ...s, hex: randomHex() }))
        : Array.from({ length: 5 }, () => ({ hex: randomHex(), locked: false })),
    );
  }, []);

  useEffect(() => {
    setSwatches(Array.from({ length: 5 }, () => ({ hex: randomHex(), locked: false })));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generate]);

  const copy = async (hex: string) => {
    await navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(""), 1200);
  };

  const toggleLock = (i: number) =>
    setSwatches((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, locked: !s.locked } : s)),
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Press <kbd className="rounded border border-border px-1.5">Space</kbd>{" "}
          or the button to generate. Lock colors you like.
        </p>
        <Button variant="gradient" onClick={generate}>
          <RefreshCw className="h-4 w-4" /> Generate
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {swatches.map((s, i) => {
          const light = isLight(s.hex);
          return (
            <div
              key={i}
              className="group relative flex h-44 flex-col items-center justify-end rounded-2xl p-4 transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: s.hex }}
            >
              <div className="absolute right-3 top-3 flex gap-1">
                <button
                  onClick={() => toggleLock(i)}
                  className={light ? "text-black/70" : "text-white/80"}
                  aria-label={s.locked ? "Unlock" : "Lock"}
                >
                  {s.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => copy(s.hex)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-sm font-semibold uppercase ${
                  light ? "text-black" : "text-white"
                }`}
              >
                {copied === s.hex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
                {s.hex}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
