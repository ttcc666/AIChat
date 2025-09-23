import axios, { type AxiosInstance } from 'axios'
import { DEFAULT_OPENAI_BASE_URL, type ChatRequest, type ChatResponse, type OpenAIConfig } from '@/types/llm'
import type { ChatOptions, LLMClient } from './llmClient'

export class OpenAIClient implements LLMClient {
  private readonly http: AxiosInstance
  private readonly config: OpenAIConfig

  constructor(config: OpenAIConfig) {
    this.config = config
    this.http = axios.create({
      baseURL: config.baseUrl ?? DEFAULT_OPENAI_BASE_URL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.organizationId ? { 'OpenAI-Organization': config.organizationId } : {}),
      },
    })
  }

  async sendChat(request: ChatRequest, options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.http.post(
      '/chat/completions',
      {
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
      },
      {
        signal: options?.signal,
      },
    )

    const firstChoice = response.data?.choices?.[0]
    const content: string = firstChoice?.message?.content ?? ''

    return {
      content,
      finishReason: firstChoice?.finish_reason,
      raw: response.data,
    }
  }
}
