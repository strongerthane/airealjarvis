export type LocalLaunchResult = {
  handled: boolean;
  message: string;
};

const LAUNCHER_URL = "http://127.0.0.1:27183/launch";
const COMMAND_PREFIX = /^(?:open|launch|start|run|play|watch|search(?:\s+for)?|find|go\s+to|visit)\b/i;

function withoutWakeWord(text: string) {
  return text.trim().replace(/^j(?:[.\s]*)a(?:[.\s]*)r(?:[.\s]*)v(?:[.\s]*)i(?:[.\s]*)s[,:!.\s]*/i, "").trim();
}

export function isLaunchCommand(text: string) {
  return COMMAND_PREFIX.test(withoutWakeWord(text));
}

export async function runLocalLauncher(command: string): Promise<LocalLaunchResult | null> {
  if (!isLaunchCommand(command)) return null;

  const controller = new AbortController();
  // The local helper can take a moment on its first request while indexing the
  // Windows Start-menu shortcuts.
  const timeout = window.setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(LAUNCHER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const result = (await response.json()) as LocalLaunchResult;
    return result.handled ? result : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
