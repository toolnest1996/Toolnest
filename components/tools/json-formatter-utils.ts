export type JsonParseSuccess = { ok: true; value: unknown };
export type JsonParseFailure = {
  ok: false;
  message: string;
  line?: number;
  column?: number;
  position?: number;
};
export type JsonParseResult = JsonParseSuccess | JsonParseFailure;

export interface JsonStats {
  inputBytes: number;
  outputBytes: number;
  keys: number;
  objects: number;
  arrays: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  maxDepth: number;
}

export type JsonIndent = 2 | 4 | "tab";

export const JSON_SAMPLES: { id: string; label: string; hint: string; json: string }[] = [
  {
    id: "api",
    label: "API response",
    hint: "Nested status + data array",
    json: `{
  "status": "success",
  "code": 200,
  "data": {
    "users": [
      { "id": 1, "name": "Asha", "role": "admin", "active": true },
      { "id": 2, "name": "Rahim", "role": "editor", "active": true },
      { "id": 3, "name": "Priya", "role": "viewer", "active": false }
    ],
    "meta": { "page": 1, "total": 3, "hasMore": false }
  }
}`,
  },
  {
    id: "config",
    label: "App config",
    hint: "Environment-style settings",
    json: `{
  "app": "ToolNest",
  "version": "1.0.0",
  "features": { "darkMode": true, "analytics": false },
  "limits": { "maxUploadMB": 50, "toolsPerDay": 100 },
  "allowedOrigins": ["https://toolcloud.in", "http://localhost:3000"]
}`,
  },
  {
    id: "broken",
    label: "Broken JSON",
    hint: "Trailing comma + comments — test Repair",
    json: `{
  // user profile
  "name": "Faruk",
  "email": "user@example.com",
  "tags": ["dev", "tools",],
  "settings": {
    "theme": "dark",
  }
}`,
  },
  {
    id: "graphql",
    label: "GraphQL variables",
    hint: "Query variables object",
    json: `{
  "query": "GetUser",
  "variables": {
    "id": "usr_8f2a",
    "includePosts": true,
    "limit": 10
  },
  "operationName": "GetUser"
}`,
  },
];

export function indentChar(indent: JsonIndent): string | number {
  return indent === "tab" ? "\t" : indent;
}

export function parseJson(input: string): JsonParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: "Paste or upload JSON to get started." };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    const posMatch = message.match(/position (\d+)/i);
    let line: number | undefined;
    let column: number | undefined;
    let position: number | undefined;
    if (posMatch) {
      position = Number.parseInt(posMatch[1]!, 10);
      const before = input.slice(0, position);
      const lines = before.split("\n");
      line = lines.length;
      column = (lines.at(-1)?.length ?? 0) + 1;
    }
    return { ok: false, message, line, column, position };
  }
}

/** Strip comments, trailing commas, and BOM — common copy-paste issues. */
export function repairJson(raw: string): string {
  let s = raw.replace(/^\uFEFF/, "");
  s = s.replace(/\/\/[^\n]*/g, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s.trim();
}

export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonKeys(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

export function stringifyJson(value: unknown, indent: JsonIndent, minify = false): string {
  if (minify) return JSON.stringify(value);
  return JSON.stringify(value, null, indentChar(indent));
}

export function analyzeJson(value: unknown, inputBytes: number, output = ""): JsonStats {
  let keys = 0;
  let objects = 0;
  let arrays = 0;
  let strings = 0;
  let numbers = 0;
  let booleans = 0;
  let nulls = 0;
  let maxDepth = 0;

  function walk(v: unknown, depth: number) {
    maxDepth = Math.max(maxDepth, depth);
    if (v === null) {
      nulls++;
      return;
    }
    if (Array.isArray(v)) {
      arrays++;
      v.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof v === "object") {
      objects++;
      for (const key of Object.keys(v as Record<string, unknown>)) {
        keys++;
        walk((v as Record<string, unknown>)[key], depth + 1);
      }
      return;
    }
    if (typeof v === "string") strings++;
    else if (typeof v === "number") numbers++;
    else if (typeof v === "boolean") booleans++;
  }

  walk(value, 0);

  return {
    inputBytes,
    outputBytes: new TextEncoder().encode(output).length,
    keys,
    objects,
    arrays,
    strings,
    numbers,
    booleans,
    nulls,
    maxDepth,
  };
}

export function flattenJson(value: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};

  if (value === null || value === undefined) {
    if (prefix) out[prefix] = String(value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const key = prefix ? `${prefix}[${i}]` : `[${i}]`;
      if (item !== null && typeof item === "object") {
        Object.assign(out, flattenJson(item, key));
      } else {
        out[key] = JSON.stringify(item);
      }
    });
    return out;
  }

  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === "object") {
        Object.assign(out, flattenJson(v, key));
      } else {
        out[key] = JSON.stringify(v);
      }
    }
    return out;
  }

  if (prefix) out[prefix] = JSON.stringify(value);
  return out;
}

export function queryJsonPath(value: unknown, path: string): unknown {
  const trimmed = path.trim().replace(/^\$\.?/, "");
  if (!trimmed) return value;

  const segments: (string | number)[] = [];
  const re = /([^[\].]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    if (match[1]) segments.push(match[1]);
    else if (match[2] !== undefined) segments.push(Number.parseInt(match[2], 10));
  }

  let current: unknown = value;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof seg === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[seg];
    } else {
      if (typeof current !== "object" || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return current;
}

export function jsonToCsv(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (typeof value[0] !== "object" || value[0] === null || Array.isArray(value[0])) return null;

  const rows = value as Record<string, unknown>[];
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (cell: unknown) => {
    const s = cell === null || cell === undefined ? "" : String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export function escapeJsonString(input: string): string {
  return JSON.stringify(input);
}

export function treeMatches(value: unknown, query: string, path = "$"): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (path.toLowerCase().includes(q)) return true;

  if (value === null) return "null".includes(q);
  if (typeof value === "boolean") return String(value).includes(q);
  if (typeof value === "number") return String(value).includes(q);
  if (typeof value === "string") return value.toLowerCase().includes(q);

  if (Array.isArray(value)) {
    return value.some((item, i) => treeMatches(item, q, `${path}[${i}]`));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([k, v]) =>
      k.toLowerCase().includes(q) || treeMatches(v, q, `${path}.${k}`),
    );
  }

  return false;
}
