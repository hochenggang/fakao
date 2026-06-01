import { ref } from 'vue'
import { useAiCall } from './useAiCall'
import { useSettings } from './useSettings'
import { useRuntimeMode } from './useRuntimeMode'
import type { ChatMessage } from '@/types'

export interface StreamChatOptions {
  messages: ChatMessage[]
  thinking?: boolean
  onFinish?: (fullText: string) => void
  onError?: (error: Error) => void
}

export function useStreamChatWithModel() {
  const { streamChat } = useAiCall()
  const { settings } = useSettings()
  const { isNormalMode } = useRuntimeMode()

  const showStreamModal = ref(false)
  const streamingText = ref('')
  const reasoningText = ref('')
  const isStreaming = ref(false)

  async function startStreamChat(options: StreamChatOptions): Promise<void> {
    if (!isNormalMode.value) {
      options.onError?.(new Error('降级模式下无法使用 AI 功能'))
      return
    }

    const provider = settings.value.providers[0]
    const model = provider.models[0]?.name

    if (!provider?.baseUrl || !provider?.apiKey) {
      options.onError?.(new Error('请先在设置中配置 API 信息'))
      return
    }

    if (!model) {
      options.onError?.(new Error('请选择模型'))
      return
    }

    showStreamModal.value = true
    streamingText.value = ''
    reasoningText.value = ''
    isStreaming.value = true

    try {
      await streamChat(provider, model, options.messages, {
        thinking: options.thinking,
        onChunk: (_, full) => {
          streamingText.value = full
        },
        onThinking: (_, full) => {
          reasoningText.value = full
        },
        onFinish: (full) => {
          isStreaming.value = false
          showStreamModal.value = false
          options.onFinish?.(full)
        }
      })
    } catch (error: any) {
      isStreaming.value = false
      showStreamModal.value = false
      options.onError?.(error)
    }
  }

  function closeStreamModal() {
    showStreamModal.value = false
  }

  return {
    showStreamModal,
    streamingText,
    reasoningText,
    isStreaming,
    startStreamChat,
    closeStreamModal
  }
}
