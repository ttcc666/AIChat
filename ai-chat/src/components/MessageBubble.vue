<template>
  <div :class="['message-item', message.role, { thought: isThought }]">
    <div class="message-role">{{ roleLabel }}</div>
    <div class="message-content">
      <div class="message-actions" v-if="canCopy">
        <a-tooltip title="复制消息">
          <a-button size="small" type="text" @click="copyContent">
            <template #icon>
              <span class="icon-copy" />
            </template>
          </a-button>
        </a-tooltip>
      </div>
      <div class="markdown-body" v-html="rendered"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message as antdMessage } from 'ant-design-vue'
import type { ChatMessage } from '@/types/llm'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{ message: ChatMessage }>()

const isThought = computed(() => props.message.isThought === true)

const roleLabel = computed(() => {
  if (isThought.value) return '助手思考'
  if (props.message.role === 'assistant') return '助手'
  if (props.message.role === 'user') return '我'
  return '系统'
})

const rendered = computed(() => renderMarkdown(props.message.content))
const canCopy = computed(() => props.message.role !== 'system')

async function copyContent() {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(props.message.content)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = props.message.content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    antdMessage.success('已复制到剪贴板')
  } catch (error) {
    console.error(error)
    antdMessage.error('复制失败，请手动复制。')
  }
}
</script>

<style scoped>
.message-item {
  width: fit-content;
  min-width: clamp(220px, 30vw, 340px);
  max-width: clamp(360px, 52vw, 620px);
  padding: 10px 16px;
  border-radius: 18px;
  background: var(--message-neutral-bg);
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--message-shadow);
  border: 1px solid var(--message-border);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.message-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--message-shadow-hover);
}

.message-item.assistant {
  background: var(--message-assistant-bg);
  margin-right: auto;
}

.message-item.assistant.thought {
  background: var(--message-neutral-bg);
  border-style: dashed;
  opacity: 0.92;
}

.message-item.user {
  align-self: flex-end;
  margin-left: auto;
  background: var(--message-user-bg);
}

.message-item.system {
  background: var(--message-neutral-bg);
  opacity: 0.9;
}

.message-role {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--secondary-text);
  text-transform: uppercase;
}

.message-role::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--role-system-accent);
}

.message-item.assistant .message-role::before {
  background: var(--role-assistant-accent);
}

.message-item.assistant.thought .message-role::before {
  background: var(--role-system-accent);
}

.message-item.user .message-role::before {
  background: var(--role-user-accent);
}

.message-item.user .message-role {
  justify-content: flex-end;
}

.message-content {
  position: relative;
  font-size: 14px;
  color: var(--text-color);
  padding-right: 30px;
  min-height: 24px;
  line-height: 1.48;
  max-width: 56ch;
}

.message-item.thought .message-content {
  font-style: italic;
  color: var(--secondary-text);
}

.message-actions {
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.message-item:hover .message-actions,
.message-item:focus-within .message-actions {
  opacity: 1;
  pointer-events: auto;
}

.markdown-body :deep(pre) {
  background: rgba(15, 23, 42, 0.08);
  padding: 12px 14px;
  border-radius: 12px;
  overflow: auto;
}

:root[data-theme='dark'] .markdown-body :deep(pre) {
  background: rgba(148, 163, 184, 0.12);
}

.markdown-body :deep(code) {
  font-family: 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
}

.markdown-body :deep(p) {
  margin: 0 0 8px 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.icon-copy::before {
  content: '\1F4CB';
}

@media (max-width: 768px) {
  .message-item {
    min-width: min(86vw, 300px);
    max-width: min(92vw, 520px);
    padding: 10px 14px;
  }

  .message-content {
    padding-right: 28px;
    max-width: 46ch;
  }
}
</style>




