"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeSetting = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  resolvedTheme: "light" | "dark" | undefined;
  themes: ThemeSetting[];
  forcedTheme?: "light" | "dark";
}

const STORAGE_KEY = "theme";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(theme: ThemeSetting): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  enableSystem = true,
}: {
  children: ReactNode;
  defaultTheme?: ThemeSetting;
  enableSystem?: boolean;
}) {
  const [theme, setThemeState] = useState<ThemeSetting>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeSetting | null;
      if (stored && (stored === "light" || stored === "dark" || (stored === "system" && enableSystem))) {
        setThemeState(stored);
      }
    } catch {
      /* ignore */
    }
  }, [enableSystem]);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme("system");
      setResolvedTheme(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeSetting) => {
    setThemeState(next);
  }, []);

  const themes = useMemo<ThemeSetting[]>(
    () => (enableSystem ? ["light", "dark", "system"] : ["light", "dark"]),
    [enableSystem],
  );

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme, themes }),
    [theme, setTheme, resolvedTheme, themes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      resolvedTheme: undefined,
      themes: ["light", "dark", "system"],
    };
  }
  return ctx;
}
