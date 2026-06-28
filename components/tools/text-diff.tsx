"use client";

import { useMemo, useState } from "react";

interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

/** Simple line-based LCS diff. */
function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: a[i] });
      i++;
    } else {
      result.push({ type: "added", text: b[j] });
      j++;
    }
  }
  while (i < n) result.push({ type: "removed", text: a[i++] });
  while (j < m) result.push({ type: "added", text: b[j++] });
  return result;
}

export function TextDiff() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const diff = useMemo(
    () => diffLines(left.split("\n"), right.split("\n")),
    [left, right],
  );

  const added = diff.filter((d) => d.type === "added").length;
  const removed = diff.filter((d) => d.type === "removed").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <textarea
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          placeholder="Original text..."
          className="min-h-[200px] w-full rounded-2xl border border-border bg-card p-4 font-mono text-sm outline-none focus:border-primary"
        />
        <textarea
          value={right}
          onChange={(e) => setRight(e.target.value)}
          placeholder="Changed text..."
          className="min-h-[200px] w-full rounded-2xl border border-border bg-card p-4 font-mono text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-success">+{added} added</span>
        <span className="text-error">-{removed} removed</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card font-mono text-sm">
        {diff.length === 0 || (!left && !right) ? (
          <p className="p-6 text-center text-muted">
            Enter text in both panels to compare.
          </p>
        ) : (
          diff.map((line, i) => (
            <div
              key={i}
              className={
                line.type === "added"
                  ? "bg-success/10 px-4 py-0.5 text-success"
                  : line.type === "removed"
                    ? "bg-error/10 px-4 py-0.5 text-error"
                    : "px-4 py-0.5 text-muted"
              }
            >
              <span className="select-none opacity-50">
                {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
              </span>
              {line.text || "\u00A0"}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
