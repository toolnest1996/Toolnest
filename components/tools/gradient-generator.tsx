"use client";

import { useState } from "react";
import { Copy, Check, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";

function randomHex(): string {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
}

export function GradientGenerator() {
  const [from, setFrom] = useState("#E8231A");
  const [to, setTo] = useState("#FF6B35");
  const [angle, setAngle] = useState(135);
  const [type, setType] = useState<"linear" | "radial">("linear");
  const [copied, setCopied] = useState(false);

  const css =
    type === "linear"
      ? `linear-gradient(${angle}deg, ${from}, ${to})`
      : `radial-gradient(circle, ${from}, ${to})`;
  const rule = `background: ${css};`;

  const copy = async () => {
    await navigator.clipboard.writeText(rule);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="From">
            <input
              type="color"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-12 w-full cursor-pointer rounded-lg border border-border bg-card"
            />
          </Field>
          <Field label="To">
            <input
              type="color"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-12 w-full cursor-pointer rounded-lg border border-border bg-card"
            />
          </Field>
        </div>

        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "linear" | "radial")}
            className={inputClass()}
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
        </Field>

        {type === "linear" && (
          <Field label={`Angle: ${angle}°`}>
            <input
              type="range"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
        )}

        <Button
          variant="outline"
          onClick={() => {
            setFrom(randomHex());
            setTo(randomHex());
          }}
        >
          <Shuffle className="h-4 w-4" /> Randomize
        </Button>

        <div className="rounded-xl border border-border bg-card p-4">
          <code className="block break-all font-mono text-sm text-muted">
            {rule}
          </code>
          <Button variant="gradient" size="sm" className="mt-3" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy CSS"}
          </Button>
        </div>
      </div>

      <div
        className="min-h-[300px] rounded-2xl border border-border"
        style={{ background: css }}
      />
    </div>
  );
}
