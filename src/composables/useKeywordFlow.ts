import type { Subject, Topic } from '@/types/exam'
import { useLLM } from './llm'
import { buildKnowledgeContext, type PromptContext } from './usePromptStore'

/**
 * 关键词背诵流程:生成「考点必背」纯文本 + 评析用户默写。
 * 统一通过 useLLM.callStream 入口,自动装载提示词 / 检查降级模式 / 透明接管 streamChat 弹窗。
 */
export function useKeywordFlow() {
  const { callStream } = useLLM()

  async function generateMemo(subject: Subject, topic: Topic, keyword: string): Promise<string> {
    const promptContext: PromptContext = {
      scope: 'topic',
      subject,
      topic,
      keyword,
      knowledgeContext: buildKnowledgeContext(subject, topic, 'topic'),
      examJson: '',
    }
    return callStream({ promptKey: 'keyword-memo', promptContext })
  }

  async function evaluateMemo(
    subject: Subject,
    topic: Topic,
    keyword: string,
    memoText: string,
    userRecall: string,
  ): Promise<string> {
    const promptContext: PromptContext = {
      scope: 'topic',
      subject,
      topic,
      keyword,
      memoText,
      userRecall,
      knowledgeContext: buildKnowledgeContext(subject, topic, 'topic'),
      examJson: '',
    }
    return callStream({ promptKey: 'keyword-evaluate', promptContext })
  }

  return { generateMemo, evaluateMemo }
}
