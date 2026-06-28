function bytesToBinary(data: Uint8Array): string {
  let s = "";
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]!);
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

type WhirlpoolCtor = new () => { update: (m: string) => void; finalize: () => string };

let WhirlpoolClass: WhirlpoolCtor | null = null;

function getWhirlpool(): WhirlpoolCtor {
  if (!WhirlpoolClass) {
    // CJS package — loaded once on first use (browser + Node)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WhirlpoolClass = (require("whirlpool-hash") as { Whirlpool: WhirlpoolCtor }).Whirlpool;
  }
  return WhirlpoolClass;
}

export function whirlpool(data: Uint8Array): Uint8Array {
  const h = new (getWhirlpool())();
  h.update(bytesToBinary(data));
  return hexToBytes(h.finalize());
}
