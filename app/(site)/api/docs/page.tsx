"use client";

import { useEffect, useState } from "react";

interface Endpoint {
  method: string;
  path: string;
  description: string;
}

export default function ApiDocsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);

  useEffect(() => {
    fetch("/api/v1/docs").then((r) => r.json()).then((d) => setEndpoints(d.endpoints || []));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold">API Documentation</h1>
      <p className="mt-3 text-muted">ToolNest REST API v1.0 — Base URL: <code className="rounded bg-card px-2 py-0.5 text-sm">/api/v1</code></p>
      <div className="mt-10 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-left text-xs text-muted">
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.path + ep.method} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3"><span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{ep.method}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{ep.path}</td>
                <td className="px-4 py-3 text-muted">{ep.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
