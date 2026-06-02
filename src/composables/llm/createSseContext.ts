import { ref, readonly, type Ref } from 'vue'
import type { ChatMessage } from '@/types'
import { useSettings } from '@/composables/useSettings'
import { useAiCallRaw } from '@/composables/useAiCallRaw'
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

export interface SseContext {
  streamingText: Readonly<Ref<string>>
  reasoningText: Readonly<Ref<string>>
  isStreaming: Readonly<Ref<boolean>>
  isThinking: Readonly<Ref<boolean>>
  showStream: Readonly<Ref<boolean>>
  blur: Readonly<Ref<boolean>>
  lastError: Readonly<Ref<Error | null>>
  ask: <T = unknown>(opts: AskOptions) => Promise<T>
  cancel: () => void
}

export function createSseContext(): SseContext {
  const { settings } = useSettings()
  const { streamChat } = useAiCallRaw()

  const streamingText = ref('')
  const reasoningText = ref('')
  const isStreaming = ref(false)
  const isThinking = ref(false)
  const showStream = ref(false)
  const blur = ref(false)
  const lastError = ref<Error | null>(null)
  let abortRef: AbortController | null = null

  function pickProvider() {
    const p = settings.value.providers.find(
      x => x.baseUrl.trim() && x.apiKey.trim() && x.models.some(m => m.name.trim())
    )
    if (!p) throw new Error('请先在设置中配置 API 信息')
    const m = p.models.find(m => m.name.trim())!
    return { provider: p, model: m }
  }

  async function ask<T>(opts: AskOptions): Promise<T> {
    const { provider, model } = pickProvider()
    const retries = opts.retries ?? 3
    const system = opts.system ?? getPrompt('system')
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: system },
      ...opts.messages,
    ]

    isStreaming.value = true
    isThinking.value = !!opts.thinking
    showStream.value = true
    blur.value = !!opts.blur
    streamingText.value = ''
    reasoningText.value = ''
    lastError.value = null
    abortRef = new AbortController()

    let lastErr: Error | null = null
    let lastFullText = ''
    for (let i = 0; i < retries; i++) {
      try {
        const full = await streamChat(provider, model.name, fullMessages, {
          thinking: opts.thinking,
          signal: abortRef.signal,
          onChunk: (_, text) => (streamingText.value = text),
          onThinking: (_, text) => (reasoningText.value = text),
        })
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
        setTimeout(() => {
          isStreaming.value = false
          showStream.value = false
        }, 200)
        return obj as T
      } catch (e: any) {
        lastErr = new Error(`第 ${i + 1} 次失败: ${e?.message || String(e)}`)
        if (e?.name === 'AbortError') break
      }
    }

    isStreaming.value = false
    showStream.value = false
    lastError.value = lastErr
    if (opts.schema && 'report' in opts.schema && lastFullText) {
      return { report: lastFullText } as T
    }
    throw lastErr ?? new Error('AI 调用失败')
  }

  function cancel() {
    abortRef?.abort()
    isStreaming.value = false
    showStream.value = false
  }

  return {
    streamingText: readonly(streamingText),
    reasoningText: readonly(reasoningText),
    isStreaming: readonly(isStreaming),
    isThinking: readonly(isThinking),
    showStream: readonly(showStream),
    blur: readonly(blur),
    lastError: readonly(lastError),
    ask,
    cancel,
  }
}
