export const EXAM_IDS = ['exam1', 'exam2', 'exam3'] as const
export type ExamId = (typeof EXAM_IDS)[number]

export const EXAM_NAMES: Record<ExamId, string> = {
  exam1: '客观题（卷一）',
  exam2: '客观题（卷二）',
  exam3: '主观题',
}

export const EXAM_KIND: Record<ExamId, 'objective' | 'subjective'> = {
  exam1: 'objective',
  exam2: 'objective',
  exam3: 'subjective',
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
