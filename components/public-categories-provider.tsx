"use client";

import { createContext, useContext } from "react";
import { categories as allCategories } from "@/lib/data/categories";
import type { Category } from "@/lib/data/types";

const PublicCategoriesContext = createContext<Category[] | null>(null);

export function PublicCategoriesProvider({
  categories,
  children,
}: {
  categories: Category[];
  children: React.ReactNode;
}) {
  return (
    <PublicCategoriesContext.Provider value={categories}>{children}</PublicCategoriesContext.Provider>
  );
}

/** Enabled categories on the public site; falls back to full catalog outside the provider. */
export function usePublicCategories(): Category[] {
  return useContext(PublicCategoriesContext) ?? allCategories;
}
