import { ref, watch, type Ref } from 'vue'

/**
 * 通用 localStorage 包装:首次从 localStorage 读取(失败回退 fallback),
 * 之后 deep watch 自动写回。用法与 ref 相同。
 */
export function useLocalStorage<T>(key: string, fallback: T): Ref<T> {
  const initial: T = (() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      // 读取失败,使用 fallback
    }
    return fallback
  })()

  const state = ref(initial) as Ref<T>

  watch(
    state,
    (val) => {
      try {
        localStorage.setItem(key, JSON.stringify(val))
      } catch {
        // 写入失败(如容量超限),静默忽略
      }
    },
    { deep: true },
  )

  return state
}
