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

  const stopMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAmplitude(0);
  }, []);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.src = "";
    }
    audioRef.current = null;
    stopMeter();
    setSpeaking(false);
  }, [stopMeter]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {}
        analyserRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [cleanupAudio]);

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

  const ensureAudioGraph = useCallback(async (audio: HTMLAudioElement) => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = ctxRef.current;

    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }

    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    sourceRef.current = source;
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.fftSize);
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string) => {
      const clean = text.trim();
      if (!clean) return;

      cleanupAudio();

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, voiceId }),
        });

        if (!res.ok) {
          throw new Error(`TTS ${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const audio = new Audio();
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";
        audio.src = url;

        audioRef.current = audio;

        await ensureAudioGraph(audio);

        await new Promise<void>(async (resolve, reject) => {
          const finish = () => {
            stopMeter();
            setSpeaking(false);
            URL.revokeObjectURL(url);
            resolve();
          };

          const fail = () => {
            stopMeter();
            setSpeaking(false);
            URL.revokeObjectURL(url);
            reject(new Error("Audio playback failed"));
          };

          audio.onplay = () => {
            setSpeaking(true);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            tick();
          };

          audio.onended = finish;
          audio.onerror = fail;

          try {
            await audio.play();
          } catch (err) {
            fail();
          }
        });
      } catch (err) {
        try {
          console.warn("Server TTS failed, falling back to SpeechSynthesis", err);

          const synth = (window as any).speechSynthesis;
          if (!synth) {
            setSpeaking(false);
            setAmplitude(0);
            return;
          }

          await new Promise<void>((resolve, reject) => {
            const utter = new SpeechSynthesisUtterance(clean);
            utter.rate = 0.96;
            utter.pitch = 1.0;

            if (voiceId) {
              const voices = synth.getVoices?.() ?? [];
              const match = voices.find(
                (v: any) => v.voiceURI === voiceId || v.name === voiceId || v.lang === voiceId,
              );
              if (match) utter.voice = match;
            }

            utter.onstart = () => {
              setSpeaking(true);
              setAmplitude(0.25);
            };

            utter.onend = () => {
              setSpeaking(false);
              setAmplitude(0);
              resolve();
            };

            utter.onerror = () => {
              setSpeaking(false);
              setAmplitude(0);
              reject(new Error("SpeechSynthesis failed"));
            };

            synth.cancel();
            synth.speak(utter);
          });
        } catch (fallbackErr) {
          console.error("TTS fallback failed", fallbackErr);
          setSpeaking(false);
          setAmplitude(0);
        }
      } finally {
        cleanupAudio();
      }
    },
    [cleanupAudio, ensureAudioGraph, stopMeter, tick],
  );

  const stop = useCallback(() => {
    const synth = (window as any).speechSynthesis;
    if (synth) synth.cancel();
    cleanupAudio();
  }, [cleanupAudio]);

  return { speak, stop, speaking, amplitude };
}