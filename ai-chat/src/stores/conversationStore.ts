import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { ChatMessage } from '@/types/llm'
import type {
  Conversation,
  ConversationMeta,
  ConversationRepository,
} from '@/types/conversation'
import { LocalConversationRepository } from '@/repositories/localConversationRepository'

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `conv_${Math.random().toString(36).slice(2, 11)}`
}

function createEmptyConversation(provider: string, title = 'New Chat'): Conversation {
  const timestamp = Date.now()
  return {
    id: generateId(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    provider,
    messages: [],
  }
}

function normalizeMessagesPayload(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return []
  }
  const allowedRoles = new Set<ChatMessage['role']>(['system', 'user', 'assistant'])
  return messages
    .filter((item): item is Partial<ChatMessage> => typeof item === 'object' && item !== null)
    .map((item) => {
      const candidateRole = typeof item.role === 'string' ? item.role : 'assistant'
      const role = allowedRoles.has(candidateRole as ChatMessage['role'])
        ? (candidateRole as ChatMessage['role'])
        : 'assistant'
      const content = typeof item.content === 'string' ? item.content : ''
      const normalized: ChatMessage = {
        role,
        content,
      }
      if (item.isThought === true) {
        normalized.isThought = true
      }
      return normalized
    })
}
export const useConversationStore = defineStore('conversation', () => {
  const repository: ConversationRepository = new LocalConversationRepository()

  const conversations = ref<Conversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const loading = ref(false)

  const activeConversation = computed(() => {
    if (!activeConversationId.value) {
      return null
    }
    return conversations.value.find((item) => item.id === activeConversationId.value) ?? null
  })

  function sortConversationsByUpdatedAt(list: Conversation[]): Conversation[] {
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function load(defaultProvider: string) {
    loading.value = true
    try {
      const records = await repository.list()
      conversations.value = records.length > 0 ? sortConversationsByUpdatedAt(records) : []

      if (conversations.value.length === 0) {
        const conversation = createEmptyConversation(defaultProvider)
        conversations.value = [conversation]
        activeConversationId.value = conversation.id
        await persist()
        return
      }

      if (!activeConversationId.value || !conversations.value.some((item) => item.id === activeConversationId.value)) {
        const first = conversations.value[0]
        if (first) {
          activeConversationId.value = first.id
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function selectConversation(id: string) {
    if (activeConversationId.value === id) {
      return
    }
    if (!conversations.value.some((item) => item.id === id)) {
      return
    }
    activeConversationId.value = id
  }

  async function createConversation(provider: string, title?: string) {
    const conversation = createEmptyConversation(provider, title)
    conversations.value = sortConversationsByUpdatedAt([conversation, ...conversations.value])
    activeConversationId.value = conversation.id
    await persist()
    return conversation
  }

  async function renameConversation(id: string, title: string) {
    const target = conversations.value.find((item) => item.id === id)
    if (!target) {
      return
    }
    target.title = title.trim() || 'Untitled conversation'
    target.updatedAt = Date.now()
    conversations.value = sortConversationsByUpdatedAt(conversations.value)
    await persist()
  }

  async function removeConversation(id: string) {
    conversations.value = conversations.value.filter((item) => item.id !== id)
    if (activeConversationId.value === id) {
      activeConversationId.value = conversations.value[0]?.id ?? null
    }
    await persist()
  }

  async function appendMessage(conversationId: string, message: ChatMessage) {
    const target = conversations.value.find((item) => item.id === conversationId)
    if (!target) {
      return
    }
    target.messages = [...target.messages, message]
    target.updatedAt = Date.now()
    conversations.value = sortConversationsByUpdatedAt(conversations.value)
    await persist()
  }

  async function replaceMessages(conversationId: string, messages: ChatMessage[]) {
    const target = conversations.value.find((item) => item.id === conversationId)
    if (!target) {
      return
    }
    target.messages = [...messages]
    target.updatedAt = Date.now()
    conversations.value = sortConversationsByUpdatedAt(conversations.value)
    await persist()
  }

  async function updateConversationProvider(conversationId: string, provider: string) {
    const target = conversations.value.find((item) => item.id === conversationId)
    if (!target) {
      return
    }
    if (target.provider === provider) {
      return
    }
    target.provider = provider
    target.updatedAt = Date.now()
    conversations.value = sortConversationsByUpdatedAt(conversations.value)
    await persist()
  }

  async function clearAll() {
    conversations.value = []
    activeConversationId.value = null
    await repository.clear()
  }

  function snapshotConversations(): Conversation[] {
    return toRaw(conversations.value).map((conversation) => {
      const rawConversation = toRaw(conversation)
      return {
        ...rawConversation,
        messages: toRaw(rawConversation.messages).map((message) => ({ ...message })),
      }
    })
  }

  async function persist() {
    await repository.saveAll(snapshotConversations())
  }

  function exportConversations(): string {
    return JSON.stringify(conversations.value, null, 2)
  }

  async function importConversations(json: string) {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid conversation payload')
    }
    const normalized = (parsed as Conversation[]).map((item) => ({
      ...item,
      id: item.id ?? generateId(),
      title: item.title?.trim() || 'Untitled conversation',
      messages: normalizeMessagesPayload(item.messages),
    }))
    conversations.value = sortConversationsByUpdatedAt(normalized)
    activeConversationId.value = conversations.value[0]?.id ?? null
    await persist()
  }

  function getConversationMeta(): ConversationMeta[] {
    return conversations.value.map(({ id, title, createdAt, updatedAt, provider }) => ({
      id,
      title,
      createdAt,
      updatedAt,
      provider,
    }))
  }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    loading,
    load,
    selectConversation,
    createConversation,
    renameConversation,
    removeConversation,
    appendMessage,
    replaceMessages,
    updateConversationProvider,
    clearAll,
    exportConversations,
    importConversations,
    getConversationMeta,
  }
})
