"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createOrbScene, type OrbSceneApi } from "@/lib/orbScene";
import { HandTracker, type TrackerStatus } from "@/lib/handTracker";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type OrbProps = {
  state?: OrbState;
  amplitude?: number;
};

type CameraState = "off" | "starting" | "on" | "error";

const MODE_LABEL: Record<TrackerStatus["mode"], string> = {
  idle: "STANDBY",
  spin: "SPIN",
  zoom: "ZOOM",
};

function stateLabel(state: OrbState) {
  switch (state) {
    case "listening":
      return "Listening";
    case "thinking":
      return "Processing";
    case "speaking":
      return "Responding";
    default:
      return "Standing by";
  }
}

export function Orb({ state = "idle", amplitude = 0 }: OrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbSceneApi | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);

  const [ready, setReady] = useState(false);
  const [camera, setCamera] = useState<CameraState>("off");
  const [status, setStatus] = useState<TrackerStatus>({ hands: 0, mode: "idle" });
  const [error, setError] = useState<string | null>(null);

  const glow = useMemo(() => {
    const base =
      state === "listening"
        ? 0.72
        : state === "thinking"
          ? 0.58
          : state === "speaking"
            ? 0.95
            : 0.42;
    return Math.min(1.15, base + Math.min(0.35, Math.max(0, amplitude) * 0.75));
  }, [state, amplitude]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = createOrbScene(el);
    sceneRef.current = scene;
    setReady(true);

    return () => {
      trackerRef.current?.stop();
      trackerRef.current = null;
      scene.dispose();
      sceneRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (state === "idle") scene.rotateBy(0.0012, 0);
    if (state === "listening") scene.rotateBy(0.0025, 0.001);
    if (state === "thinking") scene.rotateBy(0.0035, 0.0012);
    if (state === "speaking") scene.rotateBy(0.006, 0.0018);
  }, [state, amplitude]);

  const stopGestures = () => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setCamera("off");
    setStatus({ hands: 0, mode: "idle" });
  };

  const startGestures = async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || trackerRef.current) return;

    setCamera("starting");
    setError(null);

    const tracker = new HandTracker(video, overlay, {
      onRotate: (dt, dp) => sceneRef.current?.rotateBy(dt, dp),
      onZoom: (factor) => sceneRef.current?.zoomBy(factor),
      onStatus: setStatus,
    });

    trackerRef.current = tracker;

    try {
      await tracker.start();
      setCamera("on");
    } catch (err) {
      trackerRef.current = null;
      tracker.stop();
      setCamera("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "CAMERA ACCESS DENIED"
          : "TRACKING INIT FAILED",
      );
    }
  };

  const toggleGestures = () => {
    if (trackerRef.current) stopGestures();
    else void startGestures();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "+":
        case "=":
          sceneRef.current?.zoomIn();
          break;
        case "-":
        case "_":
          sceneRef.current?.zoomOut();
          break;
        case "r":
        case "R":
          sceneRef.current?.resetView();
          break;
        case "g":
        case "G":
          toggleGestures();
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cameraOn = camera === "on";

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-300"
        style={{
          opacity: state === "speaking" ? Math.min(1.05, glow + amplitude * 0.25) : glow,
          background:
            state === "speaking"
              ? "radial-gradient(circle, rgba(34,211,238,0.18) 0%, rgba(59,130,246,0.12) 35%, rgba(15,23,42,0) 72%)"
              : state === "listening"
                ? "radial-gradient(circle, rgba(125,211,252,0.16) 0%, rgba(59,130,246,0.10) 35%, rgba(15,23,42,0) 72%)"
                : state === "thinking"
                  ? "radial-gradient(circle, rgba(96,165,250,0.14) 0%, rgba(37,99,235,0.08) 35%, rgba(15,23,42,0) 72%)"
                  : "radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(30,64,175,0.06) 35%, rgba(15,23,42,0) 72%)",
          transform: `scale(${
            state === "speaking"
              ? 1 + Math.min(0.16, 0.04 + amplitude * 0.12)
              : 1 + Math.min(0.08, amplitude * 0.06)
          })`,
          filter: state === "speaking" ? "blur(40px)" : "blur(30px)",
        }}
      />

      <div
        ref={containerRef}
        className="relative z-10"
        style={{
          width: "min(62vw, 640px)",
          height: "min(62vw, 640px)",
          minWidth: 280,
          minHeight: 280,
          maxWidth: 640,
          maxHeight: 640,
          transform: "translateY(-12vh)",
        }}
      />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            aria-hidden
            className="rounded-full"
            style={{
              width: 180,
              height: 180,
              transform: "translateY(-12vh)",
              background:
                "radial-gradient(circle at 35% 30%, rgba(147,197,253,0.95) 0%, rgba(59,130,246,0.85) 38%, rgba(15,23,42,0.96) 100%)",
              boxShadow: "0 0 120px rgba(59,130,246,0.18), inset 0 0 40px rgba(255,255,255,0.08)",
            }}
          />
        </div>
      )}

      <video ref={videoRef} muted playsInline className="hidden" />
      <canvas ref={overlayRef} width={208} height={156} className="hidden" />

      <div className="pointer-events-none absolute left-4 top-20 z-30 flex flex-col gap-2">
        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-zinc-300 backdrop-blur-md">
          <span className="jarvis-key">DRAG</span> spin{" "}
          <span className="jarvis-key">SCROLL</span> zoom
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-zinc-300 backdrop-blur-md">
          <span className="jarvis-key">G</span> hand gestures{" "}
          <span className="jarvis-key">R</span> reset{" "}
          <span className="jarvis-key">+/-</span> zoom
        </div>
      </div>

      <div className="absolute right-4 top-20 z-30 flex flex-col items-end gap-3">
        <button
          type="button"
          className="jarvis-hud-btn"
          aria-pressed={cameraOn}
          onClick={toggleGestures}
          disabled={camera === "starting"}
        >
          {camera === "starting"
            ? "INITIALIZING..."
            : cameraOn
              ? "GESTURES ON"
              : "GESTURES OFF"}
        </button>

        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-zinc-300 backdrop-blur-md">
          {status.hands > 0
            ? `${status.hands} HAND${status.hands > 1 ? "S" : ""} • ${MODE_LABEL[status.mode]}`
            : "SHOW HANDS"}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-black/25 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-red-400 backdrop-blur-md">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            className="jarvis-hud-btn"
            onClick={() => sceneRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            className="jarvis-hud-btn"
            onClick={() => sceneRef.current?.zoomOut()}
          >
            -
          </button>
          <button
            type="button"
            className="jarvis-hud-btn"
            onClick={() => sceneRef.current?.resetView()}
          >
            RESET
          </button>
        </div>
      </div>
    </div>
  );
}