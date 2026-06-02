import { provide, inject, type InjectionKey } from 'vue'
import { createSseContext, type SseContext } from './createSseContext'

const KEY: InjectionKey<SseContext> = Symbol('AiSseProvider')

export function provideAiSse(): SseContext {
  const ctx = createSseContext()
  provide(KEY, ctx)
  return ctx
}

export function useLLM(): SseContext {
  const ctx = inject(KEY)
  if (!ctx) throw new Error('useLLM 必须在 <AiSseProvider> 内部使用')
  return ctx
}
