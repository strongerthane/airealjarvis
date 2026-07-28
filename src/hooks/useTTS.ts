import { useCallback, useEffect, useRef, useState } from "react";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const tick = useCallback(() => {
    if (!analyserRef.current || !dataRef.current) return;
    analyserRef.current.getByteTimeDomainData(dataRef.current);
    let sum = 0;
    for (let i = 0; i < dataRef.current.length; i++) {
      const v = (dataRef.current[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataRef.current.length);
    setAmplitude(Math.min(1, rms * 3));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string) => {
      if (!text.trim()) return;

      // Stop any in-flight playback
      audioRef.current?.pause();

      // Primary: server-side TTS (ElevenLabs). Fallback: browser SpeechSynthesis.
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId }),
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;

        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});

        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        dataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));

        audio.onplay = () => {
          setSpeaking(true);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          tick();
        };
        const end = () => {
          setSpeaking(false);
          setAmplitude(0);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          URL.revokeObjectURL(url);
        };
        audio.onended = end;
        audio.onerror = end;
        await audio.play();
      } catch (err) {
        // Fallback to browser SpeechSynthesis to avoid a hard failure in dev/no-key environments
        try {
          console.warn("Server TTS failed, falling back to SpeechSynthesis", err);
          if ((window as any).speechSynthesis) {
            const utter = new SpeechSynthesisUtterance(text);
            // Optionally select a voice by name/id if available
            if (voiceId) {
              const voices = (window as any).speechSynthesis.getVoices();
              const match = voices.find((v: any) => v.voiceURI === voiceId || v.name === voiceId || v.lang === voiceId);
              if (match) utter.voice = match;
            }
            utter.onstart = () => setSpeaking(true);
            utter.onend = () => setSpeaking(false);
            utter.onerror = () => setSpeaking(false);
            (window as any).speechSynthesis.cancel();
            (window as any).speechSynthesis.speak(utter);
          } else {
            setSpeaking(false);
          }
        } catch (e) {
          console.error("TTS fallback failed", e);
          setSpeaking(false);
        }
      }
    },
    [tick],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setSpeaking(false);
    setAmplitude(0);
  }, []);

  return { speak, stop, speaking, amplitude };
}