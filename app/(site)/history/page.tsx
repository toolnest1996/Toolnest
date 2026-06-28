"use client";

import { useEffect, useState } from "react";
import { redirectTo } from "@/lib/navigation";
import { History, Trash2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface FileHistoryItem {
  id: string;
  tool_slug: string;
  file_name: string;
  file_size: number;
  result_url: string | null;
  status: string;
  created_at: string;
}

export default function HistoryPage() {
  const supabase = createClient();
  const [files, setFiles] = useState<FileHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { redirectTo("/login"); return; }

      const { data } = await supabase
        .from("file_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setFiles(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const deleteFile = async (id: string) => {
    await supabase.from("file_history").delete().eq("id", id);
    setFiles((f) => f.filter((x) => x.id !== id));
  };

  const statusColors: Record<string, string> = {
    done: "bg-success/15 text-success",
    processing: "bg-sky-500/15 text-sky-400",
    pending: "bg-accent/15 text-accent",
    failed: "bg-error/15 text-error",
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-bold">File History</h1>
      <p className="mt-1 text-sm text-muted">Your recently processed files.</p>

      {files.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-12 text-center">
          <History className="mx-auto mb-3 h-12 w-12 text-muted" />
          <p className="font-display text-lg font-bold">No files yet</p>
          <p className="mt-1 text-sm text-muted">Use a tool and your files will appear here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-border last:border-0 hover:bg-card-hover">
                  <td className="px-4 py-3 font-medium">{file.file_name}</td>
                  <td className="px-4 py-3 text-muted">{file.tool_slug}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {file.file_size > 1048576
                      ? `${(file.file_size / 1048576).toFixed(1)} MB`
                      : `${(file.file_size / 1024).toFixed(1)} KB`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusColors[file.status] || ""}`}>
                      {file.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(file.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {file.result_url && (
                        <a href={file.result_url} download className="rounded p-1 text-muted hover:text-foreground">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      <button onClick={() => deleteFile(file.id)} className="rounded p-1 text-muted hover:text-error">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
