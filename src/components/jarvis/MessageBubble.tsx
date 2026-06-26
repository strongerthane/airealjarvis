import { motion } from "motion/react";

export type ChatRole = "user" | "assistant" | "system";

export function MessageBubble({
  role,
  text,
  source,
}: {
  role: ChatRole;
  text: string;
  source?: "n8n";
}) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed ${
          isUser
            ? "bg-teal-500/10 border border-teal-400/30 text-teal-50"
            : "bg-white/[0.03] border border-white/10 text-zinc-100 shadow-[0_0_30px_rgba(20,184,166,0.06)]"
        }`}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-teal-300/80">
            <span>Jarvis</span>
            {source === "n8n" && (
              <span className="rounded-sm bg-teal-500/15 px-1.5 py-0.5 text-teal-200">n8n</span>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </motion.div>
  );
}