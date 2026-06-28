import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Full page navigation — safe before App Router finishes initializing. */
export function redirectTo(href: string, replace = false): void {
  if (typeof window === "undefined") return;
  if (replace) window.location.replace(href);
  else window.location.assign(href);
}

/** Client-side navigation after hydration (user clicks, cmdk, etc.). */
export function appNavigate(
  router: AppRouterInstance,
  href: string,
  options?: { replace?: boolean },
): void {
  if (typeof window === "undefined") return;

  const navigate = () => {
    if (options?.replace) router.replace(href);
    else router.push(href);
  };

  // Defer until after the App Router action queue is wired up.
  queueMicrotask(navigate);
}
