import { Copy, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsDialog({
  open,
  onClose,
  voiceId,
  setVoiceId,
  webhookUrl,
  onClearHistory,
}: {
  open: boolean;
  onClose: () => void;
  voiceId: string;
  setVoiceId: (v: string) => void;
  webhookUrl: string;
  onClearHistory: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [local, setLocal] = useState(voiceId);

  useEffect(() => setLocal(voiceId), [voiceId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f10] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide text-teal-200">Jarvis Settings</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 text-sm">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              ElevenLabs Voice ID
            </label>
            <div className="flex gap-2">
              <input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-zinc-100 focus:border-teal-400/50 focus:outline-none"
                placeholder="JBFqnCBsd6RMkjVDRZzb"
              />
              <button
                onClick={() => {
                  setVoiceId(local.trim() || "JBFqnCBsd6RMkjVDRZzb");
                  onClose();
                }}
                className="rounded-md bg-teal-500 px-3 py-2 text-xs uppercase tracking-wider text-black hover:bg-teal-400"
              >
                Save
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Find voice IDs in the ElevenLabs voice library. Default is "George".
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              n8n Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={webhookUrl}
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              POST <code className="text-teal-300">{`{ "message": "..." }`}</code> with header{" "}
              <code className="text-teal-300">x-jarvis-webhook-secret</code> (the value you generated server-side).
              Jarvis will read it aloud and add it to the chat.
            </p>
          </div>

          <div>
            <button
              onClick={() => {
                onClearHistory();
                onClose();
              }}
              className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-wider text-red-200 hover:bg-red-500/20"
            >
              Clear conversation history
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}