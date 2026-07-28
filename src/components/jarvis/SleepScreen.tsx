import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Orb } from "./Orb";

export function SleepScreen({ asleep, onWake }: { asleep: boolean; onWake: () => void }) {
  // Prevent SSR/client mismatch by rendering dynamic time/date only on the client.
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!asleep || !isClient) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [asleep, isClient]);

  const time = isClient ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "00:00";
  const date = isClient
    ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <AnimatePresence>
      {asleep && (
        <motion.div
          key="sleep"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={onWake}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-[#06080a] px-6 text-center"
        >
          <div className="absolute right-8 top-8 scale-[0.3] opacity-60">
            {isClient ? <Orb state="idle" /> : null}
          </div>
          <div className="font-display text-[18vw] font-thin leading-none tracking-tight text-zinc-100 sm:text-[14rem]">
            {time}
          </div>
          <div className="mt-4 text-sm uppercase tracking-[0.4em] text-zinc-500 sm:text-base">
            {date}
          </div>
          <div className="mt-16 text-xs uppercase tracking-[0.5em] text-teal-300/80">
            Jarvis is standing by...
          </div>
          <div className="mt-4 text-[10px] uppercase tracking-[0.4em] text-zinc-600">
            Tap anywhere to wake
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}