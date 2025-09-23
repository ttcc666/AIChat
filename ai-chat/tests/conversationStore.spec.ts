import { describe, beforeEach, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConversationStore } from '@/stores/conversationStore'
import type { Conversation } from '@/types/conversation'

vi.mock('@/repositories/localConversationRepository', () => {
  class MemoryRepository {
    private conversations: Conversation[] = []

    async list(): Promise<Conversation[]> {
      return this.conversations
    }

    async saveAll(conversations: Conversation[]): Promise<void> {
      this.conversations = [...conversations]
    }

    async clear(): Promise<void> {
      this.conversations = []
    }
  }

  return {
    LocalConversationRepository: MemoryRepository,
  }
})

describe('conversationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with a default conversation', async () => {
    const store = useConversationStore()
    await store.load('openai')
    expect(store.conversations).toHaveLength(1)
    expect(store.activeConversation?.provider).toBe('openai')
  })

  it('creates and selects conversations per provider', async () => {
    const store = useConversationStore()
    await store.load('openai')

    const created = await store.createConversation('gemini', '测试对话')
    expect(store.conversations[0].id).toBe(created?.id)
    expect(store.activeConversation?.provider).toBe('gemini')

    await store.renameConversation(created!.id, '重命名对话')
    expect(store.conversations[0].title).toBe('重命名对话')

    await store.removeConversation(created!.id)
    expect(store.conversations.some((item) => item.id === created!.id)).toBe(false)
  })

  it('imports conversations and sets active id', async () => {
    const store = useConversationStore()
    await store.load('openai')

    const payload: Conversation[] = [
      {
        id: 'c-1',
        title: '历史对话',
        provider: 'openai',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        messages: [],
      },
    ]

    await store.importConversations(JSON.stringify(payload))
    expect(store.conversations).toHaveLength(1)
    expect(store.activeConversation?.id).toBe('c-1')
  })
})
