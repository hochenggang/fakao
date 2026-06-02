import { computed } from 'vue'
import { exams } from '@/data/exams'
import type { ExamId } from '@/types/exam'
import { usePracticeTracker } from './usePracticeTracker'

export interface PracticeCountNode {
  id: string
  name: string
  count: number
  children?: PracticeCountNode[]
}

function sumCount(children: PracticeCountNode[]): number {
  return children.reduce((s, c) => s + (c.count + (c.children ? sumCount(c.children) : 0)), 0)
}

export function usePracticeCount() {
  const { getCount: getTopicCount, getSubjectCount: getAllTopicCountBySubject } = usePracticeTracker()

  const kindOf = (examId: ExamId) => (examId === 'exam3' ? 'subjective' as const : 'objective' as const)

  function getSubjectCount(subjectId: string, kind: 'objective' | 'subjective'): number {
    return getAllTopicCountBySubject(subjectId, kind)
  }

  function getExamCount(examId: ExamId): number {
    const exam = exams.find(e => e.id === examId)
    if (!exam) return 0
    const kind = kindOf(examId)
    return exam.subjects.reduce((sum, s) => sum + getSubjectCount(s.id, kind), 0)
  }

  const tree = computed<PracticeCountNode>(() => {
    const children: PracticeCountNode[] = exams.map(e => {
      const kind = kindOf(e.id)
      const subjectNodes: PracticeCountNode[] = e.subjects.map(s => {
        const topicNodes: PracticeCountNode[] = s.topics.map(t => ({
          id: t.id,
          name: t.name,
          count: getTopicCount(s.id, t.id, kind),
        }))
        return {
          id: s.id,
          name: s.name,
          count: topicNodes.reduce((sum, t) => sum + t.count, 0),
          children: topicNodes,
        }
      })
      return {
        id: e.id,
        name: e.name,
        count: subjectNodes.reduce((sum, s) => sum + s.count, 0),
        children: subjectNodes,
      }
    })
    return {
      id: 'root',
      name: '法考大纲',
      count: sumCount(children),
      children,
    }
  })

  const objectiveCount = computed(() => {
    return getExamCount('exam1') + getExamCount('exam2')
  })

  const subjectiveCount = computed(() => getExamCount('exam3'))

  const totalCount = computed(() => objectiveCount.value + subjectiveCount.value)

  function getTopicPracticeCount(subjectId: string, topicId: string, kind: 'objective' | 'subjective'): number {
    return getTopicCount(subjectId, topicId, kind)
  }

  return {
    tree,
    objectiveCount,
    subjectiveCount,
    totalCount,
    getSubjectCount,
    getExamCount,
    getTopicPracticeCount,
  }
}
