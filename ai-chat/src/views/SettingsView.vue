<template>
  <div class="settings-container">
    <a-card title="模型服务设置" bordered>
      <a-alert
        type="info"
        show-icon
        message="API 密钥仅存储在当前浏览器，请确保设备可信。"
      />
      <div class="settings-body">
        <a-tabs v-model:active-key="activeTab">
          <a-tab-pane key="openai" tab="OpenAI">
            <ProviderForm
              provider="openai"
              :config="formState.openai"
              :loading="saving.openai"
              @update="onSubmit"
              @reset="onReset"
            />
          </a-tab-pane>
          <a-tab-pane key="gemini" tab="Gemini">
            <ProviderForm
              provider="gemini"
              :config="formState.gemini"
              :loading="saving.gemini"
              @update="onSubmit"
              @reset="onReset"
            />
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message as antdMessage } from 'ant-design-vue'
import { useConfigStore } from '@/stores/configStore'
import type { GeminiConfig, OpenAIConfig, ProviderConfig, ProviderType } from '@/types/llm'
import ProviderForm from './components/ProviderForm.vue'

const configStore = useConfigStore()

const activeTab = ref<ProviderType>(configStore.activeProvider)

const formState = reactive<{ openai: OpenAIConfig; gemini: GeminiConfig }>({
  openai: { ...configStore.providerConfigs.openai } as OpenAIConfig,
  gemini: { ...configStore.providerConfigs.gemini } as GeminiConfig,
})

const saving = reactive<Record<ProviderType, boolean>>({
  openai: false,
  gemini: false,
})

watch(
  () => configStore.activeProvider,
  (provider) => {
    activeTab.value = provider
  },
)

watch(
  () => configStore.providerConfigs.openai,
  (config) => {
    Object.assign(formState.openai, config as OpenAIConfig)
  },
  { deep: true },
)

watch(
  () => configStore.providerConfigs.gemini,
  (config) => {
    Object.assign(formState.gemini, config as GeminiConfig)
  },
  { deep: true },
)

function onSubmit(payload: ProviderConfig) {
  const provider = payload.provider
  saving[provider] = true
  try {
    configStore.updateProviderConfig(provider, payload)
    if (payload.apiKey && configStore.activeProvider !== provider) {
      configStore.setActiveProvider(provider)
    }
    antdMessage.success('配置已保存')
  } finally {
    saving[provider] = false
  }
}

function onReset(provider: ProviderType) {
  if (provider === 'openai') {
    Object.assign(formState.openai, {
      ...configStore.providerConfigs.openai,
      apiKey: '',
    } as OpenAIConfig)
    configStore.updateProviderConfig('openai', formState.openai)
  } else {
    Object.assign(formState.gemini, {
      ...configStore.providerConfigs.gemini,
      apiKey: '',
    } as GeminiConfig)
    configStore.updateProviderConfig('gemini', formState.gemini)
  }
  antdMessage.success('API 密钥已清除')
}
</script>

<style scoped>
.settings-container {
  max-width: 760px;
  margin: 0 auto;
}

.settings-body {
  margin-top: 16px;
}
</style>
