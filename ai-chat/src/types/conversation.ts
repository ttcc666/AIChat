import type { ChatMessage } from './llm'

export interface ConversationMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  provider: string
}

export interface Conversation extends ConversationMeta {
  messages: ChatMessage[]
}

export interface ConversationRepository {
  list(): Promise<Conversation[]>
  saveAll(conversations: Conversation[]): Promise<void>
  clear(): Promise<void>
}

export type ConversationSummary = Pick<Conversation, 'id' | 'title' | 'updatedAt' | 'provider'>
