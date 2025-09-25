<template>
  <div class="chat-wrapper">
    <div class="chat-container">
      <section class="chat-main">
        <div class="message-list scroll-area" ref="messageListRef">
          <template v-if="conversation.length">
            <MessageBubble v-for="(message, index) in conversation" :key="index" :message="message" />
          </template>
          <a-empty v-else description="立即开始新的对话" />
        </div>
      </section>

      <a-card class="chat-input-card">
        <div class="input-controls">
          <a-space align="center" size="middle">
            <span class="control-label">模型</span>
            <a-segmented
              v-model:value="localProvider"
              :options="providerOptions"
              @change="handleProviderChange"
            />
          </a-space>
          <a-space align="center" size="small">
            <span class="control-label">流式输出</span>
            <a-switch :checked="streamingEnabled" @change="handleStreamingToggle" />
          </a-space>
        </div>
        <a-form layout="vertical" @submit.prevent>
          <a-form-item label="提示词">
            <a-textarea
              ref="textareaRef"
              v-model:value="userInput"
              :auto-size="{ minRows: 2, maxRows: 6 }"
              placeholder="请输入问题，使用 Shift + Enter 换行"
              @keydown.enter.exact.prevent="handleSubmit"
              @keydown="handleKeydown"
            />
          </a-form-item>

          <div class="input-footer">
            <a-space align="center" size="small" class="input-actions">
              <a-spin v-if="loading" size="small" />
              <a-button v-if="loading" danger @click="cancelGeneration">停止</a-button>
              <a-button @click="clearConversation">清空对话</a-button>
              <a-button @click="clearInput">清空输入</a-button>
              <a-button type="primary" :loading="loading" @click="handleSubmit">发送</a-button>
            </a-space>
          </div>
        </a-form>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { message as antdMessage } from 'ant-design-vue'
import { useConfigStore } from '@/stores/configStore'
import { useConversationStore } from '@/stores/conversationStore'
import type { ChatMessage, ChatRequest, ProviderType } from '@/types/llm'
import MessageBubble from '@/components/MessageBubble.vue'
import { executeChat } from '@/services/chatGateway'
import type { ChatChunk } from '@/services/llmClient'

type DivElement = globalThis.HTMLDivElement

interface TextAreaHandle {
  focus: () => void
}

const configStore = useConfigStore()
const conversationStore = useConversationStore()
const { streamingEnabled, activeProvider } = storeToRefs(configStore)
const localProvider = ref(activeProvider.value)
const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
] as const
const { activeConversation, activeConversationId } = storeToRefs(conversationStore)




const systemPrompt = ref('You are a helpful AI assistant.')
const userInput = ref('')
const loading = ref(false)
const messageListRef = ref<DivElement | null>(null)
const textareaRef = ref<TextAreaHandle | null>(null)
const abortController = ref<AbortController | null>(null)

const conversation = computed(() => activeConversation.value?.messages ?? [])
const currentConfig = computed(() => configStore.currentConfig)
const hasApiKey = computed(() => Boolean(currentConfig.value.apiKey))

watch(
  () => activeProvider.value,
  (provider) => {
    localProvider.value = provider
    const active = activeConversation.value
    if (!active) {
      return
    }
    void conversationStore.updateConversationProvider(active.id, provider)
  },
)

watch(
  () => activeConversationId.value,
  () => {
    scrollToBottom()
  },
)

watch(
  () => conversation.value.length,
  () => {
    scrollToBottom()
  },
)

