<template>
  <a-form :model="form" layout="vertical" @finish="handleFinish">
    <a-form-item label="API 密钥" name="apiKey" :rules="[{ required: true, message: '必须填写 API 密钥' }]">
      <a-input-password v-model:value="form.apiKey" placeholder="请输入 API 密钥" />
    </a-form-item>
    <a-form-item label="模型" name="model" :rules="[{ required: true, message: '必须填写模型名称' }]">
      <a-select
        v-model:value="form.model"
        :options="modelOptions"
        mode="combobox"
        show-search
        allow-clear
        :loading="modelsLoading"
        :default-active-first-option="false"
        placeholder="例如：gpt-4o-mini"
        @dropdown-visible-change="handleDropdownVisibleChange"
      />
      <template #extra>
        <span v-if="modelsLoading">正在加载模型...</span>
        <span v-else-if="remoteModelOptions.length">已载入 {{ remoteModelOptions.length }} 个模型</span>
        <span v-else>展开下拉后将自动获取模型列表</span>
      </template>
    </a-form-item>
    <a-form-item label="基础 URL" name="baseUrl">
      <a-input v-model:value="form.baseUrl" placeholder="留空则使用默认地址" />
    </a-form-item>
    <a-form-item v-if="isOpenAI" label="组织 ID" name="organizationId">
      <a-input v-model:value="openaiForm.organizationId" placeholder="可选" />
    </a-form-item>
    <div class="form-actions">
      <a-space>
        <a-button danger ghost @click="handleReset">清除密钥</a-button>
        <a-button type="primary" html-type="submit" :loading="loading">保存</a-button>
      </a-space>
    </div>
  </a-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message as antdMessage } from 'ant-design-vue'
import { fetchProviderModelOptions } from '@/services/modelCatalog'
import type { ModelOption, OpenAIConfig, ProviderConfig, ProviderType } from '@/types/llm'

interface ProviderFormProps {
  provider: ProviderType
  config: ProviderConfig
  loading: boolean
}

const props = defineProps<ProviderFormProps>()
const emit = defineEmits<{
  update: [payload: ProviderConfig]
  reset: [provider: ProviderType]
}>()

const form = reactive<ProviderConfig>({ ...props.config })

const isOpenAI = computed(() => props.provider === 'openai')
const loading = computed(() => props.loading)
const remoteModelOptions = ref<ModelOption[]>([])
const modelsLoading = ref(false)
const hasAttemptedFetch = ref(false)
const modelOptions = computed<ModelOption[]>(() => remoteModelOptions.value)
const openaiForm = computed<OpenAIConfig>(() => form as OpenAIConfig)

watch(
  () => props.config,
  (config) => {
    Object.assign(form, config)
    remoteModelOptions.value = []
    hasAttemptedFetch.value = false
  },
  { deep: true },
)

watch(
  () => form.apiKey,
  () => {
    remoteModelOptions.value = []
    hasAttemptedFetch.value = false
  },
)

function handleFinish() {
  emit('update', { ...form, provider: props.provider } as ProviderConfig)
}

function handleReset() {
  emit('reset', props.provider)
}

async function loadModels() {
  if (!form.apiKey) {
    antdMessage.warning('请先填写 API 密钥')
    return
  }

  if (modelsLoading.value) {
    return
  }

  if (remoteModelOptions.value.length > 0 && hasAttemptedFetch.value) {
    return
  }

  modelsLoading.value = true
  try {
    const options = await fetchProviderModelOptions({ ...form, provider: props.provider } as ProviderConfig)
    remoteModelOptions.value = options
    hasAttemptedFetch.value = true
    if (options.length === 0) {
      antdMessage.info('接口未返回可用模型，请确认凭证或权限')
    } else {
      antdMessage.success(`已加载 ${options.length} 个模型`)
    }
  } catch (error) {
    console.error(error)
    antdMessage.error('获取模型列表失败，请检查配置或稍后重试')
  } finally {
    modelsLoading.value = false
  }
}

function handleDropdownVisibleChange(open: boolean) {
  if (!open) {
    return
  }

  void loadModels()
}
</script>

<style scoped>
.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
