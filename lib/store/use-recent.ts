"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentStore {
  recent: string[];
  add: (slug: string) => void;
}

export const useRecent = create<RecentStore>()(
  persist(
    (set) => ({
      recent: [],
      add: (slug) =>
        set((s) => ({
          recent: [slug, ...s.recent.filter((x) => x !== slug)].slice(0, 12),
        })),
    }),
    { name: "toolnest-recent" },
  ),
);
