"use client";

import { useEffect, useState } from "react";
import { appNavigate } from "@/lib/navigation";
import { useParams, useRouter } from "next/navigation";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/admin/audit";
import { Button } from "@/components/ui/button";

export default function EditBlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [post, setPost] = useState({ title: "", slug: "", excerpt: "", content: "", status: "draft" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("blog_posts").select("*").eq("id", id).single().then(({ data }: { data: any }) => {
      if (data) setPost(data);
      setLoading(false);
    });
  }, [supabase, id]);

  const save = async () => {
    setSaving(true);
    const publishedAt = post.status === "published" ? new Date().toISOString() : null;
    await supabase.from("blog_posts").update({ ...post, published_at: publishedAt }).eq("id", id);
    await logAudit("update_blog_post", "blog_posts", id);
    setSaving(false);
    toast.success("Post saved");
    appNavigate(router, "/admin/blog");
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  const inputClass = "h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <h1 className="font-display text-2xl font-bold text-white">Edit Post</h1>
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <input value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} placeholder="Title" className={inputClass} />
        <input value={post.slug} onChange={(e) => setPost({ ...post, slug: e.target.value })} placeholder="Slug" className={inputClass} />
        <input value={post.excerpt || ""} onChange={(e) => setPost({ ...post, excerpt: e.target.value })} placeholder="Excerpt" className={inputClass} />
        <select value={post.status} onChange={(e) => setPost({ ...post, status: e.target.value })} className={inputClass}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <textarea value={post.content || ""} onChange={(e) => setPost({ ...post, content: e.target.value })} rows={16} placeholder="Content (markdown)" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-[#E8231A] font-mono" />
        <Button variant="gradient" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Post"}</Button>
      </div>
    </div>
  );
}
