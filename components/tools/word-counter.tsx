"use client";

import { useMemo, useState } from "react";

export function WordCounter() {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, "").length;
    const sentences = trimmed ? (trimmed.match(/[.!?]+/g) || []).length || 1 : 0;
    const paragraphs = trimmed
      ? trimmed.split(/\n+/).filter(Boolean).length
      : 0;
    const readingTime = Math.ceil(words / 200);
    return { words, chars, charsNoSpaces, sentences, paragraphs, readingTime };
  }, [text]);

  const cards = [
    { label: "Words", value: stats.words },
    { label: "Characters", value: stats.chars },
    { label: "Characters (no spaces)", value: stats.charsNoSpaces },
    { label: "Sentences", value: stats.sentences },
    { label: "Paragraphs", value: stats.paragraphs },
    { label: "Reading time", value: `${stats.readingTime} min` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-4 text-center"
          >
            <div className="font-display text-2xl font-bold text-primary">
              {c.value}
            </div>
            <div className="mt-1 text-xs text-muted">{c.label}</div>
          </div>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start typing or paste your text here..."
        className="min-h-[300px] w-full rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}
