import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GeminiClient } from '@/services/geminiClient'
import type { ChatRequest } from '@/types/llm'

const { postMock } = vi.hoisted(() => {
  const post = vi.fn()
  return { postMock: post }
})

vi.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ post: postMock }),
  },
}))

describe('GeminiClient', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('separates reasoning parts from final response', async () => {
    postMock.mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'internal chain' },
                { text: 'final answer' },
              ],
            },
            finishReason: 'stop',
          },
        ],
      },
    })

    const client = new GeminiClient({
      provider: 'gemini',
      apiKey: 'test',
      model: 'demo-model',
      baseUrl: 'https://example.com',
    })

    const request: ChatRequest = {
      messages: [
        { role: 'user', content: 'hello' },
      ],
    }

    const response = await client.sendChat(request)

    expect(postMock).toHaveBeenCalledWith(
      '/models/demo-model:generateContent',
      expect.objectContaining({
        contents: expect.any(Array),
      }),
      expect.objectContaining({ signal: undefined }),
    )
    expect(response.content).toBe('final answer')
    expect(response.reasoning).toEqual(['internal chain'])
  })
})
