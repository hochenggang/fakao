import { computed } from 'vue'
import type { ExamId } from '@/types/exam'
import { useLocalStorage } from './useLocalStorage'
import { genId } from '@/lib/format'

export interface WrongBookObjectiveQ {
  question: string
  options: Array<{ label: string; text: string }>
  correctAnswer: string
  explanation: string
}

export interface WrongBookMultiQ {
  question: string
  options: Array<{ label: string; text: string }>
  correctAnswer: string[]
  explanation: string
}

export interface WrongBookItem {
  id: string
  examId: ExamId
  type: 'objective' | 'subjective'
  subjectId: string
  topicId: string
  subjectName: string
  topicName: string
  createdAt: number
  // 客观题
  singleQuestion?: WrongBookObjectiveQ
  multiQuestion?: WrongBookMultiQ
  singleAnswer?: string | null
  multiAnswer?: string[]
  singleCorrect?: boolean
  multiCorrect?: boolean
  // 主观题
  caseText?: string
  questionText?: string
  answer?: string
  // 通用
  aiJudgeResult: string
  score?: [number, number]
  referenceAnswer?: string
  isWrong: boolean
}

const STORAGE_KEY = 'fakao_wrongbook'

const items = useLocalStorage<WrongBookItem[]>(STORAGE_KEY, [])

const objectiveCount = computed(() => items.value.filter(i => i.type === 'objective').length)
const subjectiveCount = computed(() => items.value.filter(i => i.type === 'subjective').length)

export function useWrongBook() {
  function add(item: Omit<WrongBookItem, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): WrongBookItem {
    const full: WrongBookItem = {
      ...item,
      id: item.id || genId(),
      createdAt: item.createdAt || Date.now(),
    } as WrongBookItem
    items.value.unshift(full)
    return full
  }

  function remove(id: string) {
    items.value = items.value.filter(i => i.id !== id)
  }

  function list(): WrongBookItem[] {
    return items.value
  }

  function clear() {
    items.value = []
  }

  function has(id: string): boolean {
    return items.value.some(i => i.id === id)
  }

  return {
    items,
    add,
    remove,
    list,
    clear,
    has,
    objectiveCount,
    subjectiveCount,
  }
}
