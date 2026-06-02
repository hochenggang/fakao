import { ref } from 'vue'
import type { ExamId } from '@/types/exam'

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

function load(): WrongBookItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function save(list: WrongBookItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const items = ref<WrongBookItem[]>(load())

export function useWrongBook() {
  function add(item: Omit<WrongBookItem, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): WrongBookItem {
    const full: WrongBookItem = {
      ...item,
      id: item.id || genId(),
      createdAt: item.createdAt || Date.now(),
    } as WrongBookItem
    items.value.unshift(full)
    save(items.value)
    return full
  }

  function remove(id: string) {
    items.value = items.value.filter(i => i.id !== id)
    save(items.value)
  }

  function list(): WrongBookItem[] {
    return items.value
  }

  function clear() {
    items.value = []
    save([])
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
  }
}
