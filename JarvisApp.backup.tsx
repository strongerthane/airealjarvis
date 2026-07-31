import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Camera, CameraOff, Mail, MapPin, Plus, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTTS } from "@/hooks/useTTS";

import { ChatPanel, type DisplayMessage } from "./ChatPanel";
import { EmailDraftModal } from "./EmailDraftModal";
import { InputBar } from "./InputBar";
import { Orb, type OrbState } from "./Orb";
import { SettingsDialog } from "./SettingsDialog";
import { SleepScreen } from "./SleepScreen";

const SESSIONS_KEY = "jarvis:sessions:v1";
const messagesKey = (id: string) => `jarvis:messages:v1:${id}`;
const VOICE_KEY = "jarvis:voiceId";
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

type ChatSessionMeta = { id: string; title: string; createdAt: number };

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSessions(): ChatSessionMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSessionMeta[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSessionMeta[]) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch {}
}

function loadStoredFor(id: string): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(messagesKey(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as UIMessage[]).filter(
      (m) => m && m.id && m.role && Array.isArray(m.parts) && m.parts.length > 0
    );
  } catch {
    return [];
  }
}

function messageToText(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
}

function extractEmailDraft(text: string): { subject: string; body: string } | null {
  const subjectMatch = text.match(/subject[:\s]+(.+)/i);
  const hasEmailKeywords = /dear |hi |hello |regards|sincerely|best regards|to whom/i.test(text);
  if (!subjectMatch && !hasEmailKeywords) return null;
  const subject = subjectMatch?.[1]?.trim() || "Email Draft";
  const body = text;
  return { subject, body };
}

type InboxEntry = { id: string; text: string };

type ChatWindowProps = {
  chatId: string;
  voiceId: string;
  cameraOn: boolean;
  recording: boolean;
  toggleCamera: () => Promise<void>;
  toggleRecording: () => void;
  n8nMessages: InboxEntry[];
  locationRef: React.MutableRefObject<{ lat: number; lon: number; city?: string } | null>;
  speak: (text: string, voiceId: string) => void | Promise<void>;
  onFirstUserMessage: (chatId: string, text: string) => void;
  onEmailDraft: (draft: { subject: string; body: string }) => void;
  onStatusChange: (thinking: boolean) => void;
  onDisplayChange: (display: DisplayMessage[]) => void;
  registerActions: (actions: { sendMessage: (text: string) => void; clear: () => void }) => void;
};

function ChatWindow({
  chatId,
  voiceId,
  cameraOn,
  recording,
  toggleCamera,
  toggleRecording,
  n8nMessages,
  locationRef,
  speak,
  onFirstUserMessage,
  onEmailDraft,
  onStatusChange,
  onDisplayChange,
  registerActions,
}: ChatWindowProps) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const handledToolCallsRef = useRef<Set<string>>(new Set());
  const titledRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ body, messages }) => {
          const now = new Date();
          const clientDate = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          const clientTime = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const loc = locationRef.current;
          const clientLocation = loc
            ? loc.city
              ? `${loc.city} (${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)})`
              : `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`
            : null;
          return { body: { ...body, messages, chatId, clientDate, clientTime, clientLocation } };
        },
      }),
    [locationRef],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ id: chatId, transport });

  useEffect(() => {
    const stored = loadStoredFor(chatId);
    if (stored.length) {
      setMessages(stored);
      for (const m of stored) if (m.role === "assistant") spokenIdsRef.current.add(m.id);
      titledRef.current = true;
    }
    setBootstrapped(true);
  }, [chatId, setMessages]);

  useEffect(() => {
    if (!bootstrapped) return;
    try { localStorage.setItem(messagesKey(chatId), JSON.stringify(messages)); } catch {}
  }, [messages, bootstrapped, chatId]);

  useEffect(() => {
    if (titledRef.current) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      titledRef.current = true;
      onFirstUserMessage(chatId, messageToText(firstUser));
    }
  }, [messages, chatId, onFirstUserMessage]);

  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenIdsRef.current.has(last.id)) return;
    const text = messageToText(last);
    if (!text) return;
    spokenIdsRef.current.add(last.id);
    void speak(text, voiceId);
    const draft = extractEmailDraft(text);
    if (draft) onEmailDraft(draft);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("J.A.R.V.I.S", { body: text.slice(0, 100), icon: "/favicon.ico" });
    }
  }, [messages, status, speak, voiceId, onEmailDraft]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    for (const part of last.parts) {
      if (part.type === "tool-startCameraRecording" && "toolCallId" in part) {
        const callId = part.toolCallId as string;
        if (handledToolCallsRef.current.has(callId)) continue;
        handledToolCallsRef.current.add(callId);
        void (async () => {
          if (!cameraOn) await toggleCamera();
          setTimeout(() => toggleRecording(), 500);
        })();
      }
      if (part.type === "tool-stopCameraRecording" && "toolCallId" in part) {
        const callId = part.toolCallId as string;
        if (handledToolCallsRef.current.has(callId)) continue;
        handledToolCallsRef.current.add(callId);
        if (recording) toggleRecording();
      }
    }
  }, [messages, cameraOn, recording, toggleCamera, toggleRecording]);

  useEffect(() => {
    onStatusChange(status === "submitted" || status === "streaming");
  }, [status, onStatusChange]);

  useEffect(() => {
    const fromChat = messages.map((m) => ({ id: m.id, role: m.role as DisplayMessage["role"], text: messageToText(m) })).filter((m) => m.text);
    const fromN8n: DisplayMessage[] = n8nMessages.map((m) => ({ id: `n8n-${m.id}`, role: "assistant" as const, text: m.text, source: "n8n" }));
    onDisplayChange([...fromChat, ...fromN8n]);
  }, [messages, n8nMessages, onDisplayChange]);

  useEffect(() => {
    registerActions({
      sendMessage: (text: string) => void sendMessage({ text }),
      clear: () => {
        setMessages([]);
        spokenIdsRef.current = new Set();
        try { localStorage.removeItem(messagesKey(chatId)); } catch {}
      },
    });
  }, [sendMessage, setMessages, registerActions, chatId]);

  return null;
}

