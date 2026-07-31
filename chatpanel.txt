import { useEffect, useRef } from "react";
import { MessageBubble, type ChatRole } from "./MessageBubble";

export type DisplayMessage = {
  id: string;
  role: ChatRole;
  text: string;
  source?: "n8n";
};

export function ChatPanel({ messages, thinking }: { messages: DisplayMessage[]; thinking: boolean }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, thinking]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-teal-300/80">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
          Conversation log
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {messages.length} entries
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
            At your service, Boss. Speak or type a directive.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} source={m.source} />
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}