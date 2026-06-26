import { createFileRoute } from "@tanstack/react-router";
import { JarvisApp } from "@/components/jarvis/JarvisApp";

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
  return <JarvisApp />;
}
