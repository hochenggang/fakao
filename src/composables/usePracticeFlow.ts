import { type Ref } from 'vue'
import type { ExamId, Subject, Topic } from '@/types/exam'
import type { JsonShape } from './llm/json'
import { useLLM } from './llm'
import { buildPrompt } from './usePromptStore'
import { useRuntimeMode } from './useRuntimeMode'
import { examById } from '@/data/exams'

export type PracticeScope = 'topic' | 'subject' | 'exam'
export type PracticeKind = 'objective' | 'subjective'

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
  topicId: string
  topicName: string
  single: ObjectiveSingleQ
  multiple: ObjectiveMultiQ
}

export interface SubjectiveGenerateOut {
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
  topicId: 'string',
  topicName: 'string',
  caseText: 'string',
  question: 'string',
}

const OBJECTIVE_OPTION_ITEM: JsonShape = { label: 'string', text: 'string' }

const OBJECTIVE_GENERATE_SCHEMA: JsonShape = {
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

export function kindOf(examId: ExamId): PracticeKind {
  return examId === 'exam3' ? 'subjective' : 'objective'
}

function buildExamSubjectsJson(examId: ExamId): string {
  const exam = examById(examId)
  if (!exam) return ''
  const slim = exam.subjects.map(s => ({
    id: s.id,
    name: s.name,
    topics: s.topics.map(t => ({ id: t.id, name: t.name, keywords: t.keywords })),
  }))
  return JSON.stringify(slim, null, 2)
}

export function usePracticeFlow(examId: Ref<ExamId>) {
  const llm = useLLM()
  const { isNormalMode } = useRuntimeMode()

  function checkMode() {
    if (!isNormalMode.value) throw new Error('降级模式下无法使用 AI 功能')
  }

  async function generate(
    subject: Subject,
    topic: Topic,
    scope: PracticeScope
  ): Promise<ObjectiveGenerateOut | SubjectiveGenerateOut> {
    checkMode()
    const kind = kindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'

    const extras: Record<string, string> = {}
    if (scope === 'exam') {
      extras.examSubjectsJson = buildExamSubjectsJson(examId.value)
    }

    const prompt = buildPrompt(promptKey, subject, topic, scope, extras)
    const schema = kind === 'subjective' ? SUBJECTIVE_GENERATE_SCHEMA : OBJECTIVE_GENERATE_SCHEMA

    return llm.ask<ObjectiveGenerateOut | SubjectiveGenerateOut>({
      messages: [{ role: 'user', content: prompt }],
      schema,
      thinking: false,
      blur: true,
    }) as Promise<ObjectiveGenerateOut | SubjectiveGenerateOut>
  }

  async function judge(
    subject: Subject,
    topic: Topic,
    scope: PracticeScope,
    extras: Record<string, string>
  ): Promise<JudgeOut> {
    checkMode()
    const kind = kindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'
    const prompt = buildPrompt(promptKey, subject, topic, scope, extras)
    return llm.ask<JudgeOut>({
      messages: [{ role: 'user', content: prompt }],
      schema: JUDGE_SCHEMA,
      thinking: true,
      blur: false,
    }) as Promise<JudgeOut>
  }

  return { generate, judge }
}
