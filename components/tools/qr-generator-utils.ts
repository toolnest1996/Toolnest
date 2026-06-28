/**
 * Ultra QR Code Generator — matrix renderer, 25+ payload types, styling, bulk, exports.
 * 100% client-side via qrcode + canvas. No server required for generation.
 */

import QRCode from "qrcode";

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────────── */

export type QrContentType =
  | "url" | "text" | "wifi" | "vcard" | "email" | "sms" | "phone"
  | "whatsapp" | "telegram" | "zoom" | "meet" | "maps" | "geo"
  | "instagram" | "facebook" | "twitter" | "linkedin" | "tiktok" | "youtube"
  | "calendar" | "bitcoin" | "ethereum" | "upi"
  | "pdf" | "image" | "video" | "audio" | "menu" | "form" | "api"
  | "appstore" | "playstore" | "custom";

export type ErrorCorrection = "L" | "M" | "Q" | "H";
export type ModuleStyle = "square" | "rounded" | "dots";
export type EyeStyle = "square" | "rounded" | "circle";
export type FrameStyle = "none" | "border" | "banner" | "card";
export type GradientMode = "none" | "linear";

export interface QrDesign {
  foreground: string;
  background: string;
  transparentBg: boolean;
  gradientMode: GradientMode;
  gradientColor2: string;
  gradientAngle: number;
  errorCorrection: ErrorCorrection;
  margin: number;
  size: number;
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
  frame: FrameStyle;
  frameColor: string;
  frameText: string;
  logoDataUrl: string;
  logoSize: number;
}

