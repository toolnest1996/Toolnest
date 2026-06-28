/** Canonical production origin for SEO URLs. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://toolnest.io";
}

export function toolUrl(slug: string): string {
  return `${getSiteUrl()}/tool/${slug}`;
}

export function categoryUrl(slug: string): string {
  return `${getSiteUrl()}/category/${slug}`;
}
