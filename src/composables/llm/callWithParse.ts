import { extractJson, validateShape, type JsonShape } from './json'
import type { CallStreamOptions } from './useLLM'

export interface ParseRetryOptions {
  schema?: JsonShape
  retries?: number
  /** judge 场景:true 时最后一次失败回退为 { report: text } */
  fallbackReport?: boolean
}

/**
 * 统一 LLM 调用 + JSON 解析 + 重试 + 失败回退。
 * - 每次重试都重新调 callStream
 * - 最后一次失败时,若 fallbackReport 且 schema 含 report 字段,回退为 { report: lastText }
 * - 其余场景直接抛出最后一次错误
 */
export async function callStreamWithParse<T>(
  callStream: (opts: CallStreamOptions) => Promise<string>,
  options: CallStreamOptions & ParseRetryOptions,
): Promise<T> {
  const { schema, retries = 3, fallbackReport = false, ...streamOpts } = options
  let lastError: Error | null = null
  let lastText = ''

  for (let i = 0; i < retries; i++) {
    try {
      const text = await callStream(streamOpts)
      lastText = text
      const obj = extractJson(text)
      if (schema) validateShape(obj, schema)
      return obj as T
    } catch (e: any) {
      lastError = e
    }
  }

  if (fallbackReport && schema && 'report' in schema && lastText) {
    return { report: lastText } as T
  }
  throw lastError ?? new Error('LLM call failed')
}
