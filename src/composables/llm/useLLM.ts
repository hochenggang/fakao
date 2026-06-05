import { useStreamChat } from 'vue-llm-stream-chat'
import type { ChatMessage } from '@/types'
import { useSettings } from '../useSettings'
import { useRuntimeMode } from '../useRuntimeMode'
import { SYSTEM_PROMPT, buildPrompt, type PromptKey, type PromptContext } from '../usePromptStore'

export interface CallStreamOptions {
  /** 模板键;与 prompt 二选一(同传则 prompt 优先) */
  promptKey?: PromptKey
  /** 直接给定的 user prompt(跳过 buildPrompt) */
  prompt?: string
  /** 与 promptKey 配合使用,包含所有提示词所需变量 */
  promptContext?: PromptContext
  /** 出题场景传 true,其余默认 false */
  blur?: boolean
  thinking?: boolean
  /** 覆盖默认的 system 提示词 */
  systemPrompt?: string
}

/**
 * 统一 LLM 调用入口:装载提示词 → streamChat → 返回 fullText。
 * - 默认 blur=false(出题场景由调用方传 blur:true)
 * - 自动加 system 提示词(用 SYSTEM_PROMPT 或 systemOverride)
 * - 降级模式下 throw
 * - streamChat 调用方式与 vue-llm-stream-chat 契约逐字保持一致
 */
export function useLLM() {
  const { streamChat, fullContent, error } = useStreamChat()
  const { resolveDefaultModel } = useSettings()
  const { requireNormalMode } = useRuntimeMode()

  async function callStream(opts: CallStreamOptions): Promise<string> {
    requireNormalMode()
    const picked = resolveDefaultModel()
    if (!picked) throw new Error('请先在设置中配置 API 信息')

    const userPrompt = opts.prompt
      ?? buildPrompt(opts.promptKey!, opts.promptContext!)

    const messages: ChatMessage[] = [
      { role: 'system', content: opts.systemPrompt ?? SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]

    await streamChat(
      { baseUrl: picked.baseUrl, apiKey: picked.apiKey },
      picked.model,
      messages,
      {
        thinking: opts.thinking ?? false,
        viewProps: opts.blur ? { blur: 4 } : { blur: 0 },
      },
    )

    if (error.value) throw new Error(error.value)
    return fullContent.value ?? ''
  }

  return { callStream }
}
