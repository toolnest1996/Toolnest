export interface Category {
  slug: string;
  name: string;
  /** lucide-react icon name */
  icon: string;
  color: string;
  description: string;
}

export interface Tool {
  slug: string;
  name: string;
  description: string;
  /** category slug */
  category: string;
  /** whether a working implementation exists */
  live?: boolean;
  /** marketing badge */
  badge?: "new" | "ai" | "pro";
}
