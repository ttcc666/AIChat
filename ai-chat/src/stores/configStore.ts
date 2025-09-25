import { computed, ref } from "vue"
import { defineStore } from "pinia"
import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  type GeminiConfig,
  type OpenAIConfig,
  type ProviderConfig,
  type ProviderType,
} from "@/types/llm"

const STORAGE_KEY = "ai-chat::provider-config"

interface PersistedState {
  activeProvider: ProviderType
  providerConfigs: Record<ProviderType, ProviderConfig>
  streamingEnabled?: boolean
}

function createDefaultOpenAIConfig(): OpenAIConfig {
  return {
    provider: "openai",
    apiKey: "",
    baseUrl: DEFAULT_OPENAI_BASE_URL,
    model: "gpt-4o-mini",
  }
}

function createDefaultGeminiConfig(): GeminiConfig {
  return {
    provider: "gemini",
    apiKey: "",
    baseUrl: DEFAULT_GEMINI_BASE_URL,
    model: "gemini-1.5-flash",
  }
}

export const useConfigStore = defineStore("config", () => {
  const activeProvider = ref<ProviderType>("openai")
  const providerConfigs = ref<Record<ProviderType, ProviderConfig>>({
    openai: createDefaultOpenAIConfig(),
    gemini: createDefaultGeminiConfig(),
  })
  const streamingEnabled = ref(false)
  const initialized = ref(false)

  const currentConfig = computed(() => providerConfigs.value[activeProvider.value])

  function initialize() {
    if (initialized.value) {
      return
    }

    if (typeof window === "undefined") {
      initialized.value = true
      return
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState
        activeProvider.value = parsed.activeProvider
        streamingEnabled.value = Boolean(parsed.streamingEnabled)
        providerConfigs.value = {
          openai: { ...createDefaultOpenAIConfig(), ...parsed.providerConfigs.openai },
          gemini: { ...createDefaultGeminiConfig(), ...parsed.providerConfigs.gemini },
        }
      }
    } catch (error) {
      console.warn("Failed to restore provider config from storage", error)
    } finally {
      initialized.value = true
    }
  }

  function setActiveProvider(provider: ProviderType) {
    activeProvider.value = provider
    persist()
  }

  function updateProviderConfig<T extends ProviderType>(provider: T, config: Partial<Extract<ProviderConfig, { provider: T }>>) {
    const merged = {
      ...providerConfigs.value[provider],
      ...config,
      provider,
    } as ProviderConfig

    providerConfigs.value[provider] = merged
    persist()
  }

  function setStreamingEnabled(value: boolean) {
    streamingEnabled.value = value
    persist()
  }

  function persist() {
    if (typeof window === "undefined") {
      return
    }

    const payload: PersistedState = {
      activeProvider: activeProvider.value,
      providerConfigs: providerConfigs.value,
      streamingEnabled: streamingEnabled.value,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  return {
    activeProvider,
    providerConfigs,
    currentConfig,
    streamingEnabled,
    initialize,
    setActiveProvider,
    updateProviderConfig,
    setStreamingEnabled,
  }
})
