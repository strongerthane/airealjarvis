
## Jarvis AI Assistant — Build Plan

### Visual direction
- Pitch-black background (`#06080a`) with subtle radial vignette and faint scanline texture.
- Central **teal orb** (~280px desktop, 180px mobile): layered radial gradients in teal `#14b8a6 → #5eead4`, soft outer glow, inner highlight.
  - **Idle**: desaturated grey (`#3a4a4d`), slow 4s breathing scale (0.98→1.02).
  - **Listening**: teal, rapid pulse + expanding ripple rings.
  - **Speaking**: brighter teal glow, intensity reacts to audio amplitude (Web Audio AnalyserNode on the TTS playback).
- Typography: Space Grotesk (display) + Inter (body) via `@fontsource`.
- Chat panel: glassmorphic translucent surface to the right of orb on desktop, stacked below on mobile. Messages as minimal bubbles; user right-aligned teal-outlined, Jarvis left-aligned with subtle glow.
- Input bar fixed bottom-center: pill-shaped, mic button (left), textarea, send button (right). All teal accents.
- **Sleep screen**: full-screen overlay with huge thin clock (HH:MM), date underneath, "JARVIS is standing by..." caption, faint pulsing orb in the corner. Fade-in after 30s idle; click/tap/keypress anywhere fades back to main.

### Architecture

```text
src/
  routes/
    __root.tsx                       (existing — keep)
    index.tsx                        (Jarvis main screen)
    api/
      chat.ts                        (POST — streams Gemini reply via Lovable AI)
      tts.ts                         (POST — proxies ElevenLabs streaming TTS)
      webhook.n8n.ts                 (POST under /api/public/n8n — receives n8n payloads)
  components/
    jarvis/
      Orb.tsx                        (state-driven animated orb)
      ChatPanel.tsx                  (message list, auto-scroll)
      MessageBubble.tsx
      InputBar.tsx                   (textarea + mic + send)
      SleepScreen.tsx                (clock overlay)
      JarvisApp.tsx                  (top-level composition + state machine)
  hooks/
    useSpeechRecognition.ts          (Web Speech API wrapper)
    useTTS.ts                        (calls /api/tts, plays stream, exposes amplitude + speaking flag)
    useIdleTimer.ts                  (30s inactivity → sleep)
    useChatStore.ts                  (localStorage-backed message array + zustand-lite reducer)
    useN8nWebhookBridge.ts           (polls /api/public/n8n/pending or subscribes via SSE)
  lib/
    ai-gateway.server.ts             (Lovable AI Gateway helper — per knowledge file)
    elevenlabs.server.ts             (TTS fetch helper)
    n8n-inbox.server.ts              (in-memory + SSE broadcast for webhook messages)
    jarvis-prompt.ts                 (system prompt)
```

### Conversation + storage
- Single ongoing conversation; messages persisted in `localStorage` under `jarvis:messages` as `UIMessage[]`.
- Client uses AI SDK `useChat` with `DefaultChatTransport({ api: "/api/chat" })`, id `"jarvis"`, initial messages from localStorage, persists on `onFinish` and on user send.
- New conversation button in header clears localStorage.

### AI brain
- `/api/chat` server route uses `streamText` with `google/gemini-3-flash-preview` via the canonical Lovable AI Gateway helper.
- System prompt: professional, witty, Tony-Stark-Jarvis tone; **always addresses the user as "Boss"**; never breaks character; concise; reply in plain prose suitable for TTS (no markdown lists where avoidable).

### Voice output (ElevenLabs)
- Link ElevenLabs via standard connector → `ELEVENLABS_API_KEY` available server-side.
- **Voice ID** configurable: stored in localStorage with default `JBFqnCBsd6RMkjVDRZzb` (George — fits Jarvis). Settings gear in header opens a small dialog to change it.
- `/api/tts` POST `{ text, voiceId }` → streams MP3 from `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream?output_format=mp3_44100_128` with `eleven_turbo_v2_5` (low latency). Returns the body as `audio/mpeg`.
- Client `useTTS`: fetch as blob, play via `<audio>` element wired to `AudioContext` + `AnalyserNode` to drive orb amplitude. On stream end → orb returns to idle.
- After each assistant message finishes streaming text → automatically send full text to `/api/tts` and play.

### Voice input
- `useSpeechRecognition` wraps `window.SpeechRecognition || webkitSpeechRecognition` (Chrome/Edge/Safari). Mic button toggles listening; live interim transcript shown inside input; on final result, auto-send.
- While listening → orb enters "listening" state (rapid teal pulse + ripple rings).
- Graceful fallback message if browser lacks SpeechRecognition.

### Sleep screen
- `useIdleTimer(30_000)` watches mousemove/keydown/touchstart/click + speaking/listening activity. After 30s of no activity AND not currently speaking/listening → set `asleep=true`.
- `<SleepScreen>` rendered with framer-motion fade (300ms). Click/tap/keypress anywhere → `asleep=false`.
- Clock updates every second; format `HH:MM` + weekday + date.

### n8n webhook
- `POST /api/public/n8n` (public prefix bypasses auth). Accepts JSON `{ message: string, secret?: string }`.
- Security: requires header `x-jarvis-webhook-secret` matching `JARVIS_WEBHOOK_SECRET` (generated server-side); timing-safe compare. Validates with Zod.
- Bridge to browser: maintains `/api/public/n8n/stream` SSE endpoint that broadcasts new messages. Client `useN8nWebhookBridge` subscribes when app mounts; on message → append as Jarvis-authored chat entry, trigger TTS, wake from sleep if asleep.
- In-memory queue is fine for single-instance dev; document that for production use, message persists only while server process lives.
- Webhook URL displayed in a small "Integrations" panel inside settings dialog, with copy button. Path: `https://<project>.lovable.app/api/public/n8n`.

### State machine for orb
`idle | listening | thinking | speaking` — derived from: speech recognition active, chat `status==="streaming"`, TTS playing. Priority: listening > speaking > thinking > idle.

### Mobile
- Orb shrinks, chat panel becomes a scrollable column above input. Input bar sticks to bottom with safe-area padding. Sleep screen full-screen on all sizes.

### Setup steps
1. Link ElevenLabs standard connector.
2. Generate `JARVIS_WEBHOOK_SECRET` server secret.
3. `bun add @fontsource/space-grotesk @fontsource/inter motion ai @ai-sdk/react @ai-sdk/openai-compatible zod eventsource-parser`.
4. Build files per layout above.
5. Verify: send chat → reply streams → TTS plays → orb animates; mic captures speech; idle 30s → sleep screen; POST to webhook with secret → message appears + spoken.

### Out of scope (can add later)
- Multi-thread history, cloud sync, real STT via ElevenLabs Scribe (browser STT is sufficient and free), wake-word detection, image attachments.
