"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Camera, CameraOff, Mail, MapPin, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTTS } from "@/hooks/useTTS";

import { EmailDraftModal } from "./EmailDraftModal";
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
    if (!Array.isArray(parsed)) return [];
    return (parsed as UIMessage[]).filter(
      (m) => m && m.id && m.role && Array.isArray(m.parts) && m.parts.length > 0,
    );
  } catch {
    return [];
  }
}

function messageToText(m: UIMessage): string {
  if (!Array.isArray(m.parts)) return "";
  return m.parts
    .map((p: any) => {
      if (!p) return "";
      if (p.type === "text" && typeof p.text === "string") return p.text;
      if (typeof p.text === "string") return p.text;
      return "";
    })
    .join("")
    .trim();
}

function extractEmailDraft(text: string): { subject: string; body: string } | null {
  const subjectMatch = text.match(/subject[:\s]+(.+)/i);
  const hasEmailKeywords = /dear |hi |hello |regards|sincerely|best regards|to whom/i.test(text);
  if (!subjectMatch && !hasEmailKeywords) return null;
  const subject = subjectMatch ? subjectMatch[1].trim() : "Email Draft";
  return { subject, body: text };
}

type InboxEntry = { id: string; text: string };

export function JarvisApp() {
  const [voiceId, setVoiceIdState] = useState<string>(DEFAULT_VOICE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interim, setInterim] = useState("");
  const [n8nMessages, setN8nMessages] = useState<InboxEntry[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>({
    subject: "Email Draft",
    body: "Tell me who this email is for and what you want to say.",
  });

  const locationRef = useRef<{ lat: number; lon: number; city?: string } | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const spokenSentenceCountRef = useRef<Record<string, number>>({});
  const speakingQueueRef = useRef<string[]>([]);
  const queueBusyRef = useRef(false);

  const setVoiceId = useCallback((v: string) => {
    setVoiceIdState(v);
    localStorage.setItem(VOICE_KEY, v);
  }, []);

  const openEmailDraft = useCallback((draft?: Partial<{ subject: string; body: string }>) => {
    setEmailDraft({
      subject: draft?.subject?.trim() || "Email Draft",
      body: draft?.body?.trim() || "Tell me who this email is for and what you want to say.",
    });
  }, []);

  const { speak, stop: stopSpeaking, speaking, amplitude } = useTTS();

  const splitCompleteSentences = useCallback((text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const matches = clean.match(/[^.!?]+[.!?]+/g);
    return matches ? matches.map((s) => s.trim()) : [];
  }, []);

  const playQueue = useCallback(async () => {
    if (queueBusyRef.current) return;
    queueBusyRef.current = true;
    try {
      while (speakingQueueRef.current.length > 0) {
        const next = speakingQueueRef.current.shift();
        if (!next) continue;
        await speak(next, voiceId);
      }
    } finally {
      queueBusyRef.current = false;
    }
  }, [speak, voiceId]);

  useEffect(() => {
    return () => {
      speakingQueueRef.current = [];
      queueBusyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let city: string | undefined;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          );
          const data = (await res.json()) as {
            address?: { city?: string; town?: string; village?: string };
          };
          city = data.address?.city ?? data.address?.town ?? data.address?.village;
        } catch {}
        locationRef.current = { lat, lon, city };
      },
      () => {},
      { timeout: 8000 },
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
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
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
  }, [cameraOn, recording]);

  const toggleRecording = useCallback(() => {
    if (!streamRef.current) return;

    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

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
  }, [recording]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: typeof window !== "undefined" ? `${window.location.origin}/api/chat` : "/api/chat",
        prepareSendMessagesRequest: ({ body, messages }) => {
          const now = new Date();
          const clientDate = now.toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const clientTime = now.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const loc = locationRef.current;
          const clientLocation = loc
            ? loc.city
              ? `${loc.city} (${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)})`
              : `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`
            : null;

          return {
            body: {
              ...body,
              messages,
              clientDate,
              clientTime,
              clientLocation,
              includeImage: false,
            },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "jarvis-main",
    transport,
  });

  useEffect(() => {
    const stored = loadStored();
    if (stored.length) {
      setMessages(stored);
      for (const m of stored) {
        if (m.role === "assistant") spokenIdsRef.current.add(m.id);
      }
    }

    const v = localStorage.getItem(VOICE_KEY);
    if (v) setVoiceIdState(v);

    setBootstrapped(true);
  }, [setMessages]);

  useEffect(() => {
    if (!bootstrapped) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, bootstrapped]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    const text = messageToText(last);
    if (!text) return;

    const completeSentences = splitCompleteSentences(text);
    const alreadySpoken = spokenSentenceCountRef.current[last.id] ?? 0;

    if (completeSentences.length > alreadySpoken) {
      const newSentences = completeSentences.slice(alreadySpoken);

      for (const sentence of newSentences) {
        const trimmed = sentence.trim();
        if (trimmed) speakingQueueRef.current.push(trimmed);
      }

      spokenSentenceCountRef.current[last.id] = completeSentences.length;
      void playQueue();
    }

    if (status === "ready" && !spokenIdsRef.current.has(last.id)) {
      spokenIdsRef.current.add(last.id);

      const draft = extractEmailDraft(text);
      if (draft) openEmailDraft(draft);

      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification("J.A.R.V.I.S", {
          body: text.slice(0, 100),
          icon: "/favicon.ico",
        });
      }
    }
  }, [messages, status, splitCompleteSentences, playQueue, openEmailDraft]);

  useEffect(() => {
    const es = new EventSource("/api/public/n8n/stream");

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { id: string; text: string };
        if (!data?.id || !data?.text) return;
        setN8nMessages((cur) => [...cur, { id: data.id, text: data.text }]);
        speakingQueueRef.current.push(data.text);
        void playQueue();
      } catch {}
    };

    return () => es.close();
  }, [playQueue]);

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

  const thinking = status === "submitted" || status === "streaming";
  const orbState: OrbState = listening
    ? "listening"
    : speaking
      ? "speaking"
      : thinking
        ? "thinking"
        : "idle";

  const blockSleep = thinking || speaking || listening;
  const { idle, wake } = useIdleTimer(30_000, blockSleep);

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/public/n8n";
    return `${window.location.origin}/api/public/n8n`;
  }, []);

  const onSend = useCallback(
    (text: string) => {
      speakingQueueRef.current = [];
      spokenSentenceCountRef.current = {};
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
    spokenSentenceCountRef.current = {};
    speakingQueueRef.current = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [setMessages]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080a] text-zinc-100">
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

      {cameraOn && (
        <div
          className="absolute left-6 top-24 z-40 overflow-hidden rounded-lg border border-teal-500/30 bg-black/20 shadow-lg backdrop-blur-sm"
          style={{ width: 180, height: 135 }}
        >
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {recording && (
            <div className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-red-500" />
          )}
          <button
            type="button"
            onClick={toggleRecording}
            className={`absolute bottom-1 right-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition ${
              recording ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/40"
            }`}
          >
            {recording ? "STOP" : "REC"}
          </button>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between px-6 py-4">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-2 backdrop-blur-md">
          <div className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.9)]" />
          <div className="font-display text-sm uppercase tracking-[0.5em] text-teal-200">
            J.A.R.V.I.S
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {Boolean(locationRef.current) && (
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-md">
              <MapPin className="h-3 w-3 text-teal-400" />
              <span className="text-[10px] text-zinc-300">
                {locationRef.current?.city ?? "Located"}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => openEmailDraft()}
            title="Draft an email"
            className="flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-zinc-300 backdrop-blur-md transition hover:bg-white/10"
          >
            <Mail className="h-3 w-3" />
            <span>EMAIL</span>
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            title={cameraOn ? "Disable camera" : "Enable camera"}
            className={`flex items-center gap-1 rounded-full border px-3 py-2 text-[10px] backdrop-blur-md transition ${
              cameraOn
                ? "border-teal-500/50 bg-teal-500/10 text-teal-300"
                : "border-white/10 bg-black/25 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {cameraOn ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
            <span>{cameraOn ? "CAM ON" : "CAM"}</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full border border-white/10 bg-black/25 p-2 text-zinc-300 backdrop-blur-md hover:bg-white/10"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {cameraError && (
        <div className="absolute right-6 top-20 z-40 text-[10px] uppercase tracking-[0.2em] text-red-400">
          {cameraError}
        </div>
      )}

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center overflow-hidden">
        <section className="relative flex h-screen w-full flex-col items-center justify-center">
          <Orb state={orbState} amplitude={amplitude} />
          <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 text-center text-xs uppercase tracking-[0.4em] text-zinc-500">
            {orbState === "idle" && "Standing by"}
            {orbState === "listening" && "Listening..."}
            {orbState === "thinking" && "Processing"}
            {orbState === "speaking" && "Responding"}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-6 pt-4">
        <div className="mx-auto max-w-4xl">
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
              Voice input not supported in this browser.
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