import { computed } from 'vue'
import { examOutline } from '@/data/subjects'
import { usePracticeTracker } from './usePracticeTracker'
import type { Subject, Topic } from '@/types'

export interface PracticeCountTree {
  id: string
  name: string
  count: number
  children?: PracticeCountTree[]
}

function buildSubjectCount(
  subject: Subject,
  getTopicCount: (subjectId: string, topicId: string) => number
): PracticeCountTree {
  const topicCounts = subject.topics.map(topic => ({
    id: topic.id,
    name: topic.name,
    count: getTopicCount(subject.id, topic.id)
  }))

  const totalCount = topicCounts.reduce((sum, t) => sum + t.count, 0)

  return {
    id: subject.id,
    name: subject.name,
    count: totalCount,
    children: topicCounts
  }
}

export function usePracticeCount() {
  const { getCount: getPracticeCount } = usePracticeTracker()

  const objectivePaper1Count = computed(() => {
    const subjects = examOutline.children.objective.children.paper1.children
    const subjectCounts = subjects.map(s => buildSubjectCount(s, getPracticeCount))
    const totalCount = subjectCounts.reduce((sum, s) => sum + s.count, 0)

    return {
      id: 'paper1',
      name: '卷一（公法卷）',
      count: totalCount,
      children: subjectCounts
    }
  })

  const objectivePaper2Count = computed(() => {
    const subjects = examOutline.children.objective.children.paper2.children
    const subjectCounts = subjects.map(s => buildSubjectCount(s, getPracticeCount))
    const totalCount = subjectCounts.reduce((sum, s) => sum + s.count, 0)

    return {
      id: 'paper2',
      name: '卷二（私法卷）',
      count: totalCount,
      children: subjectCounts
    }
  })

  const objectiveCount = computed(() => {
    const paper1 = objectivePaper1Count.value
    const paper2 = objectivePaper2Count.value

    return {
      id: 'objective',
      name: '客观题',
      count: paper1.count + paper2.count,
      children: [paper1, paper2]
    }
  })

  const subjectiveCount = computed(() => {
    const subjects = examOutline.children.subjective.children
    const subjectCounts = subjects.map(s => buildSubjectCount(s, getPracticeCount))
    const totalCount = subjectCounts.reduce((sum, s) => sum + s.count, 0)

    return {
      id: 'subjective',
      name: '主观题',
      count: totalCount,
      children: subjectCounts
    }
  })

  const totalCount = computed(() => {
    return objectiveCount.value.count + subjectiveCount.value.count
  })

  const practiceCountTree = computed(() => {
    return {
      id: 'fakao-outline-practice',
      name: '练习统计',
      count: totalCount.value,
      children: [objectiveCount.value, subjectiveCount.value]
    }
  })

  function getSubjectCount(subjectId: string): number {
    const allSubjects = [
      ...examOutline.children.objective.children.paper1.children,
      ...examOutline.children.objective.children.paper2.children,
      ...examOutline.children.subjective.children
    ]

    const subject = allSubjects.find(s => s.id === subjectId)
    if (!subject) return 0

    return subject.topics.reduce((sum, topic) => sum + getPracticeCount(subjectId, topic.id), 0)
  }

  function getPaperCount(paperId: 'paper1' | 'paper2'): number {
    if (paperId === 'paper1') {
      return objectivePaper1Count.value.count
    }
    return objectivePaper2Count.value.count
  }

  function getObjectiveTotalCount(): number {
    return objectiveCount.value.count
  }

  function getSubjectiveTotalCount(): number {
    return subjectiveCount.value.count
  }

  return {
    practiceCountTree,
    objectiveCount,
    subjectiveCount,
    objectivePaper1Count,
    objectivePaper2Count,
    totalCount,
    getSubjectCount,
    getPaperCount,
    getObjectiveTotalCount,
    getSubjectiveTotalCount
  }
}
