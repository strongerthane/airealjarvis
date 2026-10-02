import http from "node:http";
import path from "node:path";
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";

const PORT = Number(process.env.JARVIS_LAUNCHER_PORT || 27183);
const ALLOWED_ORIGINS = new Set([
  "https://airealjarvis.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const APPS = {
  notepad: "notepad.exe",
  calculator: "calc.exe",
  calc: "calc.exe",
  paint: "mspaint.exe",
  explorer: "explorer.exe",
  "file explorer": "explorer.exe",
  files: "explorer.exe",
  "task manager": "taskmgr.exe",
  "control panel": "control.exe",
};

const SITES = {
  youtube: "https://www.youtube.com",
  yt: "https://www.youtube.com",
  gmail: "https://mail.google.com",
  github: "https://github.com",
  google: "https://www.google.com",
  maps: "https://maps.google.com",
  "google maps": "https://maps.google.com",
  spotify: "https://open.spotify.com",
  netflix: "https://www.netflix.com",
  chatgpt: "https://chatgpt.com",
};

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim().replace(/^(?:the|my|a|an)\s+/, "");
}

function openUrl(url) {
  const child = spawn("cmd.exe", ["/d", "/s", "/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
}

function openApp(executable) {
  const child = spawn(executable, [], { detached: true, stdio: "ignore", windowsHide: false });
  child.unref();
}

function openShortcut(shortcut) {
  // The shortcut comes only from the user's own Start-menu folders. Explorer
  // resolves it without passing user-provided command text to a shell.
  const child = spawn("explorer.exe", [shortcut], { detached: true, stdio: "ignore", windowsHide: false });
  child.unref();
}

function searchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function startMenuFolders() {
  return [
    process.env.ProgramData && path.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs"),
    process.env.APPDATA && path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs"),
  ].filter(Boolean);
}

function findInstalledApp(target) {
  const requested = normalize(target);
  if (requested.length < 2) return null;
  const matches = [];

  function visit(folder, depth = 0) {
    if (depth > 5) return;
    let entries;
    try { entries = readdirSync(folder, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(fullPath, depth + 1);
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".lnk") continue;
      const label = normalize(path.basename(entry.name, ".lnk"));
      const score = label === requested ? 3 : label.startsWith(requested) ? 2 : label.includes(requested) ? 1 : 0;
      if (score) matches.push({ fullPath, label, score });
    }
  }

  for (const folder of startMenuFolders()) visit(folder);
  matches.sort((a, b) => b.score - a.score || a.label.length - b.label.length);
  return matches[0] ?? null;
}

function resolve(command) {
  const raw = command.trim().replace(/^j(?:[.\s]*)a(?:[.\s]*)r(?:[.\s]*)v(?:[.\s]*)i(?:[.\s]*)s[,:!.\s]*/i, "").trim();
  const text = normalize(raw);
  if (!/^(?:open|launch|start|run|play|watch|search(?: for)?|find|go to|visit)\b/.test(text)) return null;

  const youtube = text.match(/^(?:open\s+)?(?:youtube|yt)\s+(?:and\s+)?(?:play|watch|queue|find)\s+(.+)$/);
  if (youtube) {
    const query = youtube[1].trim();
    return {
      kind: "url",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      message: `Opening YouTube results for ${query}.`,
    };
  }

  const search = text.match(/^(?:search(?: for)?|find)\s+(.+)$/);
  if (search) {
    const query = search[1].trim();
    return { kind: "url", url: searchUrl(query), message: `Searching the web for ${query}.` };
  }

  const target = normalize(text.replace(/^(?:open|launch|start|run|go to|visit)\s+/, ""));
  if (APPS[target]) return { kind: "app", executable: APPS[target], message: `Opening ${target}.` };
  if (target === "settings" || target === "windows settings") {
    return { kind: "url", url: "ms-settings:", message: "Opening Windows Settings." };
  }
  const installedApp = findInstalledApp(target);
  if (installedApp) {
    return { kind: "shortcut", shortcut: installedApp.fullPath, message: `Opening ${installedApp.label}.` };
  }
  if (SITES[target]) return { kind: "url", url: SITES[target], message: `Opening ${target}.` };
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(target)) {
    return { kind: "url", url: `https://${target}`, message: `Opening ${target}.` };
  }
  return { kind: "url", url: searchUrl(target || raw), message: `I could not find a local app, so I am searching the web for ${target || raw}.` };
}

function allowOrigin(request, response) {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  // Chrome may send a Private Network Access preflight when the hosted site
  // contacts this loopback-only companion.
  response.setHeader("Access-Control-Allow-Private-Network", "true");
}

http.createServer((request, response) => {
  console.log(`${request.method} ${request.url} from ${request.headers.origin || "direct request"}`);
  allowOrigin(request, response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  if (request.method !== "POST" || request.url !== "/launch") return response.writeHead(404).end();

  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 10_000) request.destroy();
  });
  request.on("end", () => {
    try {
      const { command } = JSON.parse(body);
      if (typeof command !== "string") throw new Error("Command required");
      const action = resolve(command);
      if (!action) return response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ handled: false, message: "Not a launch command." }));
      console.log(`JARVIS request: ${command} -> ${action.message}`);
      if (action.kind === "app") openApp(action.executable);
      else if (action.kind === "shortcut") openShortcut(action.shortcut);
      else openUrl(action.url);
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ handled: true, message: action.message }));
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ handled: false, message: "Invalid launcher request." }));
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`JARVIS local launcher ready on http://127.0.0.1:${PORT}`);
});
