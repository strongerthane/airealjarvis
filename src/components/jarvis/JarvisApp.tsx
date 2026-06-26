import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTTS } from "@/hooks/useTTS";

import { ChatPanel, type DisplayMessage } from "./ChatPanel";
import { InputBar } from "./InputBar";
import { Orb, type OrbState } from "./Orb";
import { SettingsDialog } from "./SettingsDialog";
import { SleepScreen } from "./SleepScreen";

const STORAGE_KEY = "jarvis:messages:v1";
const VOICE_KEY = "jarvis:voiceId";
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

function loadStored(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function messageToText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

type InboxEntry = { id: string; text: string };

export function JarvisApp() {
  const [voiceId, setVoiceIdState] = useState<string>(DEFAULT_VOICE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interim, setInterim] = useState("");
  const [n8nMessages, setN8nMessages] = useState<InboxEntry[]>([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Bootstrap from localStorage (client-only) once.
  useEffect(() => {
    setInitialMessages(loadStored());
    const v = localStorage.getItem(VOICE_KEY);
    if (v) setVoiceIdState(v);
    setBootstrapped(true);
  }, []);

  const setVoiceId = useCallback((v: string) => {
    setVoiceIdState(v);
    localStorage.setItem(VOICE_KEY, v);
  }, []);

  const { speak, stop: stopSpeaking, speaking, amplitude } = useTTS();

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "jarvis-main",
    messages: initialMessages,
    transport,
  });

  // Persist messages whenever they change.
  useEffect(() => {
    if (!bootstrapped) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, bootstrapped]);

  // Speak each assistant reply once it finishes streaming.
  const spokenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenIdsRef.current.has(last.id)) return;
    const text = messageToText(last);
    if (!text) return;
    spokenIdsRef.current.add(last.id);
    void speak(text, voiceId);
  }, [messages, status, speak, voiceId]);

  // Speech recognition
  const handleFinal = useCallback(
    (text: string) => {
      setInterim("");
      void sendMessage({ text });
    },
    [sendMessage],
  );
  const { listening, supported, start, stop } = useSpeechRecognition({
    onFinal: handleFinal,
    onInterim: setInterim,
  });

  // Subscribe to n8n SSE stream
  useEffect(() => {
    const es = new EventSource("/api/public/n8n/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { id: string; text: string };
        if (!data?.id || !data?.text) return;
        setN8nMessages((cur) => [...cur, { id: data.id, text: data.text }]);
        // Also wake screen + speak
        void speak(data.text, voiceId);
      } catch {}
    };
    es.onerror = () => {
      // Browser will auto-reconnect; nothing to do.
    };
    return () => es.close();
  }, [speak, voiceId]);

  // Build unified display list (chat + n8n entries by arrival order; n8n inserted at end)
  const display: DisplayMessage[] = useMemo(() => {
    const fromChat = messages
      .map((m) => ({
        id: m.id,
        role: m.role as DisplayMessage["role"],
        text: messageToText(m),
      }))
      .filter((m) => m.text);
    const fromN8n: DisplayMessage[] = n8nMessages.map((m) => ({
      id: `n8n-${m.id}`,
      role: "assistant",
      text: m.text,
      source: "n8n",
    }));
    return [...fromChat, ...fromN8n];
  }, [messages, n8nMessages]);

  // Orb state machine
  const thinking = status === "submitted" || status === "streaming";
  const orbState: OrbState = listening
    ? "listening"
    : speaking
      ? "speaking"
      : thinking
        ? "thinking"
        : "idle";

  // Idle / sleep
  const blockSleep = thinking || speaking || listening;
  const { idle, wake } = useIdleTimer(30_000, blockSleep);

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/public/n8n";
    return `${window.location.origin}/api/public/n8n`;
  }, []);

  const onSend = useCallback(
    (text: string) => {
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const toggleMic = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setN8nMessages([]);
    spokenIdsRef.current = new Set();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [setMessages]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080a] text-zinc-100">
      {/* ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(20,184,166,0.08), transparent 60%), radial-gradient(ellipse at 50% 90%, rgba(20,184,166,0.04), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.9)]" />
          <div className="font-display text-sm uppercase tracking-[0.5em] text-teal-200">
            J.A.R.V.I.S
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      {/* Main layout */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 pb-32 lg:grid-cols-[1fr_400px] lg:gap-8 lg:px-8">
        <section className="flex min-h-[55vh] flex-col items-center justify-center py-8 lg:min-h-[calc(100vh-12rem)]">
          <Orb state={orbState} amplitude={amplitude} />
          <div className="mt-10 text-center text-xs uppercase tracking-[0.4em] text-zinc-500">
            {orbState === "idle" && "Standing by"}
            {orbState === "listening" && "Listening..."}
            {orbState === "thinking" && "Processing"}
            {orbState === "speaking" && "Responding"}
          </div>
        </section>

        <aside className="h-[55vh] lg:h-[calc(100vh-12rem)]">
          <ChatPanel messages={display} thinking={thinking} />
        </aside>
      </main>

      {/* Input bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-6 pt-4">
        <div className="mx-auto max-w-3xl">
          <InputBar
            onSend={onSend}
            listening={listening}
            micSupported={supported}
            speaking={speaking}
            onToggleMic={toggleMic}
            onStopSpeaking={stopSpeaking}
            interim={interim}
          />
          {!supported && (
            <p className="mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-600">
              Voice input not supported in this browser. Use Chrome, Edge, or Safari.
            </p>
          )}
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        webhookUrl={webhookUrl}
        onClearHistory={clearHistory}
      />

      <SleepScreen asleep={idle} onWake={wake} />
    </div>
  );
}