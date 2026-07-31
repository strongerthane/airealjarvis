import { streamText, convertToModelMessages, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openclaw = createOpenAI({
  baseURL: process.env.OPENCLAW_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "http://127.0.0.1:3000/v1",
  apiKey: process.env.OPENCLAW_API_KEY ?? process.env.OPENAI_API_KEY ?? "dummy-key",
});

const model =
  process.env.OPENCLAW_MODEL ??
  process.env.OPENAI_MODEL ??
  "openclaw";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const messages = (body.messages ?? []) as CoreMessage[];

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "No messages provided" }, { status: 400 });
    }

    const result = streamText({
      model: openclaw(model),
      messages: convertToModelMessages(messages),
      temperature: 0.7,
      maxTokens: 1024,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Chat request failed", details: message },
      { status: 500 },
    );
  }
}