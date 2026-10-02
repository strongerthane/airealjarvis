# JARVIS local app launcher

Run this companion on your Windows computer while using the JARVIS website:

```powershell
npm run app-launcher
```

It opens the built-in aliases (Calculator, Notepad, Paint, File Explorer, Task Manager, Control Panel, and Settings), then searches your Windows Start-menu shortcuts for installed apps such as Discord, Spotify, or Steam. Recognized websites open in your visible default browser; unknown `open ...` requests fall back to a Google search. It never runs arbitrary shell commands or paths supplied in chat.
