import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Camera, CameraOff, MapPin, Settings } from "lucide-react";
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
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
}

function getClientDateTime(): { dateStr: string; timeStr: string } {
  const now = new Date();
  return {
    dateStr: now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    timeStr: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

type InboxEntry = { id: string; text: string };

export function JarvisApp() {
  const [voiceId, setVoiceIdState] = useState<string>(DEFAULT_VOICE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interim, setInterim] = useState("");
  const [n8nMessages, setN8nMessages] = useState<InboxEntry[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Camera state
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Location state
  const locationRef = useRef<{ lat: number; lon: number; city?: string } | null>(null);

  const setVoiceId = useCallback((v: string) => {
    setVoiceIdState(v);
    localStorage.setItem(VOICE_KEY, v);
  }, []);

  const { speak, stop: stopSpeaking, speaking, amplitude } = useTTS();

  // Request location once on mount
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

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  // Camera toggle
  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      setCameraError(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
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
  }, [cameraOn]);

  // Capture frame as base64
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraOn) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, [cameraOn]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesBody: (options) => {
          const { dateStr, timeStr } = getClientDateTime();
          const loc = locationRef.current;
          const locationStr = loc
            ? `${loc.city ? loc.city + ", " : ""}lat ${loc.lat.toFixed(3)}, lon ${loc.lon.toFixed(3)}`
            : null;
          return { ...options, clientDate: dateStr, clientTime: timeStr, clientLocation: locationStr };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ id: "jarvis-main", transport });

  const spokenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stored = loadStored();
    if (stored.length) {
      setMessages(stored);
      for (const m of stored) if (m.role === "assistant") spokenIdsRef.current.add(m.id);
    }
    const v = localStorage.getItem(VOICE_KEY);
    if (v) setVoiceIdState(v);
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages, bootstrapped]);

  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenIdsRef.current.has(last.id)) return;
    const text = messageToText(last);
    if (!text) return;
    spokenIdsRef.current.add(last.id);
    void speak(text, voiceId);
    // Push browser notification for JARVIS replies
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("J.A.R.V.I.S", { body: text.slice(0, 100), icon: "/favicon.ico" });
    }
  }, [messages, status, speak, voiceId]);

  const handleFinal = useCallback(
    (text: string) => {
      setInterim("");
      // If camera on, capture and send frame + text together
      if (cameraOn) {
        const frame = captureFrame();
        if (frame) {
          void sendMessage({
            text,
            experimental_attachments: [{ name: "camera.jpg", contentType: "image/jpeg", url: `data:image/jpeg;base64,${frame}` }],
          });
          return;
        }
      }
      void sendMessage({ text });
    },
    [sendMessage, cameraOn, captureFrame],
  );

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

  const display: DisplayMessage[] = useMemo(() => {
    const fromChat = messages.map((m) => ({ id: m.id, role: m.role as DisplayMessage["role"], text: messageToText(m) })).filter((m) => m.text);
    const fromN8n: DisplayMessage[] = n8nMessages.map((m) => ({ id: `n8n-${m.id}`, role: "assistant" as const, text: m.text, source: "n8n" }));
    return [...fromChat, ...fromN8n];
  }, [messages, n8nMessages]);

  const thinking = status === "submitted" || status === "streaming";
  const orbState: OrbState = listening ? "listening" : speaking ? "speaking" : thinking ? "thinking" : "idle";
  const blockSleep = thinking || speaking || listening;
  const { idle, wake } = useIdleTimer(30_000, blockSleep);

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/public/n8n";
    return `${window.location.origin}/api/public/n8n`;
  }, []);

  const onSend = useCallback((text: string) => {
    if (cameraOn) {
      const frame = captureFrame();
      if (frame) {
        void sendMessage({ text, experimental_attachments: [{ name: "camera.jpg", contentType: "image/jpeg", url: `data:image/jpeg;base64,${frame}` }] });
        return;
      }
    }
    void sendMessage({ text });
  }, [sendMessage, cameraOn, captureFrame]);

  const toggleMic = useCallback(() => { if (listening) stop(); else start(); }, [listening, start, stop]);

  const clearHistory = useCallback(() => {
    setMessages([]); setN8nMessages([]); spokenIdsRef.current = new Set();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [setMessages]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080a] text-zinc-100">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,184,166,0.08), transparent 60%), radial-gradient(ellipse at 50% 90%, rgba(20,184,166,0.04), transparent 70%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)" }} />

      {/* Camera preview */}
      {cameraOn && (
        <div className="absolute top-16 left-4 z-30 rounded-lg overflow-hidden border border-teal-500/30 shadow-lg" style={{ width: 180, height: 135 }}>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute top-1 right-1 bg-red-500 rounded-full w-2 h-2 animate-pulse" />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.9)]" />
          <div className="font-display text-sm uppercase tracking-[0.5em] text-teal-200">J.A.R.V.I.S</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Location indicator */}
          {locationRef.current && (
            <div title="Location acquired" className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              <MapPin className="h-3 w-3 text-teal-400" />
              <span className="text-[10px] text-zinc-400">{locationRef.current.city ?? "Located"}</span>
            </div>
          )}
          {/* Camera toggle */}
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

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-6 pt-4">
        <div className="mx-auto max-w-3xl">
          <InputBar onSend={onSend} listening={listening} micSupported={supported} speaking={speaking} onToggleMic={toggleMic} onStopSpeaking={stopSpeaking} interim={interim} />
          {!supported && <p className="mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-600">Voice input not supported in this browser.</p>}
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} voiceId={voiceId} setVoiceId={setVoiceId} webhookUrl={webhookUrl} onClearHistory={clearHistory} />
      <SleepScreen asleep={idle} onWake={wake} />
    </div>
  );
}
