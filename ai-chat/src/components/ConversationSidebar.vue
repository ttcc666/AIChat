<template>
  <div :class="['conversation-sidebar', { collapsed: isCollapsed }]">
    <div v-if="!isCollapsed" class="sidebar-header">
      <a-button type="primary" block @click="handleCreate">新建对话</a-button>
      <a-dropdown placement="bottomRight">
        <a-button block>导入 / 导出</a-button>
        <template #overlay>
          <a-menu>
            <a-menu-item key="import" @click="triggerImport">导入 JSON</a-menu-item>
            <a-menu-item key="export" @click="handleExport">导出 JSON</a-menu-item>
            <a-menu-item key="clear" danger @click="handleClear">全部清除</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <input
        ref="fileInputRef"
        type="file"
        accept="application/json"
        class="hidden-input"
        @change="onFileSelected"
      />
    </div>
    <div v-else class="sidebar-header sidebar-header--compact">
      <a-tooltip title="新建对话">
        <a-button type="primary" shape="circle" size="large" @click="handleCreate">
          <template #icon><span class="icon-plus" /></template>
        </a-button>
      </a-tooltip>
      <a-dropdown placement="bottomRight" trigger="click">
        <a-button shape="circle" @click.stop>
          <template #icon><span class="icon-more" /></template>
        </a-button>
        <template #overlay>
          <a-menu>
            <a-menu-item key="import" @click="triggerImport">导入 JSON</a-menu-item>
            <a-menu-item key="export" @click="handleExport">导出 JSON</a-menu-item>
            <a-menu-item key="clear" danger @click="handleClear">全部清除</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <input
        ref="fileInputRef"
        type="file"
        accept="application/json"
        class="hidden-input"
        @change="onFileSelected"
      />
    </div>
    <a-spin :spinning="loading">
      <a-list class="conversation-list">
        <a-list-item
          v-for="item in sortedConversations"
          :key="item.id"
          :class="['conversation-item', { active: item.id === activeConversationId }]"
          @click="selectConversation(item.id)"
        >
          <template v-if="!isCollapsed">
            <div class="item-header">
              <div class="item-title" @dblclick.stop="openRename(item)">{{ item.title }}</div>
              <a-space>
                <a-tooltip title="重命名">
                  <a-button type="text" size="small" @click.stop="openRename(item)">
                    <template #icon><span class="icon-edit" /></template>
                  </a-button>
                </a-tooltip>
                <a-popconfirm
                  title="确认删除此会话？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm.stop="removeConversation(item.id)"
                >
                  <a-button type="text" size="small" danger>
                    <template #icon><span class="icon-delete" /></template>
                  </a-button>
                </a-popconfirm>
              </a-space>
            </div>
            <div class="item-meta">
              <span>{{ formatProvider(item.provider) }}</span>
              <span>{{ formatTime(item.updatedAt) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="item-compact" :class="{ active: item.id === activeConversationId }">
              <a-tooltip :title="formatProvider(item.provider)">
                <div class="item-compact-avatar" :data-provider="item.provider">{{ formatProviderBadge(item.provider) }}</div>
              </a-tooltip>
              <div class="item-compact-content">
                <a-tooltip :title="item.title">
                  <span class="item-compact-title">{{ getCompactLabel(item.title) }}</span>
                </a-tooltip>
                <span class="item-compact-meta">{{ formatTime(item.updatedAt) }}</span>
              </div>
              <a-dropdown trigger="click" placement="right">
                <a-button type="text" size="small" class="item-compact-action" @click.stop>
                  <template #icon><span class="icon-more" /></template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="rename" @click.stop="openRename(item)">重命名</a-menu-item>
                    <a-menu-item key="delete" danger @click.stop="removeConversation(item.id)">删除</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </a-list-item>
      </a-list>
    </a-spin>
    <a-modal v-model:open="renameModal.open" title="重命名会话" @ok="confirmRename">
      <a-input v-model:value="renameModal.title" placeholder="请输入会话标题" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { message as antdMessage } from 'ant-design-vue'
import { useConfigStore } from '@/stores/configStore'
import { useConversationStore } from '@/stores/conversationStore'
import type { ProviderType } from '@/types/llm'

const props = defineProps<{ collapsed?: boolean }>()

const configStore = useConfigStore()
const conversationStore = useConversationStore()

const isCollapsed = computed(() => Boolean(props.collapsed))
const loading = computed(() => conversationStore.loading)
const activeConversationId = computed(() => conversationStore.activeConversationId)

const sortedConversations = computed(() =>
  [...conversationStore.conversations].sort((a, b) => b.updatedAt - a.updatedAt),
)

const renameModal = reactive({
  open: false,
  id: '',
  title: '',
})

const fileInputRef = ref<HTMLInputElement | null>(null)

async function handleCreate() {
  await conversationStore.createConversation(configStore.activeProvider)
}

async function selectConversation(id: string) {
  const target = conversationStore.conversations.find((item) => item.id === id)
  if (!target) {
    return
  }
  await conversationStore.selectConversation(id)
  if (target.provider !== configStore.activeProvider) {
    configStore.setActiveProvider(target.provider as ProviderType)
  }
}

function openRename(item: { id: string; title: string }) {
  renameModal.open = true
  renameModal.id = item.id
  renameModal.title = item.title
}

async function confirmRename() {
  if (!renameModal.title.trim()) {
    antdMessage.warning('标题不能为空')
    return
  }
  await conversationStore.renameConversation(renameModal.id, renameModal.title)
  renameModal.open = false
  antdMessage.success('标题已更新')
}

async function removeConversation(id: string) {
  await conversationStore.removeConversation(id)
  antdMessage.success('会话已删除')
  if (!conversationStore.activeConversationId && conversationStore.conversations.length === 0) {
    await conversationStore.createConversation(configStore.activeProvider)
  }
}

function formatTime(timestamp: number) {
  return dayjs(timestamp).format('MM-DD HH:mm')
}

function formatProvider(provider: string) {
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'gemini') return 'Gemini'
  return provider
}

function formatProviderBadge(provider: string) {
  if (provider === 'openai') return 'O'
  if (provider === 'gemini') return 'G'
  return provider.slice(0, 1).toUpperCase()
}

function getCompactLabel(title: string) {
  const value = title?.trim() ?? ''
  if (!value) {
    return '会话'
  }
  return value.length > 2 ? value.slice(0, 2) : value
}

function triggerImport() {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const content = String(reader.result)
      await conversationStore.importConversations(content)
      antdMessage.success('导入成功')
      const first = conversationStore.conversations[0]
      if (first) {
        await conversationStore.selectConversation(first.id)
        configStore.setActiveProvider(first.provider as ProviderType)
      }
    } catch (error) {
      console.error(error)
      antdMessage.error('导入失败：文件格式不正确')
    }
    input.value = ''
  }
  reader.readAsText(file)
}

