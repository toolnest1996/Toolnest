"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function ApiStatusPage() {
  const [status, setStatus] = useState<{ status: string; services: Record<string, string>; timestamp: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/status").then((r) => r.json()).then(setStatus);
    const interval = setInterval(() => {
      fetch("/api/v1/status").then((r) => r.json()).then(setStatus);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold">API Status</h1>
      <p className="mt-3 text-muted">Live health monitoring for ToolNest services.</p>
      {status && (
        <div className="mt-10 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            {status.status === "operational" ? (
              <CheckCircle className="h-6 w-6 text-success" />
            ) : (
              <AlertCircle className="h-6 w-6 text-error" />
            )}
            <div>
              <p className="font-semibold capitalize">{status.status}</p>
              <p className="text-xs text-muted">Last checked: {new Date(status.timestamp).toLocaleString()}</p>
            </div>
          </div>
          {Object.entries(status.services).map(([name, s]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <span className="capitalize">{name}</span>
              <span className={`text-xs font-medium uppercase ${s === "healthy" ? "text-success" : "text-error"}`}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
