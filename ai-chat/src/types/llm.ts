export type ProviderType = "openai" | "gemini"

export type ChatRole = "system" | "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  temperature?: number
  maxOutputTokens?: number
}

export interface ChatResponse {
  content: string
  finishReason?: string
  raw?: unknown
}

interface BaseProviderConfig {
  apiKey: string
  baseUrl?: string
  model: string
}

export interface OpenAIConfig extends BaseProviderConfig {
  provider: "openai"
  organizationId?: string
}

export interface GeminiConfig extends BaseProviderConfig {
  provider: "gemini"
}

export type ProviderConfig = OpenAIConfig | GeminiConfig

export interface ProviderSettings {
  openai: OpenAIConfig
  gemini: GeminiConfig
}

export interface ModelOption {
  label: string
  value: string
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
