import { createFileRoute } from "@tanstack/react-router";
import { BreezeBlueClient } from "@breeze.blue/sdk";

let elevenLabsEnabled = true;

const BREEZE_DEFAULT_VOICE = "voc_b8nkww4gzszh";

function getBreezeClient() {
  return new BreezeBlueClient({
    apiKey: process.env.BREEZE_API_KEY,
  });
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, voiceId } = (await request.json()) as {
          text?: string;
          voiceId?: string;
        };
        if (!text || typeof text !== "string") {
          return new Response("text required", { status: 400 });
        }
        const requestedVoice = voiceId?.trim();
        const breezeVoice = requestedVoice?.startsWith("voc_") ? requestedVoice : BREEZE_DEFAULT_VOICE;

        console.log("🗣️ TTS request:", { text: text.slice(0, 80), requestedVoice, breezeVoice, hasBreezeKey: !!process.env.BREEZE_API_KEY, hasElevenKey: !!process.env.ELEVENLABS_API_KEY, elevenLabsEnabled });

        // ---- Try ElevenLabs (if enabled) ----
        if (elevenLabsEnabled && process.env.ELEVENLABS_API_KEY && requestedVoice) {
          const upstream = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${requestedVoice}/stream?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": process.env.ELEVENLABS_API_KEY!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: text.slice(0, 4500),
                model_id: "eleven_turbo_v2_5",
                voice_settings: {
                  stability: 0.55,
                  similarity_boost: 0.75,
                  style: 0.35,
                  use_speaker_boost: true,
                  speed: 1.02,
                },
              }),
            },
          );

          if (upstream.ok && upstream.body) {
            const audioBlob = await upstream.blob();
            console.log("🔊 TTS handled by ElevenLabs");
            return new Response(audioBlob, {
              headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-store",
              },
            });
          }

          // quota exceeded -> disable ElevenLabs for this session
          if (upstream.status === 401) {
            const errBody = await upstream.text();
            if (/quota_exceeded/i.test(errBody)) {
              elevenLabsEnabled = false;
              console.log("⛔ ElevenLabs disabled (quota_exceeded) – falling back to BreezeBlue");
            }
          }
        }

        // ---- BreezeBlue via SDK ----
        if (process.env.BREEZE_API_KEY) {
          const breeze = getBreezeClient();
          try {
            const audio = await breeze.textToSpeech.convert(
              breezeVoice,
              { text: text.slice(0, 4500) },
              { outputFormat: "mp3" },
            );
            console.log("🔊 TTS handled by BreezeBlue (content-type:", audio.contentType, ")");
            const audioBuffer = await audio.arrayBuffer();
            return new Response(audioBuffer, {
              headers: {
                "Content-Type": audio.contentType || "audio/mpeg",
                "Cache-Control": "no-store",
              },
            });
          } catch (err: any) {
            const status = err?.status ?? "unknown";
            const code = err?.code ?? "unknown";
            const detail = err?.detail ?? err?.message ?? String(err);
            console.error("❌ BreezeBlue SDK error:", JSON.stringify({ status, code, detail, breezeVoice, textLen: text.length }));
            return new Response(
              JSON.stringify({ error: "BreezeBlue TTS failed", status, code, detail }),
              { status: 502, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        // No provider configured
        return new Response("No TTS provider configured", { status: 500 });
      },
    },
  },
});
