import { describe, expect, it } from 'vitest'
import { createLLMClient } from '@/services/llmFactory'
import { OpenAIClient } from '@/services/openaiClient'
import { GeminiClient } from '@/services/geminiClient'

const baseConfig = {
  apiKey: 'test-key',
  model: 'demo-model',
}

describe('createLLMClient', () => {
  it('returns OpenAI client when provider is openai', () => {
    const client = createLLMClient({
      provider: 'openai',
      ...baseConfig,
    })
    expect(client).toBeInstanceOf(OpenAIClient)
  })

  it('returns Gemini client when provider is gemini', () => {
    const client = createLLMClient({
      provider: 'gemini',
      ...baseConfig,
    })
    expect(client).toBeInstanceOf(GeminiClient)
  })

  it('throws for unsupported provider', () => {
    expect(() =>
      // @ts-expect-error intentionally pass invalid provider
      createLLMClient({ provider: 'unknown', ...baseConfig }),
    ).toThrowError('Unsupported provider')
  })
})