async function handleSubmit() {
  const content = userInput.value.trim()
  const active = activeConversation.value
  if (!content || !active) {
    return
  }

  if (!hasApiKey.value) {
    antdMessage.warning('请先前往设置页配置 API 密钥。')
    return
  }

  abortController.value?.abort()
  const controller = new AbortController()
  abortController.value = controller

  const conversationId = active.id

  const historyMessages = active.messages.filter((message) => !message.isThought)
  const messages: ChatMessage[] = [
    ...(systemPrompt.value ? [{ role: 'system' as const, content: systemPrompt.value }] : []),
    ...historyMessages,
    { role: 'user', content },
  ]

  const request: ChatRequest = {
    messages,
  }

  await conversationStore.appendMessage(conversationId, { role: 'user', content })
  userInput.value = ''
  loading.value = true

  const useStreaming = streamingEnabled.value
  const streamState = {
    assistantIndex: -1,
    thoughtIndex: -1,
  }

  const applyStreamChunk = async (chunk: ChatChunk) => {
    if (!chunk.text) {
      return
    }
    const current = activeConversation.value
    if (!current || current.id !== conversationId) {
      return
    }

    const nextMessages = [...current.messages]
    if (chunk.type === 'thought') {
      if (streamState.thoughtIndex === -1) {
        nextMessages.push({ role: 'assistant', content: chunk.text, isThought: true })
        streamState.thoughtIndex = nextMessages.length - 1
      } else {
        const existing = nextMessages[streamState.thoughtIndex]
        nextMessages[streamState.thoughtIndex] = {
          ...existing,
          content: (existing.content ?? '') + chunk.text,
        }
      }
    } else {
      if (streamState.assistantIndex === -1) {
        nextMessages.push({ role: 'assistant', content: chunk.text })
        streamState.assistantIndex = nextMessages.length - 1
      } else {
        const existing = nextMessages[streamState.assistantIndex]
        nextMessages[streamState.assistantIndex] = {
          ...existing,
          content: (existing.content ?? '') + chunk.text,
        }
      }
    }

    await conversationStore.replaceMessages(conversationId, nextMessages)
    scrollToBottom()
  }

  const ensureFinalMessages = async (responseContent: string, responseReasoning?: string[]) => {
    const current = activeConversation.value
    if (!current || current.id !== conversationId) {
      return
    }

    const nextMessages = [...current.messages]

    if (responseContent) {
      if (streamState.assistantIndex === -1) {
        nextMessages.push({ role: 'assistant', content: responseContent })
      } else {
        const existing = nextMessages[streamState.assistantIndex]
        if (existing?.content !== responseContent) {
          nextMessages[streamState.assistantIndex] = {
            ...existing,
            content: responseContent,
          }
        }
      }
    }

    if (responseReasoning && responseReasoning.length > 0) {
      const combinedReasoning = responseReasoning.join('\n\n')
      if (streamState.thoughtIndex === -1) {
        nextMessages.push({ role: 'assistant', content: combinedReasoning, isThought: true })
      } else {
        const existing = nextMessages[streamState.thoughtIndex]
        if (existing?.content !== combinedReasoning) {
          nextMessages[streamState.thoughtIndex] = {
            ...existing,
            content: combinedReasoning,
            isThought: true,
          }
        }
      }
    }

    await conversationStore.replaceMessages(conversationId, nextMessages)
  }

  try {
    const response = await executeChat(request, currentConfig.value, {
      signal: controller.signal,
      stream: useStreaming,
      onChunk: useStreaming ? applyStreamChunk : undefined,
    })

    if (useStreaming) {
      await ensureFinalMessages(response.content, response.reasoning)
    } else {
      await conversationStore.appendMessage(conversationId, {
        role: 'assistant',
        content: response.content,
      })
      if (response.reasoning && response.reasoning.length > 0) {
        const combinedReasoning = response.reasoning.join('\\n\\n')

        await conversationStore.appendMessage(conversationId, {
          role: 'assistant',
          content: combinedReasoning,
          isThought: true,
        })
      }
    }
  } catch (error) {
    if (axios.isCancel?.(error) || (error instanceof DOMException && error.name === 'AbortError')) {
      antdMessage.info('已取消生成')
      return
    }
    console.error(error)
    antdMessage.error('请求失败，请检查配置。')
  } finally {
    if (abortController.value === controller) {
      abortController.value = null
    }
    loading.value = false
  }
}

function cancelGeneration() {
  if (!abortController.value) {
    return
  }
  abortController.value.abort()
  abortController.value = null
  loading.value = false
}

function clearConversation() {
  const active = activeConversation.value
  if (!active) return
  conversationStore.replaceMessages(active.id, [])
}

function clearInput() {
  userInput.value = ''
  focusTextarea()
}

function handleProviderChange(value: string | number) {
  const provider = String(value) as ProviderType
  if (!providerOptions.some((option) => option.value === provider)) {
    return
  }
  if (provider === activeProvider.value) {
    return
  }
  configStore.setActiveProvider(provider)
}

function handleStreamingToggle(value: boolean | string | number) {
  const enabled = value === true || value === 'true' || value === 1
  configStore.setStreamingEnabled(enabled)
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    focusTextarea()
  }
}

function scrollToBottom() {
  nextTick(() => {
    const list = messageListRef.value
    if (!list) {
      return
    }
    const needsInternalScroll = list.scrollHeight - list.clientHeight > 4
    if (needsInternalScroll) {
      list.scrollTop = list.scrollHeight
      return
    }
    const lastItem = list.lastElementChild as HTMLElement | null
    if (lastItem) {
      lastItem.scrollIntoView({ block: 'end', behavior: 'auto' })
    }
  })
}

function focusTextarea() {
  textareaRef.value?.focus()
}
</script>

<style scoped>
.chat-wrapper {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.chat-container {
  width: min(1240px, calc(100% - 48px));
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.chat-main {
  flex: 1 1 auto;
  min-height: 0;
  background: linear-gradient(145deg, rgba(148, 163, 184, 0.12) 0%, rgba(148, 163, 184, 0.04) 100%);
  border-radius: 28px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  padding: 28px 28px 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.message-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 10px;
}

.chat-input-card {
  flex: 0 0 auto;
  border-radius: 22px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.chat-input-card :deep(.ant-card-body) {
  padding: 20px 24px;
}

.input-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.control-label {
  font-weight: 500;
  color: var(--text-color);
}

.input-footer {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.input-actions {
  display: flex;
}

.streaming-label {
  font-weight: 500;
  color: var(--text-color);
}

@media (max-width: 1200px) {
  .chat-container {
    width: calc(100% - 32px);
  }
}

@media (max-width: 992px) {
  .chat-container {
    width: 100%;
    padding: 0 8px 12px;
    gap: 16px;
  }

  .chat-main {
    padding: 24px;
  }

  .input-footer {
    flex-direction: column-reverse;
    align-items: flex-start;
  }
}
</style>
































