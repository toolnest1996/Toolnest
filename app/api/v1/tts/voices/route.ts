import { NextResponse } from "next/server";
import { getEdgeVoices } from "@/lib/tts/edge-synth";
import {
  buildLocaleOptions,
  FALLBACK_EDGE_VOICES,
  mapRawEdgeVoices,
  sortVoicesForPicker,
} from "@/lib/tts/voice-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadVoices() {
  try {
    const raw = await getEdgeVoices();
    const mapped = mapRawEdgeVoices(raw);
    if (mapped.length > 0) return { voices: sortVoicesForPicker(mapped), source: "live" as const };
  } catch (e) {
    console.error("[tts/voices] live fetch failed:", e);
  }
  return { voices: FALLBACK_EDGE_VOICES, source: "fallback" as const };
}

export async function GET() {
  try {
    const { voices, source } = await loadVoices();
    const locales = buildLocaleOptions(voices);

    return NextResponse.json({
      ok: true,
      source,
      count: voices.length,
      localeCount: locales.length,
      languageCount: new Set(voices.map((v) => v.locale.split("-")[0])).size,
      locales,
      voices,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: true,
        source: "fallback",
        count: FALLBACK_EDGE_VOICES.length,
        localeCount: buildLocaleOptions(FALLBACK_EDGE_VOICES).length,
        languageCount: new Set(FALLBACK_EDGE_VOICES.map((v) => v.locale.split("-")[0])).size,
        locales: buildLocaleOptions(FALLBACK_EDGE_VOICES),
        voices: FALLBACK_EDGE_VOICES,
        warning: e instanceof Error ? e.message : "Using cached voice list",
      },
    );
  }
}
