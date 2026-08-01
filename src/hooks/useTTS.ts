import { useCallback, useEffect, useRef, useState } from "react";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);

  const [speaking, setSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.disconnect();
        sourceRef.current = null;
      } catch {}
      try {
        analyserRef.current?.disconnect();
        analyserRef.current = null;
      } catch {}
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (!analyser || !data) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    setAmplitude(Math.min(1, rms * 3));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string) => {
      const clean = text.trim();
      if (!clean) return;

      audioRef.current?.pause();
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setSpeaking(false);
      setAmplitude(0);

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voiceId }),
      });

      if (!res.ok) {
        let hint = "";
        try { hint = await res.text(); } catch {}
        throw new Error(`TTS server returned ${res.status}: ${hint}`);
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error("TTS returned empty audio");

      const url = URL.createObjectURL(blob);

      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});

      if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch {} }
      if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} }

      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.fftSize);

      await new Promise<void>(async (resolve, reject) => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          setSpeaking(false);
          setAmplitude(0);
          URL.revokeObjectURL(url);
          resolve();
        };
        const fail = (e: unknown) => {
          if (resolved) return;
          resolved = true;
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          setSpeaking(false);
          setAmplitude(0);
          URL.revokeObjectURL(url);
          reject(e);
        };

        audio.onplay = () => {
          setSpeaking(true);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          tick();
        };
        audio.onended = finish;
        audio.onerror = () => fail(new Error("Audio playback failed"));

        try {
          await audio.play();
        } catch (e) {
          fail(e);
        }
      });
    },
    [tick],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setSpeaking(false);
    setAmplitude(0);
  }, []);

  return { speak, stop, speaking, amplitude };
}