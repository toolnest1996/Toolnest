import { NextResponse } from "next/server";
import { synthesizeEdgeAudio } from "@/lib/tts/edge-synth";
import type { EmotionPreset, TtsExportFormat } from "@/lib/tts/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body.text as string;
    const voice = (body.voice as string) || "en-US-JennyNeural";
    const lang = (body.lang as string) || "en-US";
    const format = (body.format as TtsExportFormat) || "mp3";
    const ssml = body.ssml as string | undefined;

    if (!text?.trim() && !ssml?.trim()) {
      return NextResponse.json({ ok: false, error: "text or ssml required" }, { status: 400 });
    }
    if ((text?.length ?? 0) > 500_000) {
      return NextResponse.json({ ok: false, error: "text exceeds 500k character limit" }, { status: 413 });
    }

    const { buffer, mime, ext } = await synthesizeEdgeAudio({
      text: text ?? "",
      voice,
      lang,
      format,
      ssml,
      emotion: body.emotion as EmotionPreset | undefined,
      rate: typeof body.rate === "number" ? body.rate : undefined,
      pitch: typeof body.pitch === "number" ? body.pitch : undefined,
      volume: typeof body.volume === "number" ? body.volume : undefined,
    });

    if (buffer.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No audio generated. Voice "${voice}" does not support this text — choose a matching language voice.`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      audio: buffer.toString("base64"),
      mime,
      ext,
      bytes: buffer.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS synthesis failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/tts",
    methods: ["POST"],
    description: "Neural text-to-speech via Microsoft Edge voices (MP3/WebM)",
    body: {
      text: "string",
      voice: "ShortName e.g. en-US-JennyNeural",
      lang: "BCP-47 locale",
      format: "mp3 | webm",
      ssml: "optional raw SSML",
      emotion: "neutral | cheerful | calm | sad | angry | excited | newscast | whisper",
      rate: "number 0.5-2",
      pitch: "number 0.5-2",
      volume: "number 0-2",
    },
  });
}
