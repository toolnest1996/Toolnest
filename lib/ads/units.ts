/** Adsterra / HighPerformanceFormat units for tool pages. */
export const AD_INVOKE_BASE = "https://www.highperformanceformat.com";

/** Leaderboard 728×90 — tool bottom, homepage inline, site footer. */
const LEADERBOARD_728x90 = {
  zone: "ad_tool_bottom",
  key: "b1780628a1c912b6a395bf47ae9fea58",
  width: 728,
  height: 90,
} as const;

/** Medium rectangle 300×250 — site-wide sticky sidebar. */
const RECTANGLE_300x250 = {
  zone: "ad_sidebar",
  key: "e2efc9b76a67508b450d9bc0abf06d9b",
  width: 300,
  height: 250,
} as const;

export const SITE_AD_UNITS = {
  /** Desktop sticky sidebar on every page (hero + tools + categories). */
  sidebar: RECTANGLE_300x250,
  /** Homepage / category grid — full-width row every N tools. */
  inlineLeaderboard: { ...LEADERBOARD_728x90, zone: "ad_home_inline" },
  /** Above site footer on every page. */
  footerLeaderboard: { ...LEADERBOARD_728x90, zone: "ad_footer" },
} as const;

export type SiteAdUnitKey = keyof typeof SITE_AD_UNITS;

export const TOOL_AD_UNITS = {
  /** Desktop — below tool (728×90). */
  bottom: LEADERBOARD_728x90,
  /** Mobile — below tool (320×50). */
  mobileBottom: {
    zone: "ad_tool_bottom",
    key: "c2bfb926f258a4c01a2aa011ab5b42f5",
    width: 320,
    height: 50,
  },
  /** Desktop sidebar — medium rectangle (300×250). */
  sidebar: RECTANGLE_300x250,
  /** Desktop sidebar — skyscraper (160×600). */
  skyscraper: {
    zone: "ad_sidebar",
    key: "4c42e20bfad33b1c08e5171a0afa8b0e",
    width: 160,
    height: 600,
  },
} as const;

export type ToolAdUnitKey = keyof typeof TOOL_AD_UNITS;
