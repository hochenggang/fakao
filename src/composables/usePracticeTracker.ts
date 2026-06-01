import { ref } from 'vue'

export interface PracticeRecord {
  id: string
  subjectId: string
  topicId: string
  type: 'objective' | 'subjective'
  count: number
  lastPracticedAt: number
}

const STORAGE_KEY = 'fakao_practice_v2'

function load(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }

  const legacyRaw = localStorage.getItem('fakao_practice')
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw) as Array<{
        subjectId: string
        topicId: string
        count: number
        lastPracticedAt: number
      }>
      const migrated: PracticeRecord[] = legacy.map(r => ({
        id: `objective-${r.subjectId}-${r.topicId}`,
        subjectId: r.subjectId,
        topicId: r.topicId,
        type: 'objective' as const,
        count: r.count,
        lastPracticedAt: r.lastPracticedAt
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    } catch { }
  }

  return []
}

function save(list: PracticeRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const records = ref<PracticeRecord[]>(load())

export function usePracticeTracker() {
  function record(subjectId: string, topicId: string, type: 'objective' | 'subjective') {
    const id = `${type}-${subjectId}-${topicId}`
    const idx = records.value.findIndex(r => r.id === id)
    if (idx >= 0) {
      records.value[idx].count += 1
      records.value[idx].lastPracticedAt = Date.now()
    } else {
      records.value.push({ id, subjectId, topicId, type, count: 1, lastPracticedAt: Date.now() })
    }
    save(records.value)
  }

  function getCount(subjectId: string, topicId: string, type: 'objective' | 'subjective'): number {
    const id = `${type}-${subjectId}-${topicId}`
    return records.value.find(r => r.id === id)?.count || 0
  }

  function getSubjectCount(subjectId: string, type: 'objective' | 'subjective'): number {
    return records.value
      .filter(r => r.subjectId === subjectId && r.type === type)
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
