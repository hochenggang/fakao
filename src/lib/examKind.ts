import type { ExamId } from '@/types/exam'

export type ExamKind = 'objective' | 'subjective'

/** 与 ExamId 一一对应的试卷类型映射(单一来源) */
export const EXAM_KIND: Record<ExamId, ExamKind> = {
  exam1: 'objective',
  exam2: 'objective',
  exam3: 'subjective',
}

export function examKindOf(id: ExamId): ExamKind {
  return EXAM_KIND[id]
}
