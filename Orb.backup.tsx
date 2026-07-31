import { motion } from "motion/react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const blue = "56, 189, 248";
const cyan = "34, 211, 238";

export function Orb({ state, amplitude = 0 }: { state: OrbState; amplitude?: number }) {
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const energy = isSpeaking ? 0.78 + amplitude * 0.22 : isListening ? 0.86 : isThinking ? 0.7 : 0.52;
  const pulseScale = isSpeaking ? 1 + amplitude * 0.12 : 1;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: "min(380px, 78vw)", height: "min(380px, 78vw)", minWidth: 260, minHeight: 260 }}
      aria-label={`Jarvis ${state}`}
      role="status"
    >
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          inset: 0,
          background: `radial-gradient(circle, rgba(${blue}, ${energy * 0.32}) 0%, rgba(${cyan}, ${energy * 0.1}) 37%, transparent 69%)`,
        }}
        animate={{ scale: [0.86, 1.1, 0.86], opacity: [0.58, 1, 0.58] }}
        transition={{ duration: isListening ? 1.3 : isSpeaking ? 0.9 : 3.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute rounded-full border border-sky-200/20"
        style={{ width: "83%", height: "83%", boxShadow: `0 0 28px rgba(${blue}, 0.28), inset 0 0 25px rgba(${blue}, 0.08)` }}
        animate={{ rotate: 360, scale: isListening ? [0.98, 1.05, 0.98] : 1 }}
        transition={{ rotate: { duration: 22, repeat: Infinity, ease: "linear" }, scale: { duration: 1.35, repeat: Infinity, ease: "easeInOut" } }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: "75%",
          height: "75%",
          background: `conic-gradient(from 220deg, transparent 0deg, rgba(${blue}, 0.1) 34deg, rgba(${cyan}, 0.78) 52deg, transparent 77deg, transparent 180deg, rgba(${blue}, 0.34) 225deg, transparent 253deg)`,
          maskImage: "radial-gradient(transparent 61%, #000 62%, #000 66%, transparent 67%)",
          WebkitMaskImage: "radial-gradient(transparent 61%, #000 62%, #000 66%, transparent 67%)",
        }}
        animate={{ rotate: -360, opacity: [0.58, 1, 0.58] }}
        transition={{ rotate: { duration: isThinking ? 2.1 : 9, repeat: Infinity, ease: "linear" }, opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
      />

      {isListening &&
        [0, 0.55, 1.1].map((delay) => (
          <motion.div
            key={delay}
            className="absolute rounded-full border border-sky-300/45"
            style={{ width: "53%", height: "53%" }}
            initial={{ scale: 0.92, opacity: 0.62 }}
            animate={{ scale: 1.72, opacity: 0 }}
            transition={{ duration: 1.65, repeat: Infinity, delay, ease: "easeOut" }}
          />
        ))}

      <motion.div
        className="relative overflow-hidden rounded-full"
        style={{
          width: "58%",
          height: "58%",
          background: "radial-gradient(circle at 50% 50%, rgba(213,249,255,0.9) 0%, rgba(80,213,255,0.55) 4%, rgba(13,129,225,0.22) 15%, rgba(2,33,83,0.16) 39%, rgba(1,7,24,0.04) 63%, transparent 72%)",
          boxShadow: `inset -18px -22px 34px rgba(0, 4, 20, 0.42), inset 13px 15px 26px rgba(177, 241, 255, 0.18), 0 0 22px rgba(${cyan}, ${energy * 0.65}), 0 0 68px rgba(${blue}, ${energy * 0.52}), 0 0 130px rgba(${blue}, ${energy * 0.18})`,
        }}
        animate={{ scale: [pulseScale * 0.985, pulseScale * 1.035, pulseScale * 0.985] }}
        transition={{ duration: isSpeaking ? 0.46 : isListening ? 1.05 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.svg
          viewBox="0 0 200 200"
          className="absolute"
          style={{ inset: "2%", width: "96%", height: "96%", overflow: "visible" }}
          animate={{ rotate: 360 }}
          transition={{ duration: isThinking ? 3.2 : 17, repeat: Infinity, ease: "linear" }}
        >
          <g fill="none" stroke="rgba(66, 208, 255, 0.64)" strokeWidth="0.85">
            <ellipse cx="100" cy="100" rx="85" ry="36" transform="rotate(-18 100 100)" />
            <ellipse cx="100" cy="100" rx="79" ry="46" transform="rotate(52 100 100)" opacity="0.72" />
            <ellipse cx="100" cy="100" rx="73" ry="54" transform="rotate(-70 100 100)" opacity="0.55" />
            <path d="M19 104C47 54 123 46 181 90C147 151 76 165 19 104Z" opacity="0.62" />
            <path d="M35 62C78 84 129 67 165 119C118 143 65 129 35 62Z" opacity="0.44" />
          </g>
          <g fill="#a5f3fc" style={{ filter: "drop-shadow(0 0 3px #38bdf8)" }}>
            {[{ x: 26, y: 104, r: 2 }, { x: 48, y: 65, r: 1.5 }, { x: 76, y: 48, r: 1.4 }, { x: 116, y: 49, r: 1.8 }, { x: 159, y: 78, r: 1.4 }, { x: 174, y: 112, r: 2 }, { x: 142, y: 145, r: 1.5 }, { x: 84, y: 156, r: 1.8 }, { x: 52, y: 128, r: 1.3 }].map((node) => (
              <circle key={`${node.x}-${node.y}`} cx={node.x} cy={node.y} r={node.r} />
            ))}
          </g>
        </motion.svg>
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: "-15%",
            background: "conic-gradient(from 25deg, transparent 0deg, rgba(181,247,255,0.08) 42deg, rgba(50,201,255,0.52) 82deg, transparent 118deg, rgba(12,92,196,0.34) 210deg, transparent 276deg)",
            filter: "blur(5px)",
          }}
          animate={{ rotate: 360, scale: [0.9, 1.12, 0.9] }}
          transition={{ rotate: { duration: isThinking ? 1.8 : 7.5, repeat: Infinity, ease: "linear" }, scale: { duration: 2.1, repeat: Infinity, ease: "easeInOut" } }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: "22%",
            background: "radial-gradient(circle, rgba(223,250,255,0.96) 0%, rgba(100,220,255,0.76) 17%, rgba(16,121,218,0.28) 52%, transparent 72%)",
            filter: "blur(2px)",
          }}
          animate={{ scale: isSpeaking ? [0.82, 1.22, 0.82] : [0.9, 1.08, 0.9], opacity: [0.64, 1, 0.64] }}
          transition={{ duration: isSpeaking ? 0.48 : 2.15, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute rounded-full"
          style={{ top: "12%", left: "16%", width: "39%", height: "32%", background: "radial-gradient(ellipse, rgba(255,255,255,0.93) 0%, rgba(196,245,255,0.36) 33%, transparent 71%)", filter: "blur(5px)", transform: "rotate(-24deg)" }}
        />
        <div className="absolute rounded-full border border-sky-100/30" style={{ inset: 0 }} />
      </motion.div>

      <motion.div
        className="absolute rounded-full border border-sky-100/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        style={{ width: "64%", height: "64%", borderLeftColor: `rgba(${cyan}, 0.7)`, borderRightColor: `rgba(${blue}, 0.32)` }}
      />
    </div>
  );
}
