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

  /**
   * 守卫:不满足正常模式时直接 throw,供 LLM 入口统一调用。
   * 任何 LLM 调用都应作为第一步调用本函数,失败则立即终止。
   */
  function requireNormalMode(): void {
    if (!isNormalMode.value) {
      throw new Error('降级模式下无法使用 AI 功能，请先在设置中配置 API 信息')
    }
  }

  return { isNormalMode, isDegradedMode, requireNormalMode }
}
