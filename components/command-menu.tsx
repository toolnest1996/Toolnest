"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Command } from "cmdk";
import { appNavigate } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { usePublicCategories } from "@/components/public-categories-provider";
import { usePublicTools } from "@/components/public-tools-provider";
import { Icon } from "@/components/icon";

interface CommandMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const ctx = useContext(CommandMenuContext);
  if (!ctx) throw new Error("useCommandMenu must be used within CommandMenuProvider");
  return ctx;
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const publicTools = usePublicTools();
  const publicCategories = usePublicCategories();
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        const target = e.target as HTMLElement;
        if (
          e.key === "/" &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const go = (path: string) => {
    setOpen(false);
    appNavigate(router, path);
  };

  return (
    <CommandMenuContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search tools"
        className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]"
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-fade-up">
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-5 w-5 text-muted" />
            <Command.Input
              autoFocus
              placeholder={`Search ${publicTools.length} tools...`}
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-muted sm:block">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted">
              No tools found.
            </Command.Empty>
            <Command.Group
              heading="Categories"
              className="px-2 py-1 text-xs font-medium text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {publicCategories.map((c) => (
                <Command.Item
                  key={c.slug}
                  value={`category ${c.name}`}
                  onSelect={() => go(`/category/${c.slug}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm data-[selected=true]:bg-card-hover"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${c.color}22`, color: c.color }}
                  >
                    <Icon name={c.icon} className="h-4 w-4" />
                  </span>
                  {c.name}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group
              heading="Tools"
              className="px-2 py-1 text-xs font-medium text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {publicTools.map((t) => (
                <Command.Item
                  key={t.slug}
                  value={`${t.name} ${t.description} ${t.slug}`}
                  onSelect={() => go(`/tool/${t.slug}`)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm data-[selected=true]:bg-card-hover"
                >
                  <span>{t.name}</span>
                  {t.live ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted">Soon</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>
    </CommandMenuContext.Provider>
  );
}
