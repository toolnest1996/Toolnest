"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";

type Mode =
  | "base64-encode"
  | "base64-decode"
  | "url-encode"
  | "url-decode"
  | "uppercase"
  | "lowercase"
  | "titlecase"
  | "reverse"
  | "dedupe"
  | "uuid"
  | "hash";

export function TextUtilities({ mode }: { mode: Mode }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const process = async () => {
    try {
      switch (mode) {
        case "base64-encode":
          setOutput(btoa(unescape(encodeURIComponent(input))));
          break;
        case "base64-decode":
          setOutput(decodeURIComponent(escape(atob(input))));
          break;
        case "url-encode":
          setOutput(encodeURIComponent(input));
          break;
        case "url-decode":
          setOutput(decodeURIComponent(input));
          break;
        case "uppercase":
          setOutput(input.toUpperCase());
          break;
        case "lowercase":
          setOutput(input.toLowerCase());
          break;
        case "titlecase":
          setOutput(input.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()));
          break;
        case "reverse":
          setOutput(input.split("").reverse().join(""));
          break;
        case "dedupe":
          setOutput([...new Set(input.split("\n").filter(Boolean))].join("\n"));
          break;
        case "uuid":
          setOutput(crypto.randomUUID());
          break;
        case "hash": {
          const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
          setOutput([...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""));
          break;
        }
      }
    } catch {
      setOutput("Error processing input");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const showInput = mode !== "uuid";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {showInput && (
        <Field label="Input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className={`${inputClass()} min-h-[120px] resize-y py-2`}
            placeholder="Enter text..."
          />
        </Field>
      )}
      <div className="flex gap-2">
        <Button variant="gradient" onClick={process}>
          <RefreshCw className="h-4 w-4" />
          {mode === "uuid" ? "Generate" : "Convert"}
        </Button>
        {output && (
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy
          </Button>
        )}
      </div>
      {output && (
        <Field label="Output">
          <textarea readOnly value={output} rows={6} className={`${inputClass()} min-h-[120px] resize-y py-2 font-mono text-xs`} />
        </Field>
      )}
    </div>
  );
}
