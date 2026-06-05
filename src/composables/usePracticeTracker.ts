import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'fakao_practice_v2'
const LEGACY_KEY = 'fakao_practice'

export interface PracticeRecord {
  id: string
  subjectId: string
  topicId: string
  type: 'objective' | 'subjective'
  count: number
  lastPracticedAt: number
}

interface LegacyRecord {
  subjectId: string
  topicId: string
  count: number
  lastPracticedAt: number
}

/** 从 fakao_practice 读取并转换为 v2 结构。 */
function migrateLegacy(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const legacy = JSON.parse(raw) as LegacyRecord[]
    if (!Array.isArray(legacy)) return []
    return legacy.map(r => ({
      id: `objective-${r.subjectId}-${r.topicId}`,
      subjectId: r.subjectId,
      topicId: r.topicId,
      type: 'objective' as const,
      count: r.count,
      lastPracticedAt: r.lastPracticedAt,
    }))
  } catch {
    return []
  }
}

function loadInitial(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as PracticeRecord[]
    }
  } catch {
    // 读取失败,走迁移
  }
  // 触发一次性迁移
  const migrated = migrateLegacy()
  if (migrated.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    } catch {
      // 写入失败也无所谓,内存里有
    }
  }
  return migrated
}

const records = useLocalStorage<PracticeRecord[]>(STORAGE_KEY, loadInitial())

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
