import axios from "axios"
import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  type GeminiConfig,
  type ModelOption,
  type OpenAIConfig,
  type ProviderConfig,
} from "@/types/llm"

function deduplicateOptions(options: ModelOption[]): ModelOption[] {
  const seen = new Set<string>()
  const result: ModelOption[] = []

  for (const option of options) {
    if (option.value && !seen.has(option.value)) {
      seen.add(option.value)
      result.push(option)
    }
  }

  return result
}

async function fetchOpenAIModelOptions(config: OpenAIConfig): Promise<ModelOption[]> {
  const baseURL = config.baseUrl ?? DEFAULT_OPENAI_BASE_URL
  const response = await axios.get<{ data?: Array<{ id?: string }> }>(`${baseURL.replace(/\/$/, "")}/models`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.organizationId ? { "OpenAI-Organization": config.organizationId } : {}),
    },
  })

  const models = response.data?.data ?? []
  const options = models
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .map<ModelOption>((id) => ({ label: id, value: id }))

  return deduplicateOptions(options)
}

async function fetchGeminiModelOptions(config: GeminiConfig): Promise<ModelOption[]> {
  const baseURL = config.baseUrl ?? DEFAULT_GEMINI_BASE_URL
  const response = await axios.get<{ models?: Array<{ name?: string; displayName?: string }> }>(
    `${baseURL.replace(/\/$/, "")}/models`,
    {
      params: {
        key: config.apiKey,
      },
    },
  )

  const models = response.data?.models ?? []
  const options = models
    .map((model) => {
      const fullName = model.name ?? ""
      const value = fullName.split("/").pop() || fullName
      const label = model.displayName ?? value
      return value ? { label, value } : null
    })
    .filter((item): item is ModelOption => item !== null)

  return deduplicateOptions(options)
}

export async function fetchProviderModelOptions(config: ProviderConfig): Promise<ModelOption[]> {
  if (!config.apiKey) {
    return []
  }

  if (config.provider === "openai") {
    return fetchOpenAIModelOptions(config)
  }

  if (config.provider === "gemini") {
    return fetchGeminiModelOptions(config)
  }

  const exhaustiveCheck: never = config
  throw new Error(`Unsupported provider for model fetch: ${exhaustiveCheck}`)
}
