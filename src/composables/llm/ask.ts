import { useStreamChat } from 'vue-llm-stream-chat'
import type { ChatMessage } from '@/types'
import { useSettings } from '@/composables/useSettings'
import { getPrompt } from '@/composables/usePromptStore'
import { extractJson, validateShape, type JsonShape } from './json'

export interface AskOptions {
  messages: ChatMessage[]
  schema?: JsonShape
  thinking?: boolean
  blur?: boolean
  retries?: number
  system?: string
}

export function useLLM() {
  const { streamChat } = useStreamChat()
  const { settings } = useSettings()

  function pickProvider() {
    const p = settings.value.providers.find(
      x => x.baseUrl.trim() && x.apiKey.trim() && x.models.some(m => m.name.trim())
    )
    if (!p) throw new Error('请先在设置中配置 API 信息')
    const m = p.models.find(m => m.name.trim())!
    return { baseUrl: p.baseUrl, apiKey: p.apiKey, model: m.name }
  }

  async function ask<T>(opts: AskOptions): Promise<T> {
    const provider = pickProvider()
    const retries = opts.retries ?? 3
    const system = opts.system ?? getPrompt('system')
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: system },
      ...opts.messages,
    ]

    let lastErr: Error | null = null
    let lastFullText = ''
    for (let i = 0; i < retries; i++) {
      try {
        const full = await streamChat(
          { baseUrl: provider.baseUrl, apiKey: provider.apiKey },
          provider.model,
          fullMessages,
          {
            thinking: opts.thinking,
            viewProps: opts.blur ? { blur: 4 } : { blur: 0 },
          }
        )
        lastFullText = full
        let obj: Record<string, unknown>
        try {
          obj = extractJson(full)
          validateShape(obj, opts.schema)
        } catch (jsonErr: any) {
          if (opts.schema && 'report' in opts.schema) {
            obj = { report: full }
          } else {
            throw jsonErr
          }
        }
        return obj as T
      } catch (e: any) {
        lastErr = new Error(`第 ${i + 1} 次失败: ${e?.message || String(e)}`)
      }
    }

    if (opts.schema && 'report' in opts.schema && lastFullText) {
      return { report: lastFullText } as T
    }
    throw lastErr ?? new Error('AI 调用失败')
  }

  return { ask }
}
