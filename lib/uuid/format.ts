import { bytesToHex } from "./bytes";

export type UuidOutputFormat =
  | "standard"
  | "uppercase"
  | "lowercase"
  | "no-hyphens"
  | "braces"
  | "urn";

export function formatUuid(bytes: Uint8Array, format: UuidOutputFormat = "standard"): string {
  const hex = bytesToHex(bytes);
  const hyphenated = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  switch (format) {
    case "uppercase":
      return hyphenated.toUpperCase();
    case "lowercase":
      return hyphenated.toLowerCase();
    case "no-hyphens":
      return hex.toLowerCase();
    case "braces":
      return `{${hyphenated.toLowerCase()}}`;
    case "urn":
      return `urn:uuid:${hyphenated.toLowerCase()}`;
    default:
      return hyphenated.toLowerCase();
  }
}

export function normalizeUuidInput(input: string): string {
  return input
    .trim()
    .replace(/^urn:uuid:/i, "")
    .replace(/^\{|\}$/g, "")
    .replace(/-/g, "")
    .toLowerCase();
}
