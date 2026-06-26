// In-memory pub/sub for n8n webhook -> browser bridge.
// Single-instance dev is fine; messages live only while the server process lives.

export type InboxMessage = {
  id: string;
  text: string;
  receivedAt: number;
};

type Subscriber = (msg: InboxMessage) => void;

const g = globalThis as unknown as { __jarvisInbox?: { subs: Set<Subscriber> } };
if (!g.__jarvisInbox) g.__jarvisInbox = { subs: new Set() };
const state = g.__jarvisInbox;

export function publishInbox(text: string): InboxMessage {
  const msg: InboxMessage = {
    id: crypto.randomUUID(),
    text,
    receivedAt: Date.now(),
  };
  for (const sub of state.subs) {
    try {
      sub(msg);
    } catch {}
  }
  return msg;
}

export function subscribeInbox(sub: Subscriber): () => void {
  state.subs.add(sub);
  return () => {
    state.subs.delete(sub);
  };
}