"use client";

import { useState, useEffect } from "react";

const ACCESS_PASSWORD = "IronMohit";

interface Props {
  children: React.ReactNode;
}

export function AccessGate({ children }: Props) {
  const [input, setInput] = useState("");
  // Auto-grant in local dev environments so the UI (orb) appears without a password check.
  // Start deterministically false on both server and client to avoid hydration mismatches.
  const [granted, setGranted] = useState<boolean>(false);
  const [denied, setDenied] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // On the client, auto-grant for localhost/dev hosts so the UI is visible during development.
  useEffect(() => {
    try {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') setGranted(true);
    } catch {}
  }, []);

  if (granted) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ACCESS_PASSWORD) {
      setGranted(true);
      setDenied(false);
    } else {
      setDenied(true);
      setAttempts((a) => a + 1);
      setInput("");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#06080a] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(20,184,166,0.1), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-teal-400 shadow-[0_0_16px_rgba(20,184,166,0.9)]" />
          <div className="font-mono text-xs uppercase tracking-[0.6em] text-teal-300">
            J.A.R.V.I.S
          </div>
          <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            Security Clearance Required
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <div className="rounded-lg border border-teal-900/60 bg-white/[0.03] p-6 backdrop-blur">
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">
              Access Code
            </label>
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setDenied(false); }}
              autoFocus
              placeholder="Enter clearance code"
              className="w-full rounded border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30"
            />
            {denied && (
              <p className="mt-3 font-mono text-[11px] text-red-400">
                {attempts >= 3
                  ? "I'm afraid I cannot permit that, Boss. Security protocols engaged."
                  : "Access denied. Perhaps try again, Boss."}
              </p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded border border-teal-500/30 bg-teal-500/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.3em] text-teal-300 transition hover:bg-teal-500/20 hover:border-teal-400/50"
            >
              Request Access
            </button>
          </div>
        </form>

        <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
          Unauthorised access will be noted
        </p>
      </div>
    </div>
  );
}
