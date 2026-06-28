import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("blog_posts").select("title, excerpt").eq("slug", slug).eq("status", "published").single();
  if (!data) return { title: "Post not found" };
  return { title: data.title, description: data.excerpt || undefined };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to blog
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{post.title}</h1>
        <p className="mt-3 text-sm text-muted">
          {new Date(post.published_at || post.created_at).toLocaleDateString("en", {
            year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </header>
      <div className="prose prose-invert mt-10 max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
        {post.content}
      </div>
    </article>
  );
}
