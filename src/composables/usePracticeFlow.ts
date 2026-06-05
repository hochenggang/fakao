import { type Ref } from 'vue'
import type { ExamId, Subject, Topic } from '@/types/exam'
import type { JsonShape } from './llm/json'
import { useLLM, callStreamWithParse } from './llm'
import { examKindOf, type ExamKind } from '@/lib/examKind'
import { buildExamJson, buildKnowledgeContext, type PromptContext } from './usePromptStore'

export type PracticeScope = 'topic' | 'subject' | 'exam'
export type PracticeKind = ExamKind

export interface ObjectiveOption {
  label: string
  text: string
}

export interface ObjectiveSingleQ {
  question: string
  options: ObjectiveOption[]
  correctAnswer: string
  explanation: string
}

export interface ObjectiveMultiQ {
  question: string
  options: ObjectiveOption[]
  correctAnswer: string[]
  explanation: string
}

export interface ObjectiveGenerateOut {
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  single: ObjectiveSingleQ
  multiple: ObjectiveMultiQ
}

export interface SubjectiveGenerateOut {
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  caseText: string
  question: string
}

export interface JudgeOut {
  report: string
  score?: [number, number]
  referenceAnswer?: string
}

const SUBJECTIVE_GENERATE_SCHEMA: JsonShape = {
  subjectId: 'string',
  subjectName: 'string',
  topicId: 'string',
  topicName: 'string',
  caseText: 'string',
  question: 'string',
}

const OBJECTIVE_OPTION_ITEM: JsonShape = { label: 'string', text: 'string' }

const OBJECTIVE_GENERATE_SCHEMA: JsonShape = {
  subjectId: 'string',
  subjectName: 'string',
  topicId: 'string',
  topicName: 'string',
  single: {
    question: 'string',
    options: [OBJECTIVE_OPTION_ITEM],
    correctAnswer: 'string',
    explanation: 'string',
  },
  multiple: {
    question: 'string',
    options: [OBJECTIVE_OPTION_ITEM],
    correctAnswer: 'string[]',
    explanation: 'string',
  },
}

const JUDGE_SCHEMA: JsonShape = {
  report: 'string',
}

export function usePracticeFlow(examId: Ref<ExamId>) {
  const { callStream } = useLLM()

  async function generate(
    subject: Subject | null,
    topic: Topic | null,
    scope: PracticeScope,
  ): Promise<ObjectiveGenerateOut | SubjectiveGenerateOut> {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'
    const schema = kind === 'subjective' ? SUBJECTIVE_GENERATE_SCHEMA : OBJECTIVE_GENERATE_SCHEMA

    const promptContext: PromptContext = {
      scope,
      subject,
      topic,
      knowledgeContext: buildKnowledgeContext(subject, topic, scope),
      examJson: scope === 'exam' ? buildExamJson(examId.value) : '',
    }

    return callStreamWithParse<ObjectiveGenerateOut | SubjectiveGenerateOut>(callStream, {
      promptKey,
      promptContext,
      blur: true, // 出题场景需要 blur
      schema,
      retries: 3,
    })
  }

  async function judge(ctx: PromptContext): Promise<JudgeOut> {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'
    return callStreamWithParse<JudgeOut>(callStream, {
      promptKey,
      promptContext: ctx,
      thinking: true, // 评判需要思考
      schema: JUDGE_SCHEMA,
      retries: 3,
      fallbackReport: true, // 失败时回退为 { report: text }
    })
  }

  return { generate, judge }
}
