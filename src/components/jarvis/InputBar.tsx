import { Mic, MicOff, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function InputBar({
  onSend,
  listening,
  micSupported,
  speaking,
  onToggleMic,
  onStopSpeaking,
  interim,
}: {
  onSend: (text: string) => void;
  listening: boolean;
  micSupported: boolean;
  speaking: boolean;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  interim: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  const placeholder = listening
    ? interim || "Listening, Boss..."
    : "Speak to Jarvis...";

  return (
    <div className="flex items-end gap-2 rounded-full border border-white/10 bg-black/60 px-2 py-2 shadow-[0_0_40px_rgba(20,184,166,0.15)] backdrop-blur-xl">
      <button
        type="button"
        onClick={onToggleMic}
        disabled={!micSupported}
        title={micSupported ? "Toggle microphone" : "Speech recognition not supported"}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          listening
            ? "bg-teal-500 text-black shadow-[0_0_20px_rgba(20,184,166,0.7)]"
            : "bg-white/5 text-teal-200 hover:bg-white/10"
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {listening ? <Mic className="h-4 w-4" /> : micSupported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </button>

      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
      />

      {speaking ? (
        <button
          type="button"
          onClick={onStopSpeaking}
          title="Stop speaking"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-teal-200 hover:bg-white/10"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          title="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-black transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}