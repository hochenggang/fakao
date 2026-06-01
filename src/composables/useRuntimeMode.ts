import { computed } from 'vue'
import { useSettings } from './useSettings'

export function useRuntimeMode() {
  const { settings } = useSettings()

  const isNormalMode = computed(() => {
    const providers = settings.value.providers
    if (!providers || providers.length === 0) return false
    return providers.some(p => {
      const hasBaseUrl = p.baseUrl.trim().length > 0
      const hasApiKey = p.apiKey.trim().length > 0
      const hasModel = p.models.some(m => m.name.trim().length > 0)
      return hasBaseUrl && hasApiKey && hasModel
    })
  })

  const isDegradedMode = computed(() => !isNormalMode.value)

  return { isNormalMode, isDegradedMode }
}
