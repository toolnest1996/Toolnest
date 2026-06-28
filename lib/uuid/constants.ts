/** RFC 4122 well-known namespace UUIDs for v3/v5 name hashing. */
export const UUID_NAMESPACES = {
  dns: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  url: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  oid: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  x500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
} as const;

export type UuidNamespaceKey = keyof typeof UUID_NAMESPACES;

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";
export const MAX_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

/** 100-ns intervals between UUID epoch (1582-10-15) and Unix epoch (1970-01-01). */
export const UUID_EPOCH_OFFSET = 0x01b21dd213814000n;

export const UUID_VERSIONS = ["v1", "v3", "v4", "v5", "v6", "v7", "v8", "nil", "max"] as const;
export type UuidVersion = (typeof UUID_VERSIONS)[number];

export const MAX_BULK_COUNT = 1_000_000;
export const BULK_WARN_THRESHOLD = 100_000;
