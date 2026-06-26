import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { publishInbox } from "@/lib/n8n-inbox.server";

const PayloadSchema = z.object({
  message: z.string().min(1).max(4000),
});

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-jarvis-webhook-secret",
};

export const Route = createFileRoute("/api/public/n8n")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const secret = process.env.JARVIS_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
        }
        const provided = request.headers.get("x-jarvis-webhook-secret") ?? "";
        if (!timingSafeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
        }
        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return new Response("Invalid payload: requires { message: string }", {
            status: 400,
            headers: corsHeaders,
          });
        }

        const msg = publishInbox(parsed.data.message);
        return Response.json({ ok: true, id: msg.id }, { headers: corsHeaders });
      },
    },
  },
});