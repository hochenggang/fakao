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
      const parsed = JSON.parse(raw) as Partial<Settings>
      return {
        providers: parsed.providers?.length ? parsed.providers : [defaultProvider()],
        defaultModel: parsed.defaultModel,
      }
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
    const removed = settings.value.providers[index]
    if (settings.value.defaultModel?.providerId === removed?.id) {
      settings.value.defaultModel = undefined
    }
    settings.value.providers.splice(index, 1)
  }

  function addModel(providerIndex: number) {
    settings.value.providers[providerIndex].models.push(defaultModel())
  }

  function removeModel(providerIndex: number, modelIndex: number) {
    const removed = settings.value.providers[providerIndex].models[modelIndex]
    const p = settings.value.providers[providerIndex]
    if (
      settings.value.defaultModel?.providerId === p.id &&
      settings.value.defaultModel?.modelName === removed?.name
    ) {
      settings.value.defaultModel = undefined
    }
    settings.value.providers[providerIndex].models.splice(modelIndex, 1)
  }

  function setDefaultModel(providerId: string, modelName: string) {
    settings.value.defaultModel = { providerId, modelName }
  }

  function clearDefaultModel() {
    settings.value.defaultModel = undefined
  }

  function resolveDefaultModel(): { baseUrl: string; apiKey: string; model: string } | null {
    const def = settings.value.defaultModel
    if (def) {
      const p = settings.value.providers.find(
        x => x.id === def.providerId && x.baseUrl.trim() && x.apiKey.trim()
      )
      if (p && p.models.some(m => m.name === def.modelName && m.name.trim())) {
        return { baseUrl: p.baseUrl, apiKey: p.apiKey, model: def.modelName }
      }
    }
    const p = settings.value.providers.find(
      x => x.baseUrl.trim() && x.apiKey.trim() && x.models.some(m => m.name.trim())
    )
    if (!p) return null
    const m = p.models.find(m => m.name.trim())!
    return { baseUrl: p.baseUrl, apiKey: p.apiKey, model: m.name }
  }

  return {
    settings,
    addProvider,
    removeProvider,
    addModel,
    removeModel,
    setDefaultModel,
    clearDefaultModel,
    resolveDefaultModel,
  }
}
