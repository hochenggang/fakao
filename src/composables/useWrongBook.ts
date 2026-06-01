import { ref } from 'vue'
import type { WrongBookItem } from '@/types'

const STORAGE_KEY = 'fakao_wrongbook'

function load(): WrongBookItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return []
}

function save(list: WrongBookItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const items = ref<WrongBookItem[]>(load())

export function useWrongBook() {
  function add(item: WrongBookItem) {
    items.value.unshift(item)
    save(items.value)
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
