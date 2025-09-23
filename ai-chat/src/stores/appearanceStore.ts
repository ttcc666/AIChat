import { defineStore } from 'pinia'
import { ref } from 'vue'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'ai-chat::theme'

function detectPreferredTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const useAppearanceStore = defineStore('appearance', () => {
  const theme = ref<ThemeMode>('light')
  const initialized = ref(false)

  function applyTheme(value: ThemeMode) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', value)
    }
  }

  function initialize() {
    if (initialized.value) {
      return
    }
    let value: ThemeMode = detectPreferredTheme()
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      if (stored === 'light' || stored === 'dark') {
        value = stored
      }
    }
    theme.value = value
    applyTheme(value)
    initialized.value = true
  }

  function setTheme(value: ThemeMode) {
    theme.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
    applyTheme(value)
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  return {
    theme,
    initialize,
    setTheme,
    toggleTheme,
  }
})
