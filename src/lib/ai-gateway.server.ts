import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createNvidiaProvider(nvidiaApiKey: string) {
  return createOpenAICompatible({
    name: "nvidia",
    baseURL: "https://integrate.api.nvidia.com/v1",
    headers: {
      Authorization: `Bearer ${nvidiaApiKey}`,
    },
  });
}