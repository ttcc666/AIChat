import type { ChatRequest, ChatResponse, ProviderConfig } from '@/types/llm'

export interface ChatOptions {
  signal?: AbortSignal
}

export interface LLMClient {
  sendChat(request: ChatRequest, options?: ChatOptions): Promise<ChatResponse>
}

export type LLMClientFactory = (config: ProviderConfig) => LLMClient
