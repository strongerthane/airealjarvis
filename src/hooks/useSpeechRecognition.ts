import { useCallback, useEffect, useRef, useState } from "react";

type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function useSpeechRecognition(opts: {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
}) {
  const { onFinal, onInterim } = opts;
  const recRef = useRef<SR | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec: SR = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && onInterim) onInterim(interim);
      if (final.trim()) onFinal(final.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
  }, [onFinal, onInterim]);

  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    try {
      recRef.current.start();
      setListening(true);
    } catch {}
  }, [listening]);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try {
      recRef.current.stop();
    } catch {}
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}