function handleExport() {
  const data = conversationStore.exportConversations()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `conversations-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function handleClear() {
  await conversationStore.clearAll()
  await conversationStore.createConversation(configStore.activeProvider)
  antdMessage.success('所有会话已清除')
}
</script>

<style scoped>
.conversation-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  color: var(--text-color);
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.hidden-input {
  display: none;
}

.conversation-list {
  flex: 1 1 auto;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.conversation-item:hover {
  background: var(--message-neutral-bg);
}

.conversation-item.active {
  background: var(--message-assistant-bg);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-title {
  font-weight: 500;
  color: var(--text-color);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--secondary-text);
}

.conversation-sidebar.collapsed {
  align-items: stretch;
  padding: 12px 6px;
}

.sidebar-header--compact {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.sidebar-header--compact :deep(.ant-btn) {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conversation-sidebar.collapsed .conversation-list {
  width: 100%;
  padding: 0 4px;
}

.conversation-sidebar.collapsed .conversation-item {
  padding: 4px 0;
  align-items: stretch;
}

.item-compact {
  display: grid;
  grid-template-columns: 40px 1fr 28px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 14px;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
}

.item-compact:hover {
  background: var(--message-neutral-bg);
}

.item-compact.active {
  background: var(--message-assistant-bg);
  box-shadow: var(--message-shadow);
}

.item-compact-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #fff;
  background: var(--role-assistant-accent);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
}

.item-compact-avatar[data-provider='openai'] {
  background: var(--role-user-accent);
}

.item-compact-avatar[data-provider='gemini'] {
  background: var(--role-assistant-accent);
}

.item-compact-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.item-compact-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-compact-meta {
  font-size: 11px;
  color: var(--secondary-text);
  line-height: 1.2;
}

.item-compact-action {
  justify-self: end;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-compact-action :deep(.anticon) {
  font-size: 14px;
}

.icon-plus::before {
  content: '+';
}

.icon-more::before {
  content: '\2026';
}

.icon-edit::before {
  content: '\270E';
}

.icon-delete::before {
  content: '\2716';
}

@media (max-width: 992px) {
  .conversation-sidebar {
    height: auto;
  }
}
</style>
