import axios, { type AxiosInstance } from 'axios'
import {
  DEFAULT_GEMINI_BASE_URL,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type GeminiConfig,
} from '@/types/llm'
import type { ChatOptions, LLMClient } from './llmClient'
import { consumeEventStream } from '@/utils/eventStream'

interface GeminiPart {
  text?: string
  thought?: boolean
}

interface GeminiContent {
  role: string
  parts: GeminiPart[]
}

export class GeminiClient implements LLMClient {
  private readonly http: AxiosInstance
  private readonly config: GeminiConfig

  constructor(config: GeminiConfig) {
    this.config = config
    this.http = axios.create({
      baseURL: (config.baseUrl ?? DEFAULT_GEMINI_BASE_URL).replace(/\/$/, ''),
      headers: {
        'x-goog-api-key': config.apiKey,
      },
    })
  }

  async sendChat(request: ChatRequest, options?: ChatOptions): Promise<ChatResponse> {
    if (options?.stream) {
      return this.sendChatStream(request, options)
    }

    const response = await this.http.post(
      this.modelPath('generateContent'),
      this.createRequestBody(request),
      {
        signal: options?.signal,
      },
    )

    const candidate = isRecord(response.data?.candidates?.[0])
      ? (response.data.candidates[0] as Record<string, unknown>)
      : null
    const partsRaw = candidate?.content && isRecord(candidate.content)
      ? (candidate.content as Record<string, unknown>).parts
      : undefined
    const { content, reasoning } = splitGeminiParts(partsRaw)

    return {
      content,
      finishReason: (candidate?.finishReason ?? candidate?.finish_reason) as string | undefined,
      reasoning: reasoning.length > 0 ? reasoning : undefined,
      raw: response.data,
    }
  }

  private async sendChatStream(request: ChatRequest, options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(this.streamUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      signal: options.signal,
      body: JSON.stringify(this.createRequestBody(request)),
    })

    if (!response.ok) {
      const errorText = await safeReadText(response)
      throw new Error(errorText || 'Gemini stream request failed')
    }

    let finishReason: string | undefined
    const reasoningSegments: string[] = []
    let aggregatedContent = ''

    await consumeEventStream(response, async (payload) => {
      if (payload === '[DONE]') {
        return false
      }

      const parsed = parseJSON(payload)
      if (!isRecord(parsed)) {
        return true
      }

      const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : []
      const candidate = candidates.length > 0 && isRecord(candidates[0])
        ? (candidates[0] as Record<string, unknown>)
        : null
      if (!candidate) {
        return true
      }

      const content = candidate.content && isRecord(candidate.content)
        ? (candidate.content as Record<string, unknown>)
        : null
      const partsRaw = content?.parts
      const parts = parseGeminiParts(partsRaw)

      for (const part of parts) {
        const text = part.text ?? ''
        if (!text) {
          continue
        }
        if (part.thought === true) {
          reasoningSegments.push(text)
          await options.onChunk?.({ type: 'thought', text })
        } else {
          aggregatedContent += text
          await options.onChunk?.({ type: 'content', text })
        }
      }

      const finish = candidate.finishReason ?? candidate.finish_reason
      if (typeof finish === 'string') {
        finishReason = finish
      }

      return true
    })

    return {
      content: aggregatedContent,
      finishReason,
      reasoning: reasoningSegments.length > 0 ? reasoningSegments : undefined,
    }
  }

  private modelPath(action: 'generateContent' | 'streamGenerateContent'): string {
    return `/models/${encodeURIComponent(this.config.model)}:${action}`
  }

  private streamUrl(): string {
    const base = (this.config.baseUrl ?? DEFAULT_GEMINI_BASE_URL).replace(/\/$/, '')
    return `${base}${this.modelPath('streamGenerateContent')}?alt=sse`
  }

  private createRequestBody(request: ChatRequest): Record<string, unknown> {
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

    return body
  }

  private transformMessage(message: ChatMessage): GeminiContent {
    const role = message.role === 'assistant' ? 'model' : message.role
    return {
      role,
      parts: [{ text: message.content }],
    }
  }
}

function splitGeminiParts(partsRaw: unknown): { content: string; reasoning: string[] } {
  const parts = parseGeminiParts(partsRaw)
  let content = ''
  const reasoning: string[] = []

  for (const part of parts) {
    const text = part.text ?? ''
    if (!text) {
      continue
    }
    if (part.thought === true) {
      reasoning.push(text)
    } else {
      content += text
    }
  }

  return { content, reasoning }
}

function parseGeminiParts(partsRaw: unknown): GeminiPart[] {
  if (!Array.isArray(partsRaw)) {
    return []
  }

  return partsRaw
    .map((item) =>
      isRecord(item)
        ? ({
            text: typeof item.text === 'string' ? item.text : undefined,
            thought: item.thought === true,
          } satisfies GeminiPart)
        : null,
    )
    .filter((item): item is GeminiPart => item !== null)
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn('Failed to parse Gemini stream chunk', error)
    return null
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch (error) {
    console.warn('Failed to read response body', error)
    return ''
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
