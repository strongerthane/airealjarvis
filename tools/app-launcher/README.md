# JARVIS local app launcher

Run this companion on your Windows computer while using the JARVIS website:

```powershell
npm run app-launcher
```

It accepts only safe, built-in app aliases (Calculator, Notepad, Paint, File Explorer, Task Manager, Control Panel, and Settings). Recognized websites open in your visible default browser; unknown `open ...` requests fall back to a Google search. It never runs arbitrary shell commands.
