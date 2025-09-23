import type { ProviderConfig } from "@/types/llm"
import type { LLMClient } from "./llmClient"
import { OpenAIClient } from "./openaiClient"
import { GeminiClient } from "./geminiClient"

export function createLLMClient(config: ProviderConfig): LLMClient {
  if (config.provider === "openai") {
    return new OpenAIClient(config)
  }

  if (config.provider === "gemini") {
    return new GeminiClient(config)
  }

  const exhaustiveCheck: never = config
  throw new Error(`Unsupported provider: ${exhaustiveCheck}`)
}
