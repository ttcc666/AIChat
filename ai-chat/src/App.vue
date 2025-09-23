<template>
  <a-layout class="app-layout">
    <a-layout-sider class="app-sider" width="280" breakpoint="lg" collapsible v-model:collapsed="siderCollapsed" :collapsed-width="72">
      <ConversationSidebar :collapsed="siderCollapsed" />
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="app-header">
        <div class="logo">AI 对话工作台</div>
        <a-menu class="app-menu" mode="horizontal" :theme="theme === 'dark' ? 'dark' : 'light'" :selected-keys="[activeMenuKey]" @click="onMenuClick">
          <a-menu-item key="chat">聊天</a-menu-item>
          <a-menu-item key="settings">设置</a-menu-item>
        </a-menu>
        <div class="header-right">
          <a-space align="center">
            <span class="theme-label">{{ theme === 'dark' ? '深色' : '浅色' }}</span>
            <a-switch
              :checked="theme === 'dark'"
              checked-children="🌙"
              un-checked-children="☀️"
              @change="handleThemeChange"
            />
          </a-space>
        </div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import ConversationSidebar from '@/components/ConversationSidebar.vue'
import type { MenuProps } from 'ant-design-vue'
import { useAppearanceStore } from '@/stores/appearanceStore'

const router = useRouter()
const route = useRoute()

const appearanceStore = useAppearanceStore()
const { theme } = storeToRefs(appearanceStore)

const siderCollapsed = ref(false)

const activeMenuKey = computed(() => (route.name ? String(route.name) : 'chat'))

const onMenuClick: MenuProps['onClick'] = ({ key }) => {
  const target = String(key) as 'chat' | 'settings'
  if (target !== activeMenuKey.value) {
    router.push({ name: target })
  }
}

function handleThemeChange(checked: boolean | string | number) {
  const isDark = checked === true || checked === 'true' || checked === 1
  appearanceStore.setTheme(isDark ? 'dark' : 'light')
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.app-sider {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  box-shadow: var(--sidebar-shadow);
  color: var(--text-color);
}

.app-sider :deep(.ant-layout-sider-children) {
  height: 100%;
}

.app-sider :deep(.ant-layout-sider-trigger) {
  background: transparent;
  border-top: 1px solid var(--header-border);
  color: var(--header-text);
}

.app-menu {
  flex: 1 1 auto;
  background: transparent !important;
  border-bottom: none !important;
  min-width: 0;
}

.app-menu :deep(.ant-menu-item),
.app-menu :deep(.ant-menu-submenu-title) {
  color: var(--header-text) !important;
}

.app-menu :deep(.ant-menu-item-selected),
.app-menu :deep(.ant-menu-item-active) {
  color: var(--role-user-accent) !important;
  background: rgba(22, 119, 255, 0.12) !important;
  border-radius: 10px;
}

.app-menu :deep(.ant-menu-item) {
  border-radius: 10px;
  margin-inline: 6px;
  padding-inline: 14px;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  background: var(--header-bg);
  color: var(--header-text);
  border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: var(--header-text);
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.theme-label {
  color: var(--header-text);
}

.app-content {
  min-height: calc(100vh - 64px);
  padding: 24px;
  background: var(--app-bg);
}

@media (max-width: 992px) {
  .app-content {
    padding: 12px;
  }
}
</style>
