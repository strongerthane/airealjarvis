import { Check, Copy, X } from "lucide-react";
import { useState } from "react";

interface Props {
  subject: string;
  body: string;
  onClose: () => void;
}

export function EmailDraftModal({ subject, body, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [editableBody, setEditableBody] = useState(body);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMailto = () => {
    const encoded = encodeURIComponent(editableBody);
    const sub = encodeURIComponent(subject);
    window.open(`mailto:?subject=${sub}&body=${encoded}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-teal-500/20 bg-[#0d1117] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            <span className="text-xs uppercase tracking-[0.4em] text-teal-300">Email Draft</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subject */}
        <div className="border-b border-white/5 px-5 py-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-1">Subject</p>
          <p className="text-sm text-zinc-200">{subject}</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-2">Body</p>
          <textarea
            value={editableBody}
            onChange={(e) => setEditableBody(e.target.value)}
            rows={10}
            className="w-full resize-none rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-teal-500/50 focus:outline-none transition"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 transition"
          >
            {copied ? <Check className="h-3 w-3 text-teal-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleMailto}
            className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-xs text-white hover:bg-teal-500 transition"
          >
            Open in Mail
          </button>
        </div>
      </div>
    </div>
  );
}
