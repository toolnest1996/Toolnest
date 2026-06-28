import { MsEdgeTTS, OUTPUT_FORMAT, OUTPUT_EXTENSIONS } from "msedge-tts";
import type { EmotionPreset, TtsExportFormat, TtsOptions } from "@/lib/tts/types";
import { DEFAULT_TTS_OPTIONS } from "@/lib/tts/types";
import { buildSsml } from "@/lib/tts/ssml";

function formatToOutput(format: TtsExportFormat): OUTPUT_FORMAT {
  if (format === "webm") return OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS;
  return OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
}

let voiceCache: { at: number; voices: Awaited<ReturnType<MsEdgeTTS["getVoices"]>> } | null = null;
const CACHE_MS = 1000 * 60 * 60 * 6;

export async function getEdgeVoices() {
  const now = Date.now();
  if (voiceCache && now - voiceCache.at < CACHE_MS) return voiceCache.voices;
  const tts = new MsEdgeTTS();
  const voices = await tts.getVoices();
  voiceCache = { at: now, voices };
  return voices;
}

async function readAudioStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function toTtsOptions(params: {
  voice: string;
  lang: string;
  format: TtsExportFormat;
  emotion?: EmotionPreset;
  rate?: number;
  pitch?: number;
  volume?: number;
}): TtsOptions {
  return {
    ...DEFAULT_TTS_OPTIONS,
    voiceId: params.voice,
    lang: params.lang,
    exportFormat: params.format,
    emotion: params.emotion ?? DEFAULT_TTS_OPTIONS.emotion,
    rate: params.rate ?? DEFAULT_TTS_OPTIONS.rate,
    pitch: params.pitch ?? DEFAULT_TTS_OPTIONS.pitch,
    volume: params.volume ?? DEFAULT_TTS_OPTIONS.volume,
  };
}

export async function synthesizeEdgeAudio(params: {
  text: string;
  voice: string;
  lang: string;
  format: TtsExportFormat;
  ssml?: string;
  emotion?: EmotionPreset;
  rate?: number;
  pitch?: number;
  volume?: number;
}): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  const tts = new MsEdgeTTS();
  const outputFormat = formatToOutput(params.format);
  await tts.setMetadata(params.voice, outputFormat, { voiceLocale: params.lang });

  const ttsOptions = toTtsOptions(params);
  const requestSsml =
    params.ssml?.trim() ?? buildSsml(params.text.slice(0, 500_000), params.voice, ttsOptions);

  const { audioStream } = tts.rawToStream(requestSsml);
  const buffer = await readAudioStream(audioStream);
  tts.close();

  if (buffer.length === 0) {
    throw new Error(
      `No audio generated for voice "${params.voice}". Pick a neural voice that matches your text language (e.g. bn-BD for Bengali, hi-IN for Hindi).`,
    );
  }

  const mime = params.format === "webm" ? "audio/webm" : "audio/mpeg";
  const ext = OUTPUT_EXTENSIONS[outputFormat] ?? (params.format === "webm" ? "webm" : "mp3");
  return { buffer, mime, ext };
}
