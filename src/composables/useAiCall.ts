import { getPrompt } from './usePromptStore'
import type { ProviderConfig, ChatMessage, StreamCallbacks } from '@/types'

export function useAiCall() {
  function getUrl(provider: ProviderConfig): string {
    return provider.baseUrl.replace(/\/+$/, '')
  }

  function validate(provider: ProviderConfig, model: string | null): void {
    if (!provider?.baseUrl || !provider?.apiKey) {
      throw new Error('请先在设置中配置 API 信息')
    }
    if (!model) {
      throw new Error('请选择模型')
    }
  }

  function prependSystem(messages: ChatMessage[]): ChatMessage[] {
    const systemPrompt = getPrompt('system')
    return [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]
  }

  function buildBody(
    model: string,
    messages: ChatMessage[],
    { thinking }: { thinking?: boolean } = {}
  ): Record<string, unknown> {
    const body: Record<string, unknown> = { model, messages, temperature: 0.8 }
    if (thinking) {
      body.thinking = { type: 'enabled', reasoning_effort: 'high' }
    }
    return body
  }

  async function chat(
    provider: ProviderConfig,
    model: string,
    messages: ChatMessage[],
    opts?: { thinking?: boolean }
  ): Promise<string> {
    validate(provider, model)

    const res = await fetch(getUrl(provider), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(buildBody(model, prependSystem(messages), opts)),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API 请求失败: ${res.status} ${err}`)
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || ''
  }

  async function streamChat(
    provider: ProviderConfig,
    model: string,
    messages: ChatMessage[],
    { onChunk, onFinish, onThinking, thinking }: StreamCallbacks = {}
  ): Promise<string> {
    validate(provider, model)

    const body = { ...buildBody(model, prependSystem(messages), { thinking }), stream: true }

    const res = await fetch(getUrl(provider), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API 请求失败: ${res.status} ${err}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let fullReasoning = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
          }
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            fullText += delta.content
            onChunk?.(delta.content, fullText)
          }

          if (delta.reasoning_content) {
            fullReasoning += delta.reasoning_content
            onThinking?.(delta.reasoning_content, fullReasoning)
          }
        } catch (e) {
          console.warn('SSE parse error:', e)
        }
      }
    }

    onFinish?.(fullText)
    return fullText
  }

  return { chat, streamChat }
}
