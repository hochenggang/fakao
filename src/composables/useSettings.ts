import { ref, watch } from 'vue'
import type { Settings, ProviderConfig, ModelConfig } from '@/types'

const STORAGE_KEY = 'fakao_settings'

let uid = 0
function nextId(): string {
  return `p_${Date.now()}_${++uid}`
}

function defaultModel(): ModelConfig {
  return { name: '', thinking: false }
}

function defaultProvider(): ProviderConfig {
  return {
    id: nextId(),
    name: '',
    baseUrl: '',
    apiKey: '',
    models: [defaultModel()],
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as Settings
    }
  } catch {}
  return { providers: [defaultProvider()] }
}

const settings = ref<Settings>(load())

watch(settings, (val) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
}, { deep: true })

export function useSettings() {
  function addProvider() {
    settings.value.providers.push(defaultProvider())
  }

  function removeProvider(index: number) {
    settings.value.providers.splice(index, 1)
  }

  function addModel(providerIndex: number) {
    settings.value.providers[providerIndex].models.push(defaultModel())
  }

  function removeModel(providerIndex: number, modelIndex: number) {
    settings.value.providers[providerIndex].models.splice(modelIndex, 1)
  }

  return { settings, addProvider, removeProvider, addModel, removeModel }
}
