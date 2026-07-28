"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createOrbScene, type OrbSceneApi } from "./createOrbScene";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type OrbProps = {
  state?: OrbState;
  amplitude?: number;
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OrbSceneApi | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initRafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  const glow = useMemo(() => {
    const base =
      state === "listening"
        ? 0.75
        : state === "thinking"
          ? 0.55
          : state === "speaking"
            ? 0.95
            : 0.4;

    const audioBoost = Math.min(0.5, Math.max(0, amplitude || 0) * 0.8);
    return Math.min(1.2, base + audioBoost);
  }, [state, amplitude]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    const cleanupScene = () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      setReady(false);
    };

    const tryInit = () => {
      if (cancelled) return;
      const width = host.clientWidth;
      const height = host.clientHeight;

      if (width < 40 || height < 40) {
        initRafRef.current = window.requestAnimationFrame(tryInit);
        return;
      }

      if (sceneRef.current) return;

      cleanupScene();

      try {
        sceneRef.current = createOrbScene(host);
        setReady(true);
      } catch (error) {
        console.error("Failed to create orb scene:", error);
      }
    };

    tryInit();

    if ("ResizeObserver" in window) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (cancelled) return;

        const width = host.clientWidth;
        const height = host.clientHeight;

        if (width < 40 || height < 40) return;

        if (!sceneRef.current) {
          tryInit();
        }
      });

      resizeObserverRef.current.observe(host);
    }

    return () => {
      cancelled = true;

      if (initRafRef.current != null) {
        cancelAnimationFrame(initRafRef.current);
        initRafRef.current = null;
      }

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      cleanupScene();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (state === "thinking") {
      scene.zoomBy(0.9975);
    }

    if (state === "listening") {
      scene.rotateBy(0.003, 0.001);
    }

    if (state === "speaking") {
      scene.rotateBy(0.006, 0.0015);
    }

    if (state === "idle") {
      scene.rotateBy(0.0015, 0);
    }
  }, [state, amplitude]);

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl transition-opacity duration-300"
        style={{
          opacity: glow,
          background:
            state === "speaking"
              ? "radial-gradient(circle, rgba(96,165,250,0.26) 0%, rgba(59,130,246,0.16) 35%, rgba(15,23,42,0) 72%)"
              : state === "listening"
                ? "radial-gradient(circle, rgba(125,211,252,0.22) 0%, rgba(59,130,246,0.14) 35%, rgba(15,23,42,0) 72%)"
                : state === "thinking"
                  ? "radial-gradient(circle, rgba(147,197,253,0.18) 0%, rgba(30,64,175,0.12) 35%, rgba(15,23,42,0) 72%)"
                  : "radial-gradient(circle, rgba(59,130,246,0.16) 0%, rgba(30,64,175,0.1) 35%, rgba(15,23,42,0) 72%)",
          transform: `scale(${1 + Math.min(0.16, amplitude * 0.12)})`,
        }}
      />

      <div
        ref={hostRef}
        className="relative z-10"
        style={{
          width: "min(72vw, 680px)",
          height: "min(72vw, 680px)",
          minWidth: 320,
          minHeight: 320,
          maxWidth: 680,
          maxHeight: 680,
        }}
      />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full"
            style={{
              width: 190,
              height: 190,
              background:
                "radial-gradient(circle at 35% 30%, rgba(147,197,253,0.95) 0%, rgba(59,130,246,0.85) 38%, rgba(15,23,42,0.96) 100%)",
              boxShadow:
                "0 0 80px rgba(59,130,246,0.25), inset 0 0 40px rgba(255,255,255,0.12)",
            }}
            aria-hidden
          />
        </div>
      )}

      <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2">
        <div className="rounded-full border border-white/10 bg-black/20 px-4 py-1 text-[10px] uppercase tracking-[0.35em] text-zinc-400 backdrop-blur-sm">
          {stateLabel(state)}
        </div>
      </div>
    </div>
  );
}
