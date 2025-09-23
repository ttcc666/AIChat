import type { ChatRequest, ChatResponse, ProviderConfig } from '@/types/llm'
import { createLLMClient } from './llmFactory'
import type { ChatOptions } from './llmClient'

export async function executeChat(
  request: ChatRequest,
  config: ProviderConfig,
  options?: ChatOptions,
): Promise<ChatResponse> {
  const client = createLLMClient(config)
  return client.sendChat(request, options)
}
