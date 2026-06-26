import { createFileRoute } from "@tanstack/react-router";
import { JarvisApp } from "@/components/jarvis/JarvisApp";
import { AccessGate } from "@/components/jarvis/AccessGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S — AI Assistant" },
      { name: "description", content: "A dark, sleek voice-enabled AI assistant inspired by Tony Stark's JARVIS." },
      { property: "og:title", content: "J.A.R.V.I.S — AI Assistant" },
      { property: "og:description", content: "A dark, sleek voice-enabled AI assistant inspired by Tony Stark's JARVIS." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AccessGate>
      <JarvisApp />
    </AccessGate>
  );
}
