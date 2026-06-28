"use client";

import { createContext, useContext } from "react";
import { tools as allTools } from "@/lib/data/tools";
import type { Tool } from "@/lib/data/types";

const PublicToolsContext = createContext<Tool[] | null>(null);

export function PublicToolsProvider({
  tools,
  children,
}: {
  tools: Tool[];
  children: React.ReactNode;
}) {
  return (
    <PublicToolsContext.Provider value={tools}>{children}</PublicToolsContext.Provider>
  );
}

/** Enabled tools on the public site; falls back to full catalog outside the provider. */
export function usePublicTools(): Tool[] {
  return useContext(PublicToolsContext) ?? allTools;
}
