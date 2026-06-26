import { useEffect, useRef, useState } from "react";

export function useIdleTimer(ms: number, blocked: boolean) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIdle(false);
      if (blocked) return;
      timerRef.current = setTimeout(() => setIdle(true), ms);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ms, blocked]);

  return { idle, wake: () => setIdle(false) };
}