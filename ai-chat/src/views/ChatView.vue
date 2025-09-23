<template>
  <div class="chat-container">
    <a-card class="chat-toolbar" bordered>
      <div class="toolbar-row">
        <div class="toolbar-left">
          <span class="toolbar-label">当前模型</span>
          <a-segmented
            v-model:value="localProvider"
            :options="providerOptions"
            @change="onProviderChange"
          />
          <a-button type="link" @click="goSettings">配置密钥</a-button>
        </div>
        <div class="toolbar-right">
          <a-popconfirm title="确认清空当前会话？" ok-text="清空" cancel-text="取消" @confirm="clearConversation">
            <a-button danger type="text">清空对话</a-button>
          </a-popconfirm>
        </div>
      </div>
      <a-alert
        v-if="!hasApiKey"
        type="warning"
        show-icon
        message="缺少 API 密钥"
        description="请先在设置页填写有效的密钥与模型，然后再开始对话。"
      />
    </a-card>

    <div class="chat-main">
      <a-spin :spinning="loading">
        <div class="message-list" ref="messageListRef">
          <template v-if="conversation.length">
            <MessageBubble v-for="(message, index) in conversation" :key="index" :message="message" />
          </template>
          <a-empty v-else description="立即开始新的对话" />
        </div>
      </a-spin>
    </div>

    <a-card class="chat-input-card">
      <a-form layout="vertical" @submit.prevent>
        <a-form-item label="提示词">
          <a-textarea
            ref="textareaRef"
            v-model:value="userInput"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="请输入问题，使用 Shift + Enter 换行"
            @keydown.enter.exact.prevent="handleSubmit"
            @keydown="handleKeydown"
          />
        </a-form-item>
        <div class="input-actions">
          <a-space>
            <a-button v-if="loading" danger @click="cancelGeneration">停止</a-button>
            <a-button @click="clearInput">清空</a-button>
            <a-button type="primary" :loading="loading" @click="handleSubmit">发送</a-button>
          </a-space>
        </div>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message as antdMessage } from 'ant-design-vue'
import { useConfigStore } from '@/stores/configStore'
import { useConversationStore } from '@/stores/conversationStore'
import type { ChatMessage, ChatRequest, ProviderType } from '@/types/llm'
import MessageBubble from '@/components/MessageBubble.vue'
import { executeChat } from '@/services/chatGateway'

type DivElement = globalThis.HTMLDivElement

interface TextAreaHandle {
  focus: () => void
}

const router = useRouter()
const configStore = useConfigStore()
const conversationStore = useConversationStore()

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
] satisfies Array<{ label: string; value: ProviderType }>

const localProvider = ref<ProviderType>(configStore.activeProvider)
const systemPrompt = ref('You are a helpful AI assistant.')
const userInput = ref('')
const loading = ref(false)
const messageListRef = ref<DivElement | null>(null)
const textareaRef = ref<TextAreaHandle | null>(null)
const abortController = ref<AbortController | null>(null)

const currentConversation = computed(() => conversationStore.activeConversation)
const conversation = computed(() => currentConversation.value?.messages ?? [])
const currentConfig = computed(() => configStore.currentConfig)
const hasApiKey = computed(() => Boolean(currentConfig.value.apiKey))


watch(
  () => configStore.activeProvider,
  (provider) => {
    localProvider.value = provider
    const active = currentConversation.value
    if (!active) {
      return
    }
    void conversationStore.updateConversationProvider(active.id, provider)
  },
)

watch(
  () => conversationStore.activeConversationId,
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
  const active = currentConversation.value
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

  const messages: ChatMessage[] = [
    ...(systemPrompt.value ? [{ role: 'system' as const, content: systemPrompt.value }] : []),
    ...active.messages,
    { role: 'user', content },
  ]

  const request: ChatRequest = {
    messages,
  }

  await conversationStore.appendMessage(conversationId, { role: 'user', content })
  userInput.value = ''
  loading.value = true

  try {
    const response = await executeChat(request, currentConfig.value, {
      signal: controller.signal,
    })
    await conversationStore.appendMessage(conversationId, {
      role: 'assistant',
      content: response.content,
    })
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
  const active = currentConversation.value
  if (!active) return
  conversationStore.replaceMessages(active.id, [])
}

function clearInput() {
  userInput.value = ''
  focusTextarea()
}

function onProviderChange(value: string | number) {
  const provider = String(value) as ProviderType
  if (!providerOptions.some((option) => option.value === provider)) {
    return
  }
  if (provider === configStore.activeProvider) {
    return
  }
  configStore.setActiveProvider(provider)
}

function goSettings() {
  router.push({ name: 'settings' })
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
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

function focusTextarea() {
  textareaRef.value?.focus()
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 120px);
}

.chat-toolbar {
  flex: 0 0 auto;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-label {
  font-weight: 500;
  color: var(--text-color);
}

.chat-main {
  flex: 1 1 auto;
  min-height: 0;
  background: var(--card-bg);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(15, 15, 15, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-main :deep(.ant-spin-nested-loading),
.chat-main :deep(.ant-spin-container) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.message-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 8px;
}

.chat-input-card {
  flex: 0 0 auto;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
