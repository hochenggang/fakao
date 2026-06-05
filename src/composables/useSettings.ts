import { computed } from 'vue'
import type { Settings, ProviderConfig, ModelConfig, DefaultModel } from '@/types'
import { useLocalStorage } from './useLocalStorage'
import { genId } from '@/lib/format'

const STORAGE_KEY = 'fakao_settings'

function defaultModel(): ModelConfig {
  return { name: '', thinking: false }
}

function defaultProvider(): ProviderConfig {
  return {
    id: genId('p'),
    name: '',
    baseUrl: '',
    apiKey: '',
    models: [defaultModel()],
  }
}

function defaultSettings(): Settings {
  return { providers: [defaultProvider()] }
}

const settings = useLocalStorage<Settings>(STORAGE_KEY, defaultSettings())

/**
 * 组合 key(providerId:modelName)用于 <n-select> 选项值。
 * SettingsView 直接消费 defaultModelOptions / defaultModelValue / setDefaultModelByKey,
 * 避免模板中重复字符串拼接。
 */
function encodeKey(d: DefaultModel): string {
  return `${d.providerId}:${d.modelName}`
}

function decodeKey(v: string): DefaultModel | null {
  const idx = v.indexOf(':')
  if (idx < 0) return null
  return { providerId: v.slice(0, idx), modelName: v.slice(idx + 1) }
}

const defaultModelOptions = computed<Array<{ label: string; value: string }>>(() => {
  const opts: Array<{ label: string; value: string }> = []
  for (const p of settings.value.providers) {
    if (!p.baseUrl.trim() || !p.apiKey.trim()) continue
    const providerLabel = p.name.trim() || '未命名供应商'
    for (const m of p.models) {
      if (!m.name.trim()) continue
      opts.push({
        label: `${providerLabel} - ${m.name}`,
        value: encodeKey({ providerId: p.id, modelName: m.name }),
      })
    }
  }
  return opts
})

const defaultModelValue = computed(() => {
  const def = settings.value.defaultModel
  return def ? encodeKey(def) : null
})

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

  function setDefaultModelByKey(key: string) {
    const d = decodeKey(key)
    if (d) settings.value.defaultModel = d
  }

  function clearDefaultModel() {
    settings.value.defaultModel = undefined
  }

  function resolveDefaultModel(): { baseUrl: string; apiKey: string; model: string } | null {
    const def = settings.value.defaultModel
    if (def) {
      const p = settings.value.providers.find(
        x => x.id === def.providerId && x.baseUrl.trim() && x.apiKey.trim(),
      )
      if (p && p.models.some(m => m.name === def.modelName && m.name.trim())) {
        return { baseUrl: p.baseUrl, apiKey: p.apiKey, model: def.modelName }
      }
    }
    const p = settings.value.providers.find(
      x => x.baseUrl.trim() && x.apiKey.trim() && x.models.some(m => m.name.trim()),
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
    setDefaultModelByKey,
    clearDefaultModel,
    resolveDefaultModel,
    defaultModelOptions,
    defaultModelValue,
  }
}
