"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesStore {
  favorites: string[];
  toggle: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
}

export const useFavorites = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggle: (slug) =>
        set((s) => ({
          favorites: s.favorites.includes(slug)
            ? s.favorites.filter((x) => x !== slug)
            : [...s.favorites, slug],
        })),
      isFavorite: (slug) => get().favorites.includes(slug),
    }),
    { name: "toolnest-favorites" },
  ),
);
