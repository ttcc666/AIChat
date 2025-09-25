import type { ChatRequest, ChatResponse, ProviderConfig } from '@/types/llm'

export interface ChatChunk {
  type: 'content' | 'thought'
  text: string
}

export interface ChatOptions {
  signal?: AbortSignal
  stream?: boolean
  onChunk?: (chunk: ChatChunk) => void | Promise<void>
}

export interface LLMClient {
  sendChat(request: ChatRequest, options?: ChatOptions): Promise<ChatResponse>
}

export type LLMClientFactory = (config: ProviderConfig) => LLMClient
