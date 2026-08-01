# Jarvis

Jarvis is a voice-first AI assistant app with chat, text-to-speech, and an animated orb-style interface.
> [!IMPORTANT]
> Passcode: "IronMohit".

## Features

- Real-time chat interface.
- Text-to-speech playback.
- Breeze Blue and ElevenLabs TTS support.
- Animated Jarvis orb UI.
- API routes for chat and TTS.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:8080`.

## Build

```bash
npm run build
npm run preview
```

## Environment variables

Create a local `.env` file and add the keys your setup needs, for example:

```env
BREEZE_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
```

Do not commit `.env` or backup files to GitHub.

## Project structure

- `src/components/jarvis/` — UI components.
- `src/routes/api/chat.ts` — chat API route.
- `src/routes/api/tts.ts` — TTS API route.
- `src/hooks/` — app hooks.
- `src/lib/` — shared logic.

## Notes

- If deployment fails, confirm all dependencies are listed in `package.json`.
- For Vercel, make sure the build uses the repo root and the correct install command.