export interface QrWifiFields {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface QrVcardFields {
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
}

export interface QrCalendarFields {
  title: string;
  location: string;
  start: string;
  end: string;
  description: string;
}

export interface QrCryptoFields {
  address: string;
  amount: string;
  label: string;
  message: string;
}

export interface QrUpiFields {
  vpa: string;
  name: string;
  amount: string;
  note: string;
}

export interface QrContentFields {
  url: string;
  text: string;
  custom: string;
  wifi: QrWifiFields;
  vcard: QrVcardFields;
  email: { to: string; subject: string; body: string };
  sms: { phone: string; body: string };
  phone: string;
  whatsapp: { phone: string; message: string };
  telegram: string;
  zoom: string;
  meet: string;
  maps: { query: string; lat: string; lng: string };
  geo: { lat: string; lng: string };
  social: string;
  calendar: QrCalendarFields;
  crypto: QrCryptoFields;
  upi: QrUpiFields;
  mediaUrl: string;
  appId: string;
}

export interface QrPayload {
  type: QrContentType;
  fields: QrContentFields;
  design: QrDesign;
  /** Human label for history/bulk */
  label: string;
}

export interface QrInfo {
  version: number;
  moduleCount: number;
  dataLength: number;
  capacity: number;
  errorCorrection: ErrorCorrection;
  estimatedScannability: "excellent" | "good" | "fair" | "poor";
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  encoded: string;
  info: QrInfo;
}

export interface BulkRow {
  label: string;
  type: QrContentType;
  content: string;
  error?: string;
}

export const DEFAULT_DESIGN: QrDesign = {
  foreground: "#0d0d1a",
  background: "#ffffff",
  transparentBg: false,
  gradientMode: "none",
  gradientColor2: "#6366f1",
  gradientAngle: 45,
  errorCorrection: "M",
  margin: 2,
  size: 512,
  moduleStyle: "rounded",
  eyeStyle: "rounded",
  frame: "none",
  frameColor: "#6366f1",
  frameText: "SCAN ME",
  logoDataUrl: "",
  logoSize: 22,
};

export const DEFAULT_FIELDS: QrContentFields = {
  url: "https://toolnest.io",
  text: "Hello from ToolNest!",
  custom: "",
  wifi: { ssid: "", password: "", encryption: "WPA", hidden: false },
  vcard: { firstName: "", lastName: "", org: "", title: "", phone: "", email: "", url: "", address: "" },
  email: { to: "", subject: "", body: "" },
  sms: { phone: "", body: "" },
  phone: "",
  whatsapp: { phone: "", message: "" },
  telegram: "",
  zoom: "",
  meet: "",
  maps: { query: "", lat: "", lng: "" },
  geo: { lat: "", lng: "" },
  social: "",
  calendar: { title: "", location: "", start: "", end: "", description: "" },
  crypto: { address: "", amount: "", label: "", message: "" },
  upi: { vpa: "", name: "", amount: "", note: "" },
  mediaUrl: "",
  appId: "",
};

export const CONTENT_TYPE_LABELS: Record<QrContentType, string> = {
  url: "URL / Website",
  text: "Plain text",
  wifi: "Wi-Fi network",
  vcard: "vCard contact",
  email: "Email",
  sms: "SMS",
  phone: "Phone call",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  zoom: "Zoom meeting",
  meet: "Google Meet",
  maps: "Google Maps",
  geo: "GPS coordinates",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  calendar: "Calendar event",
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  upi: "UPI payment",
  pdf: "PDF link",
  image: "Image link",
  video: "Video link",
  audio: "Audio link",
  menu: "Digital menu",
  form: "Online form",
  api: "API endpoint",
  appstore: "App Store",
  playstore: "Google Play",
  custom: "Custom data",
};

export const CONTENT_CATEGORIES: { label: string; types: QrContentType[] }[] = [
  { label: "Link & Text", types: ["url", "text", "custom"] },
  { label: "Connect", types: ["wifi", "email", "sms", "phone", "whatsapp", "telegram", "zoom", "meet"] },
  { label: "Location", types: ["maps", "geo"] },
  { label: "Contact", types: ["vcard"] },
  { label: "Social", types: ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube"] },
  { label: "Calendar & Crypto", types: ["calendar", "bitcoin", "ethereum", "upi"] },
  { label: "Media & Apps", types: ["pdf", "image", "video", "audio", "menu", "form", "api", "appstore", "playstore"] },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Payload builders
 * ──────────────────────────────────────────────────────────────────────────── */

function escWifi(s: string): string {
  return s.replace(/([\\;,":])/g, "\\$1");
}

function formatIcsDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildSocialUrl(type: QrContentType, handle: string): string {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return "";
  if (h.startsWith("http")) return h;
  switch (type) {
    case "instagram": return `https://instagram.com/${h}`;
    case "facebook": return h.includes("facebook.com") ? h : `https://facebook.com/${h}`;
    case "twitter": return `https://x.com/${h}`;
    case "linkedin": return h.includes("linkedin.com") ? h : `https://linkedin.com/in/${h}`;
    case "tiktok": return `https://tiktok.com/@${h}`;
    case "youtube": return h.includes("youtube.com") || h.includes("youtu.be") ? h : `https://youtube.com/@${h}`;
    default: return h;
  }
}

export function buildEncodedPayload(type: QrContentType, fields: QrContentFields): string {
  switch (type) {
    case "url":
      return fields.url.trim();
    case "text":
      return fields.text;
    case "custom":
      return fields.custom;
    case "wifi": {
      const w = fields.wifi;
      if (!w.ssid.trim()) return "";
      let p = `WIFI:T:${w.encryption === "nopass" ? "nopass" : w.encryption};S:${escWifi(w.ssid)};`;
      if (w.encryption !== "nopass" && w.password) p += `P:${escWifi(w.password)};`;
      if (w.hidden) p += "H:true;";
      return p + ";";
    }
    case "vcard": {
      const v = fields.vcard;
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      if (v.firstName || v.lastName) lines.push(`N:${v.lastName};${v.firstName};;;`, `FN:${v.firstName} ${v.lastName}`.trim());
      if (v.org) lines.push(`ORG:${v.org}`);
      if (v.title) lines.push(`TITLE:${v.title}`);
      if (v.phone) lines.push(`TEL:${v.phone}`);
      if (v.email) lines.push(`EMAIL:${v.email}`);
      if (v.url) lines.push(`URL:${v.url}`);
      if (v.address) lines.push(`ADR:;;${v.address};;;;`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    }
    case "email": {
      const e = fields.email;
      if (!e.to.trim()) return "";
      const params = new URLSearchParams();
      if (e.subject) params.set("subject", e.subject);
      if (e.body) params.set("body", e.body);
      const q = params.toString();
      return `mailto:${e.to.trim()}${q ? `?${q}` : ""}`;
    }
    case "sms": {
      const s = fields.sms;
      if (!s.phone.trim()) return "";
      return s.body ? `sms:${s.phone}?body=${encodeURIComponent(s.body)}` : `sms:${s.phone}`;
    }
    case "phone":
      return fields.phone.trim() ? `tel:${fields.phone.trim()}` : "";
    case "whatsapp": {
      const w = fields.whatsapp;
      const num = w.phone.replace(/\D/g, "");
      if (!num) return "";
      return w.message ? `https://wa.me/${num}?text=${encodeURIComponent(w.message)}` : `https://wa.me/${num}`;
    }
    case "telegram": {
      const t = fields.telegram.trim().replace(/^@/, "");
      return t ? (t.startsWith("http") ? t : `https://t.me/${t}`) : "";
    }
    case "zoom": {
      const z = fields.zoom.trim();
      return z ? (z.startsWith("http") ? z : `https://zoom.us/j/${z}`) : "";
    }
    case "meet": {
      const m = fields.meet.trim();
      return m ? (m.startsWith("http") ? m : `https://meet.google.com/${m}`) : "";
    }
    case "maps": {
      const mp = fields.maps;
      if (mp.lat && mp.lng) return `https://maps.google.com/?q=${mp.lat},${mp.lng}`;
      if (mp.query.trim()) return `https://maps.google.com/?q=${encodeURIComponent(mp.query.trim())}`;
      return "";
    }
    case "geo": {
      const g = fields.geo;
      return g.lat && g.lng ? `geo:${g.lat},${g.lng}` : "";
    }
    case "instagram":
    case "facebook":
    case "twitter":
    case "linkedin":
    case "tiktok":
    case "youtube":
      return buildSocialUrl(type, fields.social);
    case "calendar": {
      const c = fields.calendar;
      if (!c.title && !c.start) return "";
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT"];
      if (c.title) lines.push(`SUMMARY:${c.title}`);
      if (c.location) lines.push(`LOCATION:${c.location}`);
      if (c.description) lines.push(`DESCRIPTION:${c.description}`);
      const ds = formatIcsDate(c.start);
      const de = formatIcsDate(c.end);
      if (ds) lines.push(`DTSTART:${ds}`);
      if (de) lines.push(`DTEND:${de}`);
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\r\n");
    }
    case "bitcoin": {
      const b = fields.crypto;
      if (!b.address.trim()) return "";
      const params = new URLSearchParams();
      if (b.amount) params.set("amount", b.amount);
      if (b.label) params.set("label", b.label);
      if (b.message) params.set("message", b.message);
      const q = params.toString();
      return `bitcoin:${b.address.trim()}${q ? `?${q}` : ""}`;
    }
    case "ethereum": {
      const e = fields.crypto;
      if (!e.address.trim()) return "";
      const params = new URLSearchParams();
      if (e.amount) params.set("value", e.amount);
      const q = params.toString();
      return `ethereum:${e.address.trim()}${q ? `?${q}` : ""}`;
    }
    case "upi": {
      const u = fields.upi;
      if (!u.vpa.trim()) return "";
      const params = new URLSearchParams();
      params.set("pa", u.vpa.trim());
      if (u.name) params.set("pn", u.name);
      if (u.amount) params.set("am", u.amount);
      if (u.note) params.set("tn", u.note);
      return `upi://pay?${params.toString()}`;
    }
    case "pdf":
    case "image":
    case "video":
    case "audio":
    case "menu":
    case "form":
    case "api":
      return fields.mediaUrl.trim();
    case "appstore": {
      const id = fields.appId.trim();
      return id ? (id.startsWith("http") ? id : `https://apps.apple.com/app/id${id}`) : "";
    }
    case "playstore": {
      const id = fields.appId.trim();
      return id ? (id.startsWith("http") ? id : `https://play.google.com/store/apps/details?id=${id}`) : "";
    }
    default:
      return "";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * QR matrix analysis
 * ──────────────────────────────────────────────────────────────────────────── */

const CAPACITY: Record<ErrorCorrection, number[]> = {
  L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953],
  M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666, 711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331],
  Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482, 509, 565, 611, 661, 715, 751, 805, 868, 908, 982, 1030, 1112, 1168, 1228, 1283, 1351, 1423, 1499, 1579, 1663],
  H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 149, 174, 186, 206, 224, 244, 261, 287, 303, 321, 335, 353, 371, 385, 406, 427, 445, 468, 496, 517, 535, 559, 579, 599, 625, 646, 666, 687, 711],
};

export function analyzeQr(encoded: string, ec: ErrorCorrection): QrInfo {
  let version = 1;
  let moduleCount = 21;
  try {
    const qr = QRCode.create(encoded, { errorCorrectionLevel: ec });
    version = qr.version;
    moduleCount = qr.modules.size;
  } catch { /* empty */ }

  const byteLen = new TextEncoder().encode(encoded).length;
  const capTable = CAPACITY[ec];
  const capacity = capTable[Math.min(version - 1, capTable.length - 1)] ?? 0;
  const ratio = capacity > 0 ? byteLen / capacity : 1;

  let estimatedScannability: QrInfo["estimatedScannability"] = "excellent";
  if (ratio > 0.85) estimatedScannability = "fair";
  else if (ratio > 0.65) estimatedScannability = "good";
  if (byteLen === 0) estimatedScannability = "poor";

  return { version, moduleCount, dataLength: byteLen, capacity, errorCorrection: ec, estimatedScannability };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Custom matrix renderer
 * ──────────────────────────────────────────────────────────────────────────── */

function isFinder(r: number, c: number, size: number): boolean {
  if (r < 7 && c < 7) return true;
  if (r < 7 && c >= size - 7) return true;
  if (r >= size - 7 && c < 7) return true;
  return false;
}

function drawFinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  modulePx: number,
  style: EyeStyle,
  color: string | CanvasGradient | CanvasPattern,
) {
  const s = modulePx * 7;
  ctx.fillStyle = color;
  if (style === "circle") {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const r = style === "rounded" ? modulePx * 1.2 : 0;
    roundRect(ctx, x, y, s, s, r);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x + modulePx, y + modulePx, modulePx * 5, modulePx * 5, r * 0.7);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x + modulePx * 2, y + modulePx * 2, modulePx * 3, modulePx * 3, r * 0.5);
    ctx.fill();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function makeGradient(ctx: CanvasRenderingContext2D, design: QrDesign, w: number, h: number): CanvasGradient | string {
  if (design.gradientMode !== "linear") return design.foreground;
  const angle = (design.gradientAngle * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.max(w, h);
  const x0 = cx - (Math.cos(angle) * len) / 2;
  const y0 = cy - (Math.sin(angle) * len) / 2;
  const x1 = cx + (Math.cos(angle) * len) / 2;
  const y1 = cy + (Math.sin(angle) * len) / 2;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, design.foreground);
  g.addColorStop(1, design.gradientColor2);
  return g;
}

function drawModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  modulePx: number,
  style: ModuleStyle,
  color: string | CanvasGradient | CanvasPattern,
) {
  ctx.fillStyle = color;
  const pad = modulePx * 0.08;
  const px = x + pad;
  const py = y + pad;
  const ps = modulePx - pad * 2;
  if (style === "dots") {
    ctx.beginPath();
    ctx.arc(x + modulePx / 2, y + modulePx / 2, ps / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "rounded") {
    roundRect(ctx, px, py, ps, ps, ps * 0.35);
    ctx.fill();
  } else {
    ctx.fillRect(px, py, ps, ps);
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderQr(payload: QrPayload): Promise<RenderResult> {
  const encoded = buildEncodedPayload(payload.type, payload.fields);
  const design = payload.design;
  const info = analyzeQr(encoded, design.errorCorrection);

  if (!encoded) {
    const canvas = document.createElement("canvas");
    canvas.width = design.size;
    canvas.height = design.size;
    return { canvas, dataUrl: "", encoded: "", info };
  }

  const qr = QRCode.create(encoded, { errorCorrectionLevel: design.errorCorrection });
  const modules = qr.modules;
  const count = modules.size;
  const framePad = design.frame === "none" ? 0 : design.frame === "banner" ? 48 : 24;
  const qrCanvasSize = design.size - framePad * 2;
  const modulePx = qrCanvasSize / (count + design.margin * 2);
  const qrPixelSize = modulePx * (count + design.margin * 2);

  const canvas = document.createElement("canvas");
  canvas.width = design.size;
  canvas.height = design.size + (design.frame === "banner" ? 36 : 0);
  const ctx = canvas.getContext("2d")!;

  if (!design.transparentBg) {
    ctx.fillStyle = design.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const offsetX = (design.size - qrPixelSize) / 2;
  const offsetY = framePad + (design.size - framePad * 2 - qrPixelSize) / 2;

  const fillColor = makeGradient(ctx, design, design.size, design.size);

  // Draw modules
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!modules.get(r, c)) continue;
      const x = offsetX + (c + design.margin) * modulePx;
      const y = offsetY + (r + design.margin) * modulePx;
      if (isFinder(r, c, count)) continue;
      drawModule(ctx, x, y, modulePx, design.moduleStyle, fillColor);
    }
  }

  // Finder patterns
  const finders: [number, number][] = [[0, 0], [0, count - 7], [count - 7, 0]];
  for (const [fr, fc] of finders) {
    drawFinder(ctx, offsetX + (fc + design.margin) * modulePx, offsetY + (fr + design.margin) * modulePx, modulePx, design.eyeStyle, fillColor);
  }

  // Logo overlay
  if (design.logoDataUrl && design.logoSize > 0) {
    try {
      const img = await loadImage(design.logoDataUrl);
      const logoPx = (qrPixelSize * design.logoSize) / 100;
      const lx = offsetX + (qrPixelSize - logoPx) / 2;
      const ly = offsetY + (qrPixelSize - logoPx) / 2;
      ctx.fillStyle = design.transparentBg ? "rgba(255,255,255,0.92)" : design.background;
      roundRect(ctx, lx - 4, ly - 4, logoPx + 8, logoPx + 8, 8);
      ctx.fill();
      ctx.drawImage(img, lx, ly, logoPx, logoPx);
    } catch { /* logo load fail — skip */ }
  }

  // Frame
  if (design.frame === "border" || design.frame === "card") {
    ctx.strokeStyle = design.frameColor;
    ctx.lineWidth = design.frame === "card" ? 6 : 3;
    const r = design.frame === "card" ? 16 : 0;
    roundRect(ctx, offsetX - 12, offsetY - 12, qrPixelSize + 24, qrPixelSize + 24, r);
    ctx.stroke();
  }
  if (design.frame === "banner") {
    const by = canvas.height - 36;
    ctx.fillStyle = design.frameColor;
    ctx.fillRect(0, by, canvas.width, 36);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(design.frameText, canvas.width / 2, by + 18);
  }

  const dataUrl = canvas.toDataURL("image/png");
  return { canvas, dataUrl, encoded, info };
}

/* ────────────────────────────────────────────────────────────────────────────
 * SVG export
 * ──────────────────────────────────────────────────────────────────────────── */

export function renderSvg(encoded: string, design: QrDesign): string {
  if (!encoded) return "";
  const qr = QRCode.create(encoded, { errorCorrectionLevel: design.errorCorrection });
  const modules = qr.modules;
  const count = modules.size;
  const size = design.size;
  const modulePx = size / (count + design.margin * 2);
  const offset = design.margin * modulePx;

  let paths = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!modules.get(r, c) || isFinder(r, c, count)) continue;
      const x = offset + c * modulePx;
      const y = offset + r * modulePx;
      if (design.moduleStyle === "dots") {
        paths += `<circle cx="${x + modulePx / 2}" cy="${y + modulePx / 2}" r="${modulePx * 0.42}"/>`;
      } else {
        const rx = design.moduleStyle === "rounded" ? modulePx * 0.25 : 0;
        paths += `<rect x="${x + 1}" y="${y + 1}" width="${modulePx - 2}" height="${modulePx - 2}" rx="${rx}"/>`;
      }
    }
  }

  const gradId = "g1";
  const gradDef = design.gradientMode === "linear"
    ? `<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${design.foreground}"/><stop offset="100%" stop-color="${design.gradientColor2}"/></linearGradient></defs>`
    : "";
  const fill = design.gradientMode === "linear" ? `url(#${gradId})` : design.foreground;
  const bg = design.transparentBg ? "none" : design.background;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${gradDef}
<rect width="100%" height="100%" fill="${bg}"/>
<g fill="${fill}">${paths}</g>
</svg>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Export helpers
 * ──────────────────────────────────────────────────────────────────────────── */

export type ExportFormat = "png" | "svg" | "pdf" | "webp" | "jpg" | "eps";

export async function exportCanvas(canvas: HTMLCanvasElement, format: ExportFormat, quality = 0.92): Promise<Blob> {
  switch (format) {
    case "png":
      return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("PNG failed")), "image/png"));
    case "webp":
      return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("WEBP failed")), "image/webp", quality));
    case "jpg":
      return new Promise((res, rej) => {
        const c = document.createElement("canvas");
        c.width = canvas.width;
        c.height = canvas.height;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(canvas, 0, 0);
        c.toBlob((b) => b ? res(b) : rej(new Error("JPG failed")), "image/jpeg", quality);
      });
    case "svg": {
      // Fallback: embed PNG in SVG for complex styling
      const dataUrl = canvas.toDataURL("image/png");
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
      return new Blob([svg], { type: "image/svg+xml" });
    }
    case "eps": {
      const dataUrl = canvas.toDataURL("image/png");
      const eps = `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${canvas.width} ${canvas.height}\n%%EndComments\n${canvas.width} ${canvas.height} scale\n${dataUrl}\n%%EOF\n`;
      return new Blob([eps], { type: "application/postscript" });
    }
    case "pdf": {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      return doc.output("blob");
    }
    default:
      return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("export failed")), "image/png"));
  }
}

