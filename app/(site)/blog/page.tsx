import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description: "Tips, tutorials and updates from ToolNest.",
};

export default async function BlogPage() {
  const supabase = await createServerSupabase();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at, created_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold">
          ToolNest <span className="text-gradient">Blog</span>
        </h1>
        <p className="mt-3 text-muted">Tips, tutorials and product updates.</p>
      </div>

      {!posts?.length ? (
        <p className="mt-16 text-center text-muted">No posts yet. Check back soon!</p>
      ) : (
        <div className="mt-12 space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <h2 className="font-display text-xl font-bold group-hover:text-primary">{post.title}</h2>
              {post.excerpt && <p className="mt-2 text-sm text-muted line-clamp-2">{post.excerpt}</p>}
              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.published_at || post.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-primary">
                  Read more <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
