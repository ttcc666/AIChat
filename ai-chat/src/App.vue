<template>
  <a-layout class="app-layout">
    <a-layout-sider
      class="app-sider"
      width="280"
      breakpoint="lg"
      collapsible
      v-model:collapsed="siderCollapsed"
      :collapsed-width="72"
    >
      <ConversationSidebar :collapsed="siderCollapsed" @toggle-theme="handleThemeChange" />
    </a-layout-sider>
    <a-layout>
      <a-layout-content class="app-content">
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ConversationSidebar from '@/components/ConversationSidebar.vue'
import { useAppearanceStore } from '@/stores/appearanceStore'

const appearanceStore = useAppearanceStore()
const siderCollapsed = ref(false)

function handleThemeChange(isDark: boolean) {
  appearanceStore.setTheme(isDark ? 'dark' : 'light')
}
</script>

<style scoped>
.app-layout {
  height: 100vh;
  min-height: 100vh;
  background: var(--app-bg);
}

.app-sider {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  box-shadow: var(--sidebar-shadow);
  color: var(--text-color);
}

.app-sider :deep(.ant-layout-sider-children) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-sider :deep(.ant-layout-sider-trigger) {
  background: transparent;
  border-top: 1px solid var(--header-border);
  color: var(--header-text);
}

.app-content {
  box-sizing: border-box;
  height: 100vh;
  min-height: 100vh;
  padding: 24px 32px;
  background: var(--app-bg);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: hidden;
}

@media (max-width: 992px) {
  .app-content {
    padding: 12px;
  }
}
</style>



