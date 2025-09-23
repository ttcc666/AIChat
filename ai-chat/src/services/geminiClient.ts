import axios, { type AxiosInstance } from 'axios'
import {
  DEFAULT_GEMINI_BASE_URL,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type GeminiConfig,
} from '@/types/llm'
import type { ChatOptions, LLMClient } from './llmClient'

interface GeminiContent {
  role: string
  parts: Array<{ text: string }>
}

export class GeminiClient implements LLMClient {
  private readonly http: AxiosInstance
  private readonly config: GeminiConfig

  constructor(config: GeminiConfig) {
    this.config = config
    this.http = axios.create({
      baseURL: config.baseUrl ?? DEFAULT_GEMINI_BASE_URL,
      params: {
        key: config.apiKey,
      },
    })
  }

  async sendChat(request: ChatRequest, options?: ChatOptions): Promise<ChatResponse> {
    const systemInstruction = request.messages.find((message) => message.role === 'system')
    const conversationMessages = request.messages.filter((message) => message.role !== 'system')

    const body: Record<string, unknown> = {
      contents: conversationMessages.map((message) => this.transformMessage(message)),
    }

    const generationConfig: Record<string, number> = {}

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature
    }

    if (request.maxOutputTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxOutputTokens
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig
    }

    if (systemInstruction) {
      body.systemInstruction = this.transformMessage(systemInstruction)
    }

    const response = await this.http.post(`/models/${this.config.model}:generateContent`, body, {
      signal: options?.signal,
    })
    const candidate = response.data?.candidates?.[0]
    const partText: string | undefined = candidate?.content?.parts?.[0]?.text

    return {
      content: partText ?? '',
      finishReason: candidate?.finishReason ?? candidate?.finish_reason,
      raw: response.data,
    }
  }

  private transformMessage(message: ChatMessage): GeminiContent {
    const role = message.role === 'assistant' ? 'model' : message.role
    return {
      role,
      parts: [{ text: message.content }],
    }
  }
}
