export const EXAM_IDS = ['exam1', 'exam2', 'exam3'] as const
export type ExamId = (typeof EXAM_IDS)[number]

export const EXAM_NAMES: Record<ExamId, string> = {
  exam1: '客观题（卷一）',
  exam2: '客观题（卷二）',
  exam3: '主观题',
}

export interface Topic {
  id: string
  name: string
  keywords: string[]
}

export interface Subject {
  id: string
  name: string
  topics: Topic[]
}

export interface Exam {
  id: ExamId
  name: string
  subjects: Subject[]
}

// 单一来源:EXAM_KIND 与 examKindOf 来自 @/lib/examKind
export { EXAM_KIND, examKindOf, type ExamKind } from '@/lib/examKind'