export function exportSvgString(encoded: string, design: QrDesign): Blob {
  return new Blob([renderSvg(encoded, design)], { type: "image/svg+xml" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Bulk CSV
 * ──────────────────────────────────────────────────────────────────────────── */

export function parseBulkCsv(text: string): BulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const rows: BulkRow[] = [];
  const start = lines[0].toLowerCase().includes("label") || lines[0].toLowerCase().includes("content") ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length >= 2) {
      rows.push({ label: parts[0], type: "url", content: parts[1] });
    } else if (parts[0]) {
      rows.push({ label: `Row ${i + 1}`, type: "url", content: parts[0] });
    }
  }
  return rows;
}

export async function bulkRenderZip(
  rows: BulkRow[],
  design: QrDesign,
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fields = { ...DEFAULT_FIELDS, url: row.content, mediaUrl: row.content, text: row.content, custom: row.content };
    try {
      const result = await renderQr({ type: row.type, fields, design, label: row.label });
      if (result.dataUrl) {
        const base64 = result.dataUrl.split(",")[1];
        const safe = row.label.replace(/[^a-z0-9_-]/gi, "_") || `qr_${i + 1}`;
        zip.file(`${safe}.png`, base64, { base64: true });
      }
    } catch (e) {
      row.error = e instanceof Error ? e.message : "failed";
    }
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Scan test — BarcodeDetector API
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ScanTestResult {
  supported: boolean;
  match: boolean;
  rawValue?: string;
  error?: string;
}

export async function testScanFromCanvas(canvas: HTMLCanvasElement, expected: string): Promise<ScanTestResult> {
  const BD = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (!BD) return { supported: false, match: false, error: "BarcodeDetector not supported in this browser" };
  try {
    const detector = new BD({ formats: ["qr_code"] });
    const results = await detector.detect(canvas);
    if (!results.length) return { supported: true, match: false, error: "No QR detected — try a clearer preview or scan with your phone" };
    const raw = results[0].rawValue;
    return { supported: true, match: raw === expected, rawValue: raw };
  } catch (e) {
    return { supported: true, match: false, error: e instanceof Error ? e.message : "scan failed" };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * AI recommendations
 * ──────────────────────────────────────────────────────────────────────────── */

export interface AiRec {
  level: "info" | "warning";
  title: string;
  detail: string;
  action?: Partial<QrDesign>;
}

export function aiRecommend(payload: QrPayload, info: QrInfo): AiRec[] {
  const recs: AiRec[] = [];
  const d = payload.design;

  if (!buildEncodedPayload(payload.type, payload.fields)) {
    recs.push({ level: "warning", title: "Empty payload", detail: "Fill in the required fields before exporting." });
    return recs;
  }

  if (info.dataLength / info.capacity > 0.8) {
    recs.push({ level: "warning", title: "Near capacity", detail: "QR is almost full — shorten content or use a URL shortener.", action: { errorCorrection: "L" } });
  }

  if (d.logoDataUrl && d.errorCorrection !== "H" && d.errorCorrection !== "Q") {
    recs.push({ level: "warning", title: "Raise error correction for logo", detail: "Logos cover modules — use Q or H so scanners still read reliably.", action: { errorCorrection: "H" } });
  }

  if (d.logoSize > 30) {
    recs.push({ level: "warning", title: "Logo too large", detail: "Keep logo under 25% of QR area for reliable scanning.", action: { logoSize: 22 } });
  }

  if (d.size < 256) {
    recs.push({ level: "info", title: "Increase export size", detail: "512px+ is ideal for print and large displays.", action: { size: 512 } });
  }

  if (d.moduleStyle === "square" && d.foreground === "#000000") {
    recs.push({ level: "info", title: "Try rounded modules", detail: "Rounded dots look modern and scan just as reliably.", action: { moduleStyle: "rounded" } });
  }

  if (d.gradientMode === "none" && !d.logoDataUrl) {
    recs.push({ level: "info", title: "Brand it", detail: "Add a gradient or logo to match your brand — keep error correction at H when using a logo." });
  }

  if (payload.type === "wifi" && !payload.fields.wifi.password && payload.fields.wifi.encryption !== "nopass") {
    recs.push({ level: "warning", title: "Open Wi-Fi", detail: "No password set — guests can connect without authentication." });
  }

  if (recs.length === 0) {
    recs.push({ level: "info", title: "Looking good", detail: `Version ${info.version} · ${info.dataLength} bytes · ${info.estimatedScannability} scannability.` });
  }
  return recs;
}

export const DESIGN_PRESETS: { name: string; design: Partial<QrDesign> }[] = [
  { name: "Classic", design: { foreground: "#000000", background: "#ffffff", moduleStyle: "square", eyeStyle: "square", gradientMode: "none", frame: "none" } },
  { name: "Modern Indigo", design: { foreground: "#4f46e5", background: "#ffffff", moduleStyle: "rounded", eyeStyle: "rounded", gradientMode: "linear", gradientColor2: "#818cf8", frame: "none" } },
  { name: "Dark Mode", design: { foreground: "#ffffff", background: "#0d0d1a", moduleStyle: "rounded", eyeStyle: "rounded", gradientMode: "none", frame: "border", frameColor: "#6366f1" } },
  { name: "Scan Me Banner", design: { foreground: "#0d0d1a", background: "#ffffff", moduleStyle: "dots", eyeStyle: "circle", frame: "banner", frameColor: "#6366f1", frameText: "SCAN ME" } },
  { name: "Forest", design: { foreground: "#166534", background: "#f0fdf4", moduleStyle: "rounded", gradientMode: "linear", gradientColor2: "#22c55e", eyeStyle: "rounded" } },
  { name: "Sunset", design: { foreground: "#ea580c", background: "#fff7ed", moduleStyle: "dots", gradientMode: "linear", gradientColor2: "#f97316", eyeStyle: "circle" } },
];
