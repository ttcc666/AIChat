import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useConfigStore } from './stores/configStore'
import { useConversationStore } from './stores/conversationStore'
import { useAppearanceStore } from './stores/appearanceStore'

import 'ant-design-vue/dist/reset.css'
import 'highlight.js/styles/github.css'
import './style.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  const appearanceStore = useAppearanceStore(pinia)
  appearanceStore.initialize()

  const configStore = useConfigStore(pinia)
  configStore.initialize()

  const conversationStore = useConversationStore(pinia)
  await conversationStore.load(configStore.activeProvider)

  app.mount('#app')
}

bootstrap()
