import localforage from 'localforage'
import type { Conversation, ConversationRepository } from '@/types/conversation'

const STORE_KEY = 'ai-chat::conversations'

localforage.config({
  name: 'ai-chat',
  storeName: 'conversations',
})

export class LocalConversationRepository implements ConversationRepository {
  async list(): Promise<Conversation[]> {
    const records = await localforage.getItem<Conversation[]>(STORE_KEY)
    return records ?? []
  }

  async saveAll(conversations: Conversation[]): Promise<void> {
    await localforage.setItem(STORE_KEY, conversations)
  }

  async clear(): Promise<void> {
    await localforage.removeItem(STORE_KEY)
  }
}
