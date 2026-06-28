"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Eye, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Post { id: string; slug: string; title: string; status: string; excerpt: string | null; created_at: string; published_at: string | null; }

export default function AdminBlogPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("blog_posts").select("*").order("created_at", { ascending: false }).then(({ data }: { data: any }) => {
      if (data) setPosts(data);
      setLoading(false);
    });
  }, [supabase]);

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    setPosts((p) => p.filter((x) => x.id !== id));
  };

  const togglePublish = async (post: Post) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    const publishedAt = newStatus === "published" ? new Date().toISOString() : null;
    await supabase.from("blog_posts").update({ status: newStatus, published_at: publishedAt }).eq("id", post.id);
    setPosts((p) => p.map((x) => x.id === post.id ? { ...x, status: newStatus, published_at: publishedAt } : x));
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Manage / Blog</p>
          <h1 className="font-display text-2xl font-bold text-white">Blog CMS</h1>
        </div>
        <Link href="/admin/blog/new">
          <Button variant="gradient" size="sm"><Plus className="h-4 w-4" /> New Post</Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="font-semibold text-white">No blog posts yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500"><th className="px-4 py-3 font-medium">Title</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/50">
                  <td className="px-4 py-3"><p className="font-medium text-white">{p.title}</p><p className="text-xs text-slate-500">/{p.slug}</p></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${p.status === "published" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <Link href={`/admin/blog/${p.id}/edit`} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"><Edit className="h-4 w-4" /></Link>
                    {p.status === "published" && <Link href={`/blog/${p.slug}`} target="_blank" className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"><Eye className="h-4 w-4" /></Link>}
                    <button onClick={() => togglePublish(p)} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Toggle publish"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => deletePost(p.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
