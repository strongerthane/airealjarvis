import { createFileRoute } from "@tanstack/react-router";

import { subscribeInbox } from "@/lib/n8n-inbox.server";

export const Route = createFileRoute("/api/public/n8n/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(`: connected\n\n`));

            const unsub = subscribeInbox((msg) => {
              try {
                controller.enqueue(enc.encode(`data: ${JSON.stringify(msg)}\n\n`));
              } catch {}
            });

            const heartbeat = setInterval(() => {
              try {
                controller.enqueue(enc.encode(`: ping\n\n`));
              } catch {}
            }, 25_000);

            const cleanup = () => {
              clearInterval(heartbeat);
              unsub();
              try {
                controller.close();
              } catch {}
            };

            request.signal.addEventListener("abort", cleanup);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});