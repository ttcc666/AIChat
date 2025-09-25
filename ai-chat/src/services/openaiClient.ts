import axios, { type AxiosInstance } from 'axios'
import {
  DEFAULT_OPENAI_BASE_URL,
  type ChatRequest,
  type ChatResponse,
  type OpenAIConfig,
} from '@/types/llm'
import type { ChatOptions, LLMClient } from './llmClient'
import { consumeEventStream } from '@/utils/eventStream'

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
    if (options?.stream) {
      return this.sendChatStream(request, options)
    }

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

  private async sendChatStream(request: ChatRequest, options: ChatOptions): Promise<ChatResponse> {
    const baseURL = (this.http.defaults.baseURL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '')
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.config.organizationId ? { 'OpenAI-Organization': this.config.organizationId } : {}),
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await safeReadText(response)
      throw new Error(errorText || 'OpenAI stream request failed')
    }

    let finishReason: string | undefined
    let aggregatedContent = ''
    const reasoningSegments: string[] = []

    await consumeEventStream(response, async (payload) => {
      if (payload === '[DONE]') {
        return false
      }

      const parsed = parseJSON(payload)
      if (!isRecord(parsed)) {
        return true
      }

      const choices = Array.isArray(parsed.choices) ? parsed.choices : []
      const choice = choices.length > 0 && isRecord(choices[0]) ? (choices[0] as Record<string, unknown>) : null
      if (!choice) {
        return true
      }

      const deltaRecord = isRecord(choice.delta) ? (choice.delta as Record<string, unknown>) : {}
      const contentDelta = extractContentDelta(deltaRecord)
      if (contentDelta) {
        aggregatedContent += contentDelta
        await options.onChunk?.({ type: 'content', text: contentDelta })
      }

      const thoughtSegments = extractThoughtSegments(deltaRecord)
      for (const segment of thoughtSegments) {
        reasoningSegments.push(segment)
        await options.onChunk?.({ type: 'thought', text: segment })
      }

      const finish = choice.finish_reason ?? choice.finishReason
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
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn('Failed to parse OpenAI stream chunk', error)
    return null
  }
}

function extractContentDelta(delta: Record<string, unknown>): string {
  const content = delta.content
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (isRecord(item) && typeof item.text === 'string' ? item.text : ''))
      .join('')
  }

  return ''
}

function extractThoughtSegments(delta: Record<string, unknown>): string[] {
  const segments: string[] = []
  const reasoningContent = delta.reasoning_content
  if (Array.isArray(reasoningContent)) {
    for (const item of reasoningContent) {
      if (isRecord(item) && typeof item.text === 'string') {
        segments.push(item.text)
      }
    }
  }

  const reasoning = isRecord(delta.reasoning) ? (delta.reasoning as Record<string, unknown>) : null
  if (reasoning && Array.isArray(reasoning.content)) {
    for (const item of reasoning.content) {
      if (isRecord(item) && typeof item.text === 'string') {
        segments.push(item.text)
      }
    }
  }

  return segments
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