export function JarvisApp() {
  const [voiceId, setVoiceIdState] = useState<string>(DEFAULT_VOICE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interim, setInterim] = useState("");
  const [n8nMessages, setN8nMessages] = useState<InboxEntry[]>([]);

  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  const [display, setDisplay] = useState<DisplayMessage[]>([]);
  const [thinking, setThinking] = useState(false);

  const locationRef = useRef<{ lat: number; lon: number; city?: string } | null>(null);
  const actionsRef = useRef<{ sendMessage: (text: string) => void; clear: () => void }>({
    sendMessage: () => {},
    clear: () => {},
  });

  const setVoiceId = useCallback((v: string) => {
    setVoiceIdState(v);
    localStorage.setItem(VOICE_KEY, v);
  }, []);

  const { speak, stop: stopSpeaking, speaking, amplitude } = useTTS();

  useEffect(() => {
    const existing = loadSessions();
    if (existing.length) {
      setSessions(existing);
      setCurrentChatId(existing[0].id);
    } else {
      const id = genId();
      const fresh = [{ id, title: "New chat", createdAt: Date.now() }];
      setSessions(fresh);
      saveSessions(fresh);
      setCurrentChatId(id);
    }
    const v = localStorage.getItem(VOICE_KEY);
    if (v) setVoiceIdState(v);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let city: string | undefined;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const data = await res.json() as { address?: { city?: string; town?: string; village?: string } };
          city = data.address?.city ?? data.address?.town ?? data.address?.village;
        } catch {}
        locationRef.current = { lat, lon, city };
      },
      () => {},
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      if (recording && recorderRef.current) {
        recorderRef.current.stop();
        setRecording(false);
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      setCameraError(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
        streamRef.current = stream;
        setCameraOn(true);
        setCameraError(null);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 100);
      } catch {
        setCameraError("Camera access denied.");
      }
    }
  }, [cameraOn, recording]);

  const toggleRecording = useCallback(() => {
    if (!streamRef.current) return;
    if (recording) {
      recorderRef.current?.stop();
    } else {
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `jarvis-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecording(false);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    }
  }, [recording]);

  const handleFinal = useCallback((text: string) => {
    setInterim("");
    actionsRef.current.sendMessage(text);
  }, []);

  const { listening, supported, start, stop } = useSpeechRecognition({ onFinal: handleFinal, onInterim: setInterim });

  useEffect(() => {
    const es = new EventSource("/api/public/n8n/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { id: string; text: string };
        if (!data?.id || !data?.text) return;
        setN8nMessages((cur) => [...cur, { id: data.id, text: data.text }]);
        void speak(data.text, voiceId);
      } catch {}
    };
    return () => es.close();
  }, [speak, voiceId]);

  const orbState: OrbState = listening ? "listening" : speaking ? "speaking" : thinking ? "thinking" : "idle";
  const blockSleep = thinking || speaking || listening;
  const { idle, wake } = useIdleTimer(30_000, blockSleep);

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/public/n8n";
    return `${window.location.origin}/api/public/n8n`;
  }, []);

  const onSend = useCallback((text: string) => {
    actionsRef.current.sendMessage(text);
  }, []);

  const toggleMic = useCallback(() => { if (listening) stop(); else start(); }, [listening, start, stop]);

  const clearHistory = useCallback(() => {
    actionsRef.current.clear();
    setN8nMessages([]);
  }, []);

  const newChat = useCallback(() => {
    const id = genId();
    const meta = { id, title: "New chat", createdAt: Date.now() };
    setSessions((cur) => {
      const next = [meta, ...cur];
      saveSessions(next);
      return next;
    });
    setCurrentChatId(id);
    setDisplay([]);
  }, []);

  const switchChat = useCallback((id: string) => {
    setCurrentChatId(id);
  }, []);

  const deleteChat = useCallback((id: string) => {
    try { localStorage.removeItem(messagesKey(id)); } catch {}
    setSessions((cur) => {
      const next = cur.filter((s) => s.id !== id);
      const finalList = next.length ? next : [{ id: genId(), title: "New chat", createdAt: Date.now() }];
      saveSessions(finalList);
      if (id === currentChatId) {
        setCurrentChatId(finalList[0].id);
      }
      return finalList;
    });
  }, [currentChatId]);

  const onFirstUserMessage = useCallback((chatId: string, text: string) => {
    setSessions((cur) => {
      const next = cur.map((s) => (s.id === chatId ? { ...s, title: text.slice(0, 40) || "New chat" } : s));
      saveSessions(next);
      return next;
    });
  }, []);

  const registerActions = useCallback((actions: { sendMessage: (text: string) => void; clear: () => void }) => {
    actionsRef.current = actions;
  }, []);

  if (!currentChatId) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080a] text-zinc-100">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,184,166,0.08), transparent 60%), radial-gradient(ellipse at 50% 90%, rgba(20,184,166,0.04), transparent 70%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)" }} />

      <ChatWindow
        key={currentChatId}
        chatId={currentChatId}
        voiceId={voiceId}
        cameraOn={cameraOn}
        recording={recording}
        toggleCamera={toggleCamera}
        toggleRecording={toggleRecording}
        n8nMessages={n8nMessages}
        locationRef={locationRef}
        speak={speak}
        onFirstUserMessage={onFirstUserMessage}
        onEmailDraft={setEmailDraft}
        onStatusChange={setThinking}
        onDisplayChange={setDisplay}
        registerActions={registerActions}
      />

      <aside className="fixed left-0 top-0 z-20 hidden h-full w-56 flex-col border-r border-white/10 bg-black/40 backdrop-blur-md lg:flex">
        <div className="p-3">
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-teal-300 hover:bg-teal-500/20 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => switchChat(s.id)}
              className={`group mb-1 flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-xs transition ${
                s.id === currentChatId ? "bg-white/10 text-teal-200" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              <span className="truncate">{s.title || "New chat"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {cameraOn && (
        <div className="absolute top-16 left-4 lg:left-60 z-30 rounded-lg overflow-hidden border border-teal-500/30 shadow-lg" style={{ width: 180, height: 135 }}>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {recording && <div className="absolute top-1 right-1 bg-red-500 rounded-full w-2 h-2 animate-pulse" />}
          <button
            onClick={toggleRecording}
            className={`absolute bottom-1 right-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition ${recording ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/40"}`}
          >
            {recording ? "\u25A0 STOP" : "\u25CF REC"}
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 lg:pl-60">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.9)]" />
          <div className="font-display text-sm uppercase tracking-[0.5em] text-teal-200">J.A.R.V.I.S</div>
        </div>
        <div className="flex items-center gap-2">
          {Boolean(locationRef.current) && (
            <div title="Location acquired" className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              <MapPin className="h-3 w-3 text-teal-400" />
              <span className="text-[10px] text-zinc-400">{locationRef.current?.city ?? "Located"}</span>
            </div>
          )}
          <button
            onClick={() => actionsRef.current.sendMessage("Draft an email for me")}
            title="Draft an email"
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/10 transition"
          >
            <Mail className="h-3 w-3" />
            <span>EMAIL</span>
          </button>
          <button
            onClick={toggleCamera}
            title={cameraOn ? "Disable camera" : "Enable camera"}
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition ${cameraOn ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}
          >
            {cameraOn ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
            <span>{cameraOn ? "CAM ON" : "CAM"}</span>
          </button>
          {cameraError && <span className="text-[10px] text-red-400">{cameraError}</span>}
          <button onClick={() => setSettingsOpen(true)} className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 pb-32 lg:grid-cols-[1fr_400px] lg:gap-8 lg:pl-60 lg:pr-8">
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

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-6 pt-4 lg:pl-56">
        <div className="mx-auto max-w-3xl">
          <InputBar onSend={onSend} listening={listening} micSupported={supported} speaking={speaking} onToggleMic={toggleMic} onStopSpeaking={stopSpeaking} interim={interim} />
          {!supported && <p className="mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-600">Voice input not supported in this browser.</p>}
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} voiceId={voiceId} setVoiceId={setVoiceId} webhookUrl={webhookUrl} onClearHistory={clearHistory} />
      <SleepScreen asleep={false} onWake={wake} />

      {emailDraft && (
        <EmailDraftModal
          subject={emailDraft.subject}
          body={emailDraft.body}
          onClose={() => setEmailDraft(null)}
        />
      )}
    </div>
  );
}
