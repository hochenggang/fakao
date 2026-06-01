import { ref } from 'vue'

interface PracticeRecord {
  subjectId: string
  topicId: string
  count: number
  lastPracticedAt: number
}

const STORAGE_KEY = 'fakao_practice'

function load(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return []
}

function save(list: PracticeRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const records = ref<PracticeRecord[]>(load())

export function usePracticeTracker() {
  function record(subjectId: string, topicId: string) {
    const idx = records.value.findIndex(r => r.subjectId === subjectId && r.topicId === topicId)
    if (idx >= 0) {
      records.value[idx].count += 1
      records.value[idx].lastPracticedAt = Date.now()
    } else {
      records.value.push({ subjectId, topicId, count: 1, lastPracticedAt: Date.now() })
    }
    save(records.value)
  }

  function getCount(subjectId: string, topicId: string): number {
    return records.value.find(r => r.subjectId === subjectId && r.topicId === topicId)?.count || 0
  }

  function getSubjectCount(subjectId: string): number {
    return records.value
      .filter(r => r.subjectId === subjectId)
      .reduce((sum, r) => sum + r.count, 0)
  }

  function list(): PracticeRecord[] {
    return records.value
  }

  return {
    records,
    record,
    getCount,
    getSubjectCount,
    list,
  }
}
