import { createFileRoute } from "@tanstack/react-router";

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
        const voice = voiceId?.trim() || "JBFqnCBsd6RMkjVDRZzb";
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return new Response("ElevenLabs not connected", { status: 500 });

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
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

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text().catch(() => "");
          return new Response(`TTS failed: ${upstream.status} ${errText}`, {
            status: upstream.status || 500,
          });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});