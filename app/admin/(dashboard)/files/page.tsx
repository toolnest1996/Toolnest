"use client";

import { useEffect, useState } from "react";
import { HardDrive, Trash2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Job { id: string; tool_slug: string; status: string; progress: number; created_at: string; error: string | null; }
interface FileRow { id: string; tool_slug: string; file_name: string; file_size: number; status: string; created_at: string; }

export default function AdminFilesPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: j }, { data: f }] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("file_history").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (j) setJobs(j);
      if (f) setFiles(f);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const deleteFile = async (id: string) => {
    await supabase.from("file_history").delete().eq("id", id);
    setFiles((f) => f.filter((x) => x.id !== id));
  };

  const statusBadge: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    running: "bg-sky-500/15 text-sky-400 animate-pulse",
    processing: "bg-sky-500/15 text-sky-400 animate-pulse",
    done: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-rose-500/15 text-rose-400",
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500">Manage / Files & Jobs</p>
        <h1 className="font-display text-2xl font-bold text-white">Files & Jobs</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
          <p className="font-display text-2xl font-bold text-white">{files.length}</p>
          <p className="text-xs text-slate-500">Total files</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
          <p className="font-display text-2xl font-bold text-white">{jobs.length}</p>
          <p className="text-xs text-slate-500">Total jobs</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
          <p className="font-display text-2xl font-bold text-white">{jobs.filter((j) => j.status === "running").length}</p>
          <p className="text-xs text-slate-500">Running now</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 font-semibold text-white">Recent Files</h2>
        {files.length === 0 ? (
          <div className="py-10 text-center"><HardDrive className="mx-auto mb-2 h-8 w-8 text-slate-600" /><p className="text-sm text-slate-500">No files yet</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500"><th className="pb-2 font-medium">File</th><th className="pb-2 font-medium">Tool</th><th className="pb-2 font-medium">Size</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium"></th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-2.5 text-white">{f.file_name}</td>
                  <td className="py-2.5 text-slate-400">{f.tool_slug}</td>
                  <td className="py-2.5 font-mono text-xs text-slate-500">{(f.file_size / 1024).toFixed(1)} KB</td>
                  <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusBadge[f.status] || ""}`}>{f.status}</span></td>
                  <td className="py-2.5 text-xs text-slate-500">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="py-2.5"><button onClick={() => deleteFile(f.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
