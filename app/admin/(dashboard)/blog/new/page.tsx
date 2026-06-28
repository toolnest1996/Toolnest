"use client";

import { useState } from "react";
import { appNavigate } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function NewBlogPostPage() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async (status: "draft" | "published") => {
    if (!title || !content) { setError("Title and content are required."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("blog_posts").insert({
      title,
      slug: slug || autoSlug(title),
      excerpt,
      content,
      status,
      author_id: user?.id,
      published_at: status === "published" ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    appNavigate(router, "/admin/blog");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500">Blog / New Post</p>
        <h1 className="font-display text-2xl font-bold text-white">Create Post</h1>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Title</label>
          <input value={title} onChange={(e) => { setTitle(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Post title" className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="post-url-slug" className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 font-mono text-sm text-white outline-none focus:border-[#E8231A]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Excerpt</label>
          <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short summary..." className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Content (Markdown)</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your blog post in Markdown..." rows={16} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm text-white outline-none focus:border-[#E8231A]" />
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
        <div className="flex gap-3">
          <Button variant="gradient" onClick={() => handleSave("published")} disabled={saving}><Save className="h-4 w-4" /> Publish</Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>Save Draft</Button>
        </div>
      </div>
    </div>
  );
}
