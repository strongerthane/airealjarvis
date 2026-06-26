import { motion } from "motion/react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export function Orb({ state, amplitude = 0 }: { state: OrbState; amplitude?: number }) {
  const isIdle = state === "idle";
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isThinking = state === "thinking";

  const scale = isSpeaking ? 1 + amplitude * 0.18 : 1;

  return (
    <div className="relative flex items-center justify-center" aria-label={`Jarvis ${state}`}>
      {/* outer ambient glow */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 360,
          height: 360,
          background: isIdle
            ? "radial-gradient(circle, rgba(120,140,150,0.18), transparent 70%)"
            : "radial-gradient(circle, rgba(20,184,166,0.45), transparent 70%)",
        }}
        animate={{
          opacity: isIdle ? 0.4 : isSpeaking ? 0.7 + amplitude * 0.3 : 0.8,
          scale: isIdle ? [0.95, 1.02, 0.95] : 1,
        }}
        transition={
          isIdle
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      />

      {/* listening ripples */}
      {isListening &&
        [0, 0.6, 1.2].map((delay) => (
          <motion.div
            key={delay}
            className="absolute rounded-full border border-teal-400/40"
            style={{ width: 220, height: 220 }}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
          />
        ))}

      {/* thinking spin ring */}
      {isThinking && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 240,
            height: 240,
            border: "1px solid rgba(94,234,212,0.35)",
            borderTopColor: "rgba(94,234,212,0.9)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* core orb */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: 200,
          height: 200,
          background: isIdle
            ? "radial-gradient(circle at 35% 30%, #5b6e72 0%, #2a3537 55%, #0f1718 100%)"
            : "radial-gradient(circle at 35% 30%, #99f6e4 0%, #14b8a6 45%, #0f766e 85%, #042f2e 100%)",
          boxShadow: isIdle
            ? "inset 0 0 40px rgba(0,0,0,0.6), 0 0 30px rgba(60,80,85,0.3)"
            : `inset 0 0 50px rgba(0,0,0,0.5), 0 0 60px rgba(20,184,166,${0.5 + amplitude * 0.4}), 0 0 120px rgba(20,184,166,${0.25 + amplitude * 0.3})`,
        }}
        animate={
          isIdle
            ? { scale: [0.98, 1.02, 0.98] }
            : isListening
              ? { scale: [1, 1.06, 1] }
              : { scale }
        }
        transition={
          isIdle
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : isListening
              ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.12 }
        }
      >
        {/* inner highlight */}
        <div
          className="absolute rounded-full"
          style={{
            top: "12%",
            left: "18%",
            width: "40%",
            height: "28%",
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>
    </div>
  );
}