/** Server-only Adsterra config — read from env, never NEXT_PUBLIC_. */
export function getAdsterraApiKey(): string {
  return process.env.ADSTERRA_API_KEY ?? "";
}

export function isAdsterraConfigured(): boolean {
  return getAdsterraApiKey().length > 0;
}

/** Adsterra Publisher API base URL. */
export const ADSTERRA_API_BASE = "https://api3.adsterratools.com/publisher";
