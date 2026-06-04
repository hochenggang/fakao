import { useStreamChat } from 'vue-llm-stream-chat'
import type { Subject, Topic } from '@/types/exam'
import { buildPrompt } from './usePromptStore'
import { useSettings } from './useSettings'
import { useRuntimeMode } from './useRuntimeMode'

/**
 * 关键词背诵流程：生成"考点必背"纯文本 + 评析用户默写。
 *
 * 不复用 useLLM.ask（它强制 JSON schema 和 3 次重试），直接调用
 * vue-llm-stream-chat 的 streamChat，弹窗与 loading 由 <StreamChatModalProvider> 接管。
 */
export function useKeywordFlow() {
  const { streamChat, loading, fullContent, error } = useStreamChat()
  const { resolveDefaultModel } = useSettings()
  const { isNormalMode } = useRuntimeMode()

  async function runPrompt(prompt: string): Promise<string> {
    if (!isNormalMode.value) {
      throw new Error('降级模式下无法使用 AI 功能，请先在设置中配置 API 信息')
    }
    const picked = resolveDefaultModel()
    if (!picked) {
      throw new Error('请先在设置中配置默认模型')
    }
    await streamChat(
      { baseUrl: picked.baseUrl, apiKey: picked.apiKey },
      picked.model,
      [{ role: 'user', content: prompt }],
      {
        thinking: false,
        viewProps: { modal: true },
      },
    )
    if (error.value) throw new Error(error.value)
    return fullContent.value ?? ''
  }

  async function generateMemo(subject: Subject, topic: Topic, keyword: string): Promise<string> {
    const prompt = buildPrompt('keyword-memo', subject, topic, 'topic', { keyword })
    return runPrompt(prompt)
  }

  async function evaluateMemo(
    subject: Subject,
    topic: Topic,
    keyword: string,
    memoText: string,
    userRecall: string,
  ): Promise<string> {
    const prompt = buildPrompt('keyword-evaluate', subject, topic, 'topic', {
      keyword,
      memoText,
      userRecall,
    })
    return runPrompt(prompt)
  }

  return { generateMemo, evaluateMemo, loading }
}